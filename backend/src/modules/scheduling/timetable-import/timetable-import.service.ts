import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import { GeminiExtractionService } from './gemini-extraction.service';
import { PdfTextParserService } from './pdf-text-parser.service';
import { MatchingService } from './matching.service';
import { ConflictService, ConflictDetail } from './conflict.service';
import { CreateDraftSlotDto } from './dto/create-draft-slot.dto';
import { UpdateDraftSlotDto } from './dto/update-draft-slot.dto';

import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { ImportBatchStatus } from '@prisma/client';

/** Maximum allowed PDF file size: 20MB */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** PDF magic bytes header */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

@Injectable()
export class TimetableImportService {
  private readonly logger = new Logger(TimetableImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: R2StorageService,
    private readonly extractionService: GeminiExtractionService,
    private readonly textParserService: PdfTextParserService,
    private readonly matchingService: MatchingService,
    private readonly conflictService: ConflictService,
  ) {}

  /**
   * Validate that the uploaded buffer is actually a PDF and within size limits.
   */
  private validatePdfFile(buffer: Buffer, filename: string): void {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty.');
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${MAX_FILE_SIZE / 1024 / 1024}MB).`,
      );
    }

    // Check PDF magic bytes
    if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
      throw new BadRequestException(
        'Invalid file format. Only PDF files are accepted for timetable import.',
      );
    }
  }

  /**
   * Extract page texts from PDF using pdfjs-dist (legacy approach, used for PNG fallback)
   */
  private async extractPageTexts(pdfBuffer: Buffer): Promise<string[]> {
    try {
      const pdfjsPath = require('path').join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.mjs');
      const pdfjsWorkerPath = require('path').join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
      
      const pdfjs = await import(`file://${pdfjsPath.replace(/\\/g, '/')}`);

      const getDocument = pdfjs.getDocument || pdfjs.default?.getDocument;
      const GlobalWorkerOptions = pdfjs.GlobalWorkerOptions || pdfjs.default?.GlobalWorkerOptions;

      if (GlobalWorkerOptions) {
        GlobalWorkerOptions.workerSrc = `file://${pdfjsWorkerPath.replace(/\\/g, '/')}`;
      }

      const loadingTask = getDocument({
        data: new Uint8Array(pdfBuffer),
        useSystemFonts: false,
        disableFontFace: true,
      });
      const pdf = await loadingTask.promise;
      const pageTexts: string[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        pageTexts.push(pageText);
      }
      
      await loadingTask.destroy();
      return pageTexts;
    } catch (err) {
      this.logger.error('Failed to extract page texts via pdfjs-dist', err);
      return [];
    }
  }

  async uploadAndProcess(
    fileBuffer: Buffer,
    filename: string,
    userId: string,
  ) {
    // 0. Validate the uploaded PDF
    this.validatePdfFile(fileBuffer, filename);

    // 1. Calculate file hash to prevent double uploads
    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const sourceKey = `timetable-imports/${hash}.pdf`;

    const existingBatch = await this.prisma.timetableImportBatch.findFirst({
      where: { sourceFileR2Key: sourceKey },
    });

    let isDuplicate = false;
    if (existingBatch) {
      this.logger.warn(`File hash already exists in database: ${hash}`);
      isDuplicate = true;
    }

    // 2. Upload PDF to storage
    const uploadedKey = await this.storageService.uploadFile(
      fileBuffer,
      `${hash}-${filename}`,
      'application/pdf',
    );

    // 3. Extract raw text from PDF (used by all extraction paths)
    this.logger.log('Extracting raw text from PDF...');
    let fullRawText = '';
    let pageTexts: string[] = [];
    try {
      fullRawText = await this.textParserService.extractTextFromPdf(fileBuffer);
      // Also get per-page texts for PNG fallback path
      pageTexts = await this.extractPageTexts(fileBuffer);
    } catch (err) {
      this.logger.error('Failed to extract PDF text', err);
    }

    // 4. Create Batch record
    const batch = await this.prisma.timetableImportBatch.create({
      data: {
        uploadedByUserId: userId,
        sourceFileR2Key: uploadedKey,
        status: 'UPLOADED',
        notes: isDuplicate ? 'DUPLICATE_WARNING' : null,
      },
    });

    // 5. Kick off extraction & matching asynchronously
    this.runExtractionPipeline(batch.id, fileBuffer, fullRawText, pageTexts).catch((err) => {
      this.logger.error(`Background processing failed for batch ${batch.id}`, err);
    });

    return {
      batchId: batch.id,
      isDuplicate,
      status: 'UPLOADED',
      message: isDuplicate
        ? 'Warning: A batch with this exact file hash already exists.'
        : 'Timetable PDF uploaded successfully. Processing started in background.',
    };
  }

  /**
   * Three-tier extraction pipeline:
   * 1. Direct PDF → Gemini (AttendEase approach) — fastest, single API call
   * 2. PNG → Gemini (original INCA approach) — fallback if direct fails
   * 3. Text-based parser (new) — fallback if Gemini is unavailable
   */
  private async runExtractionPipeline(
    batchId: string,
    pdfBuffer: Buffer,
    fullRawText: string,
    pageTexts: string[],
  ) {
    this.logger.log(`Starting extraction pipeline for batch ${batchId}...`);

    // === Tier 1: Direct PDF → Gemini ===
    if (this.extractionService.isAvailable()) {
      try {
        this.logger.log(`[Tier 1] Attempting direct PDF→Gemini extraction for batch ${batchId}...`);
        const { header, grid } = await this.extractionService.extractFromPdf(pdfBuffer, fullRawText);

        if (grid.slots.length > 0) {
          this.logger.log(`[Tier 1] Success: ${grid.slots.length} slots extracted directly from PDF`);
          await this.saveExtractedSlots(batchId, header, grid);
          return;
        } else {
          this.logger.warn('[Tier 1] Direct PDF extraction returned 0 slots, falling through to Tier 2');
        }
      } catch (err) {
        this.logger.warn(`[Tier 1] Direct PDF→Gemini extraction failed: ${err.message}`);
      }

      // === Tier 2: PNG → Gemini (original INCA approach) ===
      try {
        this.logger.log(`[Tier 2] Attempting PNG→Gemini extraction for batch ${batchId}...`);
        await this.runPngGeminiExtraction(batchId, pdfBuffer, pageTexts);
        return;
      } catch (err) {
        this.logger.warn(`[Tier 2] PNG→Gemini extraction failed: ${err.message}`);
      }
    } else {
      this.logger.warn('Gemini AI is not configured, skipping Tier 1 & 2');
    }

    // === Tier 3: Text-based fallback parser ===
    try {
      this.logger.log(`[Tier 3] Attempting text-based fallback extraction for batch ${batchId}...`);
      await this.runTextFallbackExtraction(batchId, fullRawText);
      return;
    } catch (err) {
      this.logger.error(`[Tier 3] Text-based extraction also failed: ${err.message}`);
    }

    // All tiers failed
    await this.prisma.timetableImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'EXTRACTION_FAILED',
        notes: 'All extraction methods failed (direct PDF, PNG image, and text parsing).',
      },
    });
  }

  /**
   * Tier 2: Render PDF to PNG images, then extract via Gemini (original INCA approach)
   */
  private async runPngGeminiExtraction(
    batchId: string,
    pdfBuffer: Buffer,
    pageTexts: string[],
  ) {
    this.logger.log('Rendering PDF pages to PNG...');
    let pngPages: any[] = [];
    try {
      const { pdfToPng } = await import('pdf-to-png-converter');
      pngPages = await pdfToPng(pdfBuffer, { viewportScale: 2.0 });
    } catch (err) {
      throw new Error(`Failed to convert PDF to PNG: ${err.message}`);
    }

    // Store page images and metadata
    const pagesMetadata: any[] = [];
    for (let i = 0; i < pngPages.length; i++) {
      const page = pngPages[i];
      const pageText = pageTexts[i] || '';
      const pngKey = await this.storageService.uploadFile(
        page.content,
        `batch-${batchId}-page-${page.pageNumber}.png`,
        'image/png',
      );
      pagesMetadata.push({
        pageNumber: page.pageNumber,
        imageR2Key: pngKey,
        rawText: pageText,
      });
    }

    await this.prisma.timetableImportBatch.update({
      where: { id: batchId },
      data: { pagesJson: pagesMetadata },
    });

    // Process each page with Gemini
    for (const page of pagesMetadata) {
      const imageBuffer = await this.storageService.getFile(page.imageR2Key);

      const header = await this.extractionService.extractHeader(imageBuffer, page.rawText);
      const gridData = await this.extractionService.extractGrid(imageBuffer, page.rawText, header);

      await this.saveExtractedSlots(batchId, header, gridData);
    }

    // Mark batch as pending review
    await this.prisma.timetableImportBatch.update({
      where: { id: batchId },
      data: { status: 'PENDING_REVIEW' },
    });
    this.logger.log(`Batch ${batchId} PNG→Gemini extraction complete: PENDING_REVIEW`);
  }

  /**
   * Tier 3: Text-based fallback extraction using pdf-parse
   */
  private async runTextFallbackExtraction(batchId: string, rawText: string) {
    const header = this.textParserService.extractHeader(rawText);
    if (!header) {
      throw new Error('Text parser could not extract header from PDF text');
    }

    const grid = this.textParserService.extractGrid(rawText, header);
    if (!grid || grid.slots.length === 0) {
      throw new Error('Text parser could not extract any timetable slots from PDF text');
    }

    this.logger.log(`Text fallback parser extracted ${grid.slots.length} slots`);
    await this.saveExtractedSlots(batchId, header, grid);
  }

  /**
   * Helper to expand 2-period merged lab/practical sessions into individual period slots
   */
  private expandMergedSlots(slots: any[]): any[] {
    const expanded: any[] = [];

    const periodMap: Record<string, { start: string; end: string; nextStart: string; nextEnd: string; twoPeriodEnd: string }> = {
      '09:10 AM': { start: '09:10 AM', end: '10:05 AM', nextStart: '10:05 AM', nextEnd: '11:00 AM', twoPeriodEnd: '11:00 AM' },
      '9:10 AM': { start: '09:10 AM', end: '10:05 AM', nextStart: '10:05 AM', nextEnd: '11:00 AM', twoPeriodEnd: '11:00 AM' },
      '11:15 AM': { start: '11:15 AM', end: '12:10 PM', nextStart: '12:10 PM', nextEnd: '01:05 PM', twoPeriodEnd: '01:05 PM' },
      '01:45 PM': { start: '01:45 PM', end: '02:40 PM', nextStart: '02:40 PM', nextEnd: '03:35 PM', twoPeriodEnd: '03:35 PM' },
      '1:45 PM': { start: '01:45 PM', end: '02:40 PM', nextStart: '02:40 PM', nextEnd: '03:35 PM', twoPeriodEnd: '03:35 PM' },
      '02:40 PM': { start: '02:40 PM', end: '03:35 PM', nextStart: '03:35 PM', nextEnd: '04:30 PM', twoPeriodEnd: '04:30 PM' },
      '2:40 PM': { start: '02:40 PM', end: '03:35 PM', nextStart: '03:35 PM', nextEnd: '04:30 PM', twoPeriodEnd: '04:30 PM' },
    };

    for (const slot of slots) {
      const sStart = (slot.timeSlotStart || '').trim();
      const sEnd = (slot.timeSlotEnd || slot.mergedTimeSlotEnd || '').trim();
      const pInfo = periodMap[sStart];

      const isMultiPeriodSpan = pInfo && (
        sEnd.includes(pInfo.twoPeriodEnd) ||
        (slot.mergedTimeSlotEnd && slot.mergedTimeSlotEnd.includes(pInfo.twoPeriodEnd))
      );

      if (isMultiPeriodSpan && pInfo) {
        expanded.push({
          ...slot,
          timeSlotStart: pInfo.start,
          timeSlotEnd: pInfo.end,
          isMergedSlot: true,
        });

        expanded.push({
          ...slot,
          id: slot.id ? `${slot.id}-part2` : undefined,
          timeSlotStart: pInfo.nextStart,
          timeSlotEnd: pInfo.nextEnd,
          isMergedSlot: true,
        });
      } else {
        expanded.push(slot);
      }
    }

    const uniqueSlots: any[] = [];
    const seenKeys = new Set<string>();

    for (const slot of expanded) {
      const dayStr = (slot.day || '').toUpperCase().trim();
      const startStr = (slot.timeSlotStart || slot.startTime || '').trim();
      const endStr = (slot.timeSlotEnd || slot.endTime || '').trim();
      const subStr = (slot.subjectRaw || slot.subjectName || slot.subjectCode || '').toUpperCase().trim();
      const key = `${dayStr}_${startStr}_${endStr}_${subStr}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueSlots.push(slot);
      }
    }

    return uniqueSlots;
  }

  /**
   * Save extracted header + grid slots as TimetableSlotDraft records and run matching
   */
  private async saveExtractedSlots(
    batchId: string,
    header: any,
    gridData: any,
  ) {
    // Parse semester number
    const semNumberMatch = header.semester.match(/(\d+)/);
    const semesterNum = semNumberMatch ? parseInt(semNumberMatch[1], 10) : undefined;
    const deptCode = header.department;

    const rawSlots = gridData.slots || [];
    const expandedSlots = this.expandMergedSlots(rawSlots);

    for (const slot of expandedSlots) {
      const day = slot.day.toUpperCase().trim();

      const subCode = (slot.subjectCode || '').trim().toUpperCase();
      const subName = (slot.subjectName || '').trim();

      let subjectRaw = subName;
      if (subCode && subName) {
        if (!subName.toUpperCase().startsWith(subCode)) {
          subjectRaw = `${subCode} - ${subName}`;
        } else {
          subjectRaw = subName;
        }
      } else if (subCode) {
        subjectRaw = subCode;
      }

      const draft = await this.prisma.timetableSlotDraft.create({
        data: {
          batchId,
          gridId: gridData.gridId || `${header.department}-${header.section}`,
          day,
          timeSlotStart: slot.timeSlotStart,
          timeSlotEnd: slot.timeSlotEnd,
          isMergedSlot: slot.isMergedSlot,
          sectionCodes: slot.sectionCodes,
          subjectRaw,
          facultyRaw: slot.facultyFullName || slot.facultyShortCode,
          room: slot.room,
          category: slot.category,
          rawCellText: slot.rawCellText,
        },
      });

      // Run entity matching
      try {
        const subjectMatch = await this.matchingService.matchSubject(slot.subjectCode, slot.subjectName);
        const facultyMatch = await this.matchingService.matchFaculty(slot.facultyFullName, slot.facultyShortCode);
        const roomMatch = await this.matchingService.matchRoom(slot.room);

        let matchedSectionId: string | null = null;
        let sectionConfidence = 0;
        if (slot.sectionCodes && slot.sectionCodes.length > 0) {
          const sectCode = slot.sectionCodes[0];
          const sectionMatch = await this.matchingService.matchSection(sectCode, semesterNum, deptCode);
          matchedSectionId = sectionMatch.matchedId;
          sectionConfidence = sectionMatch.confidence;
        }

        const matchConfidence = (subjectMatch.confidence + facultyMatch.confidence + roomMatch.confidence + sectionConfidence) / 4;

        await this.prisma.timetableSlotDraft.update({
          where: { id: draft.id },
          data: {
            matchedSubjectId: subjectMatch.matchedId,
            matchedFacultyId: facultyMatch.matchedId,
            matchedRoomId: roomMatch.matchedId,
            matchedSectionId,
            matchConfidence,
          },
        });
      } catch (matchErr) {
        this.logger.error(`Matching failed for slot draft ID ${draft.id}`, matchErr);
      }
    }

    // Stage 5b: Auto cross-propagate resolved subjects and teachers across identical slots in the batch
    try {
      const allBatchDrafts = await this.prisma.timetableSlotDraft.findMany({
        where: { batchId },
      });

      const resolvedMap = new Map<string, {
        subjectRaw: string;
        matchedSubjectId: string | null;
        facultyRaw: string;
        matchedFacultyId: string | null;
        room?: string;
        matchedRoomId?: string | null;
      }>();

      for (const d of allBatchDrafts) {
        const subKey = (d.subjectRaw || '').trim().toUpperCase();
        if (subKey && (d.matchedSubjectId || (d.matchedFacultyId && d.facultyRaw && !d.facultyRaw.toLowerCase().includes('unassigned')))) {
          if (!resolvedMap.has(subKey)) {
            resolvedMap.set(subKey, {
              subjectRaw: d.subjectRaw,
              matchedSubjectId: d.matchedSubjectId,
              facultyRaw: d.facultyRaw,
              matchedFacultyId: d.matchedFacultyId,
              room: d.room,
              matchedRoomId: d.matchedRoomId,
            });
          }
        }
      }

      for (const d of allBatchDrafts) {
        const subKey = (d.subjectRaw || '').trim().toUpperCase();
        const resolved = resolvedMap.get(subKey);
        if (resolved) {
          const needsFaculty = (!d.matchedFacultyId || !d.facultyRaw || d.facultyRaw.toLowerCase().includes('unassigned')) && resolved.matchedFacultyId;
          const needsSubject = (!d.matchedSubjectId || !d.subjectRaw || d.subjectRaw.toLowerCase().includes('unassigned')) && resolved.matchedSubjectId;

          if (needsFaculty || needsSubject) {
            await this.prisma.timetableSlotDraft.update({
              where: { id: d.id },
              data: {
                ...(needsFaculty ? { facultyRaw: resolved.facultyRaw, matchedFacultyId: resolved.matchedFacultyId } : {}),
                ...(needsSubject ? { subjectRaw: resolved.subjectRaw, matchedSubjectId: resolved.matchedSubjectId } : {}),
                ...(resolved.room && (!d.room || d.room.trim() === '') ? { room: resolved.room, matchedRoomId: resolved.matchedRoomId } : {}),
              },
            });
          }
        }
      }
    } catch (crossErr) {
      this.logger.warn(`Batch cross-propagation notice: ${crossErr.message}`);
    }

    // Mark batch as pending review
    await this.prisma.timetableImportBatch.update({
      where: { id: batchId },
      data: { status: 'PENDING_REVIEW' },
    });
    this.logger.log(`Batch ${batchId} successfully completed extraction & matching: PENDING_REVIEW`);
  }

  async getBatchDetails(id: string) {
    const batch = await this.prisma.timetableImportBatch.findUnique({
      where: { id },
      include: {
        slots: {
          include: {
            matchedSubject: true,
            matchedFaculty: true,
            matchedRoom: true,
            matchedSection: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found.`);
    }

    return batch;
  }

  async updateDraftSlot(id: string, slotId: string, data: UpdateDraftSlotDto) {
    const slot = await this.prisma.timetableSlotDraft.findFirst({
      where: { id: slotId, batchId: id },
    });
    if (!slot) {
      throw new NotFoundException(`Draft slot not found in batch.`);
    }

    const applyToSimilar = data.applyToSimilar;
    const updateData: any = {
      ...data,
      adminEdited: true,
    };
    delete updateData.applyToSimilar;

    // Auto-match subject if raw changed and explicit ID not provided
    if (data.subjectRaw && data.matchedSubjectId === undefined) {
      try {
        const subMatch = await this.matchingService.matchSubject(data.subjectRaw, data.subjectRaw);
        if (subMatch.matchedId) {
          updateData.matchedSubjectId = subMatch.matchedId;
        }
      } catch (err) {
        this.logger.warn(`Auto-match subject failed: ${err.message}`);
      }
    }

    // Auto-match faculty if raw changed and explicit ID not provided
    if (data.facultyRaw && data.matchedFacultyId === undefined) {
      try {
        const facMatch = await this.matchingService.matchFaculty(data.facultyRaw, data.facultyRaw);
        if (facMatch.matchedId) {
          updateData.matchedFacultyId = facMatch.matchedId;
        }
      } catch (err) {
        this.logger.warn(`Auto-match faculty failed: ${err.message}`);
      }
    }

    const updated = await this.prisma.timetableSlotDraft.update({
      where: { id: slotId },
      data: updateData,
    });

    // If requested, propagate changes to all similar slots across the batch (e.g. all "TECHEDGE" slots)
    if (applyToSimilar) {
      try {
        const targetSubjectRaw = (updateData.subjectRaw || slot.subjectRaw || '').trim();
        const targetSubjectClean = targetSubjectRaw.toUpperCase();
        const targetCodeMatch = targetSubjectClean.match(/^([A-Z0-9\s]{2,12})\s*[-:]/);
        const targetCode = targetCodeMatch ? targetCodeMatch[1].trim() : targetSubjectClean;

        const siblingSlots = await this.prisma.timetableSlotDraft.findMany({
          where: {
            batchId: id,
            id: { not: slotId },
          },
        });

        for (const sib of siblingSlots) {
          const sibSubjectClean = (sib.subjectRaw || '').trim().toUpperCase();
          const sibCodeMatch = sibSubjectClean.match(/^([A-Z0-9\s]{2,12})\s*[-:]/);
          const sibCode = sibCodeMatch ? sibCodeMatch[1].trim() : sibSubjectClean;

          const isExactSubject = sibSubjectClean === targetSubjectClean;
          const isExactCode = targetCode.length >= 3 && sibCode === targetCode;
          const isHighSimilarity = this.matchingService.calculateSimilarity(sibSubjectClean, targetSubjectClean) >= 0.85;

          if (isExactSubject || isExactCode || isHighSimilarity) {
            const sibUpdate: any = {
              adminEdited: true,
            };
            if (updateData.subjectRaw) sibUpdate.subjectRaw = updateData.subjectRaw;
            if (updateData.matchedSubjectId !== undefined) sibUpdate.matchedSubjectId = updateData.matchedSubjectId;
            if (updateData.facultyRaw) sibUpdate.facultyRaw = updateData.facultyRaw;
            if (updateData.matchedFacultyId !== undefined) sibUpdate.matchedFacultyId = updateData.matchedFacultyId;
            if (updateData.room) {
              sibUpdate.room = updateData.room;
              if (updateData.matchedRoomId !== undefined) sibUpdate.matchedRoomId = updateData.matchedRoomId;
            }
            if (updateData.category) sibUpdate.category = updateData.category;
            if (updateData.isMergedSlot !== undefined) sibUpdate.isMergedSlot = updateData.isMergedSlot;

            await this.prisma.timetableSlotDraft.update({
              where: { id: sib.id },
              data: sibUpdate,
            });
          }
        }
      } catch (propErr) {
        this.logger.warn(`Propagation to similar slots error: ${propErr.message}`);
      }
    }

    return updated;
  }

  async addDraftSlot(id: string, data: CreateDraftSlotDto) {
    const batch = await this.prisma.timetableImportBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found.`);
    }

    const {
      gridId,
      day,
      timeSlotStart,
      timeSlotEnd,
      isMergedSlot,
      mergedTimeSlotEnd,
      sectionCodes,
      subjectRaw,
      facultyRaw,
      room,
      category,
      rawCellText,
    } = data;

    const draft = await this.prisma.timetableSlotDraft.create({
      data: {
        batchId: id,
        gridId,
        day,
        timeSlotStart,
        timeSlotEnd,
        isMergedSlot: isMergedSlot || false,
        sectionCodes,
        subjectRaw,
        facultyRaw,
        room,
        category,
        rawCellText: rawCellText ?? `${subjectRaw} (${facultyRaw})`,
        adminEdited: true,
      },
    });

    try {
      const subjectMatch = await this.matchingService.matchSubject(subjectRaw, subjectRaw);
      const facultyMatch = await this.matchingService.matchFaculty(facultyRaw, facultyRaw);
      const roomMatch = await this.matchingService.matchRoom(room);

      let matchedSectionId: string | null = null;
      let sectionConfidence = 0;
      if (sectionCodes && sectionCodes.length > 0) {
        const sectCode = sectionCodes[0];
        const sectionMatch = await this.matchingService.matchSection(sectCode, undefined, undefined);
        matchedSectionId = sectionMatch.matchedId;
        sectionConfidence = sectionMatch.confidence;
      }

      const matchConfidence = (subjectMatch.confidence + facultyMatch.confidence + roomMatch.confidence + sectionConfidence) / 4;

      return this.prisma.timetableSlotDraft.update({
        where: { id: draft.id },
        data: {
          matchedSubjectId: subjectMatch.matchedId,
          matchedFacultyId: facultyMatch.matchedId,
          matchedRoomId: roomMatch.matchedId,
          matchedSectionId,
          matchConfidence,
        },
      });
    } catch (err) {
      return draft;
    }
  }

  async removeDraftSlot(id: string, slotId: string) {
    const slot = await this.prisma.timetableSlotDraft.findFirst({
      where: { id: slotId, batchId: id },
    });
    if (!slot) {
      throw new NotFoundException(`Draft slot not found in batch.`);
    }

    return this.prisma.timetableSlotDraft.delete({
      where: { id: slotId },
    });
  }

  async discardBatch(id: string) {
    const batch = await this.prisma.timetableImportBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found.`);
    }

    return this.prisma.timetableImportBatch.update({
      where: { id },
      data: { status: 'DISCARDED' },
    });
  }

  async approveAndCommit(id: string, programId?: string) {
    const batch = await this.getBatchDetails(id);
    if (batch.status === 'COMMITTED') {
      throw new BadRequestException('Batch is already committed.');
    }

    if (programId) {
      const targetProgram = await this.prisma.program.findUnique({
        where: { id: programId },
      });
      if (!targetProgram) {
        throw new NotFoundException('Selected program not found.');
      }
    }

    const slots = batch.slots;

    // Run Stage 6: Conflict detection before finalizing database transaction
    // Step 1: Collect active timetable slots from database
    const dbActiveSlots = await this.prisma.timetableSlot.findMany({
      where: { version: { isActive: true } },
      include: {
        version: true,
        subject: true,
        faculty: true,
        room: true,
      },
    });

    const existingSlotsMapped = dbActiveSlots.map((s) => ({
      day: s.day,
      timeSlotStart: s.timeSlotStart,
      timeSlotEnd: s.timeSlotEnd,
      subjectName: s.subject.name,
      facultyName: `${s.faculty.firstName} ${s.faculty.lastName || ''}`.trim(),
      facultyId: s.facultyId,
      roomId: s.roomId,
      room: s.room.code,
      sectionName: s.version.sectionId,
      sectionId: s.version.sectionId,
    }));

    const newSlotsMapped = slots.map((s) => ({
      day: s.day,
      timeSlotStart: s.timeSlotStart,
      timeSlotEnd: s.timeSlotEnd,
      subjectName: s.subjectRaw,
      facultyFullName: s.facultyRaw,
      facultyId: s.matchedFacultyId,
      roomId: s.matchedRoomId,
      room: s.room,
      sectionCodes: s.sectionCodes,
      matchedSectionId: s.matchedSectionId,
    }));

    const conflicts = this.conflictService.detectConflicts(newSlotsMapped, existingSlotsMapped);
    if (conflicts.length > 0) {
      return {
        success: false,
        message: 'Blocking timetable conflicts detected.',
        conflicts,
      };
    }

    // Step 2: Auto-create missing entities and commit within transaction
    try {
      // Pre-compute bcrypt password outside the interactive transaction to avoid blocking CPU time
      const defaultPassHash = await bcrypt.hash('DefaultPass123!', 10);

      const result = await this.prisma.$transaction(
        async (tx) => {
          const subjectCache = new Map<string, string>();
          const facultyCache = new Map<string, string>();
          const roomCache = new Map<string, string>();
          const sectionMap = new Map<string, any>(); // sectionId -> section entity with semester
          const sectionCodeMap = new Map<string, any>(); // cacheKey -> section entity with semester

          const facultyRole = await tx.role.findUnique({
            where: { code: 'FACULTY' },
          });

          for (const slot of slots) {
            // 1. Resolve Section
            let sectionId = slot.matchedSectionId;

            // If a programId is specified, check if matchedSectionId belongs to this program
            if (sectionId && programId) {
              let existingSec = sectionMap.get(sectionId);
              if (!existingSec) {
                existingSec = await tx.section.findUnique({
                  where: { id: sectionId },
                  include: { semester: true },
                });
                if (existingSec) {
                  sectionMap.set(sectionId, existingSec);
                }
              }
              if (!existingSec || existingSec.semester.programId !== programId) {
                sectionId = null;
              }
            }

            if (!sectionId && slot.sectionCodes && slot.sectionCodes.length > 0) {
              const secCode = slot.sectionCodes[0].trim().toUpperCase();
              const cacheKey = programId ? `${programId}:${secCode}` : secCode;
              if (sectionCodeMap.has(cacheKey)) {
                const cachedSec = sectionCodeMap.get(cacheKey);
                sectionId = cachedSec.id;
                if (sectionId) {
                  sectionMap.set(sectionId, cachedSec);
                }
              } else {
                let dbSec: any = null;
                if (programId) {
                  dbSec = await tx.section.findFirst({
                    where: {
                      name: secCode,
                      semester: { programId },
                    },
                    include: { semester: true },
                  });
                } else {
                  dbSec = await tx.section.findFirst({
                    where: { name: secCode },
                    include: { semester: true },
                  });
                }

                if (!dbSec) {
                  let targetSemester: any = null;
                  if (programId) {
                    // Attempt to extract semester number from section code (e.g. "AIML-7" -> 7, "C3" -> 3)
                    let semNum = 1;
                    const numMatch = secCode.match(/\b([1-8])\b/) || secCode.match(/([1-8])/);
                    if (numMatch) {
                      semNum = parseInt(numMatch[1], 10);
                    }
                    targetSemester = await tx.semester.findFirst({
                      where: { programId, number: semNum },
                    });
                    if (!targetSemester) {
                      targetSemester = await tx.semester.findFirst({
                        where: { programId },
                      });
                    }
                    if (!targetSemester) {
                      // Create semester for this program
                      targetSemester = await tx.semester.create({
                        data: {
                          programId,
                          number: semNum,
                          name: `Semester ${semNum}`,
                          isActive: true,
                        },
                      });
                    }
                  } else {
                    targetSemester = await tx.semester.findFirst();
                  }

                  if (!targetSemester) {
                    throw new BadRequestException('Cannot auto-create Section without Semester in DB.');
                  }
                  dbSec = await tx.section.create({
                    data: {
                      name: secCode,
                      semesterId: targetSemester.id,
                    },
                    include: { semester: true },
                  });
                }
                sectionId = dbSec.id;
                sectionCodeMap.set(cacheKey, dbSec);
                if (sectionId) {
                  sectionMap.set(sectionId, dbSec);
                }
              }
            }

            if (!sectionId) {
              throw new BadRequestException(`Could not match or resolve Section for slot: ${slot.rawCellText}`);
            }

            let section = sectionMap.get(sectionId);
            if (!section) {
              section = await tx.section.findUnique({
                where: { id: sectionId },
                include: { semester: true },
              });
              if (!section) {
                throw new BadRequestException(`Section with ID ${sectionId} not found.`);
              }
              sectionMap.set(sectionId, section);
            }
            const semesterId = section.semesterId;
            const activeProgramId = section.semester.programId;

            // 2. Resolve Subject
            let subjectId = slot.matchedSubjectId;
            if (!subjectId && slot.subjectRaw) {
              const subClean = slot.subjectRaw.trim();
              const subCodeMatch = subClean.match(/\(([^)]+)\)/) || [null, subClean.substring(0, 10)];
              const subCode = subCodeMatch[1].toUpperCase();

              if (subjectCache.has(subClean)) {
                subjectId = subjectCache.get(subClean) || null;
              } else {
                let dbSub = await tx.subject.findFirst({
                  where: { code: subCode },
                });
                if (!dbSub) {
                  const semNum = section.semester?.number || 1;
                  dbSub = await tx.subject.create({
                    data: {
                      code: subCode,
                      name: subClean,
                      year: Math.ceil(semNum / 2),
                      semesterId,
                    },
                  });
                }
                subjectId = dbSub.id;
                subjectCache.set(subClean, subjectId);
              }
            }

            // 3. Resolve Faculty
            let facultyId = slot.matchedFacultyId;
            if (!facultyId && slot.facultyRaw) {
              const facClean = slot.facultyRaw.trim();
              if (facultyCache.has(facClean)) {
                facultyId = facultyCache.get(facClean) || null;
              } else {
                const initials = facClean
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .replace(/[^A-Z]/g, '');
                const employeeCode = `FAC-${initials}-${Math.floor(100 + Math.random() * 900)}`;

                let dbFac = await tx.faculty.findFirst({
                  where: { employeeCode },
                });

                if (!dbFac) {
                  const email = `${facClean.toLowerCase().replace(/[^a-z]/g, '')}@inca.edu`;

                  const firstRole = await tx.role.findFirst();
                  if (!firstRole && !facultyRole) {
                    throw new BadRequestException('No roles defined in the database.');
                  }
                  const roleId = facultyRole ? facultyRole.id : firstRole!.id;

                  const user = await tx.user.create({
                    data: {
                      email,
                      password: defaultPassHash,
                      roleId,
                      mustChangePassword: true,
                    },
                  });

                  const names = facClean.replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '').split(' ');
                  const firstName = names[0] || 'Faculty';
                  const lastName = names.slice(1).join(' ') || null;

                  dbFac = await tx.faculty.create({
                    data: {
                      userId: user.id,
                      employeeCode,
                      firstName,
                      lastName,
                      gender: 'OTHER',
                      designation: 'Lecturer',
                    },
                  });
                }
                facultyId = dbFac.id;
                facultyCache.set(facClean, facultyId);
              }
            }

            // 4. Resolve Room
            let roomId = slot.matchedRoomId;
            if (!roomId && slot.room) {
              const roomCode = slot.room.trim().toUpperCase();
              if (roomCache.has(roomCode)) {
                roomId = roomCache.get(roomCode) || null;
              } else {
                let dbRoom = await tx.room.findUnique({
                  where: { code: roomCode },
                });
                if (!dbRoom) {
                  dbRoom = await tx.room.create({
                    data: {
                      code: roomCode,
                      name: `Room ${roomCode}`,
                    },
                  });
                }
                roomId = dbRoom.id;
                roomCache.set(roomCode, roomId);
              }
            }

            slot.matchedSectionId = sectionId;
            slot.matchedSubjectId = subjectId;
            slot.matchedFacultyId = facultyId;
            slot.matchedRoomId = roomId;
          }

          // Commit as new versions for each section
          const uniqueSectionIds = Array.from(new Set(slots.map((s) => s.matchedSectionId).filter((s): s is string => !!s)));
          const createdVersions: any[] = [];

          for (const secId of uniqueSectionIds) {
            await tx.timetableVersion.updateMany({
              where: { sectionId: secId, isActive: true },
              data: { isActive: false },
            });

            const version = await tx.timetableVersion.create({
              data: {
                sectionId: secId,
                isActive: true,
                importBatchId: id,
                effectiveFrom: new Date(),
              },
            });

            const sectionSlots = slots.filter((s) => s.matchedSectionId === secId);
            for (const s of sectionSlots) {
              if (!s.matchedSubjectId || !s.matchedFacultyId || !s.matchedRoomId) {
                throw new BadRequestException('All slot drafts must have resolved Subject, Faculty, and Room before approval.');
              }
            }

            // Bulk create all slots in a single fast query
            await tx.timetableSlot.createMany({
              data: sectionSlots.map((s, idx) => ({
                versionId: version.id,
                day: s.day,
                lectureNumber: idx + 1,
                timeSlotStart: s.timeSlotStart,
                timeSlotEnd: s.timeSlotEnd,
                subjectId: s.matchedSubjectId!,
                facultyId: s.matchedFacultyId!,
                roomId: s.matchedRoomId!,
                category: s.category,
                isLab: s.isMergedSlot || false,
                batchSection: s.sectionCodes && s.sectionCodes.length > 0 ? s.sectionCodes[0] : 'All',
              })),
            });

            createdVersions.push(version);
          }

          await tx.timetableImportBatch.update({
            where: { id },
            data: { status: 'COMMITTED', committedAt: new Date() },
          });

          return createdVersions;
        },
        {
          maxWait: 20000,
          timeout: 60000,
        },
      );

      // Auto-sync committed slots into ScheduleTemplate and generate daily schedules
      try {
        await this.syncTimetableToSchedules();
      } catch (syncErr) {
        this.logger.warn('Non-fatal: failed to auto-sync schedules after commit', syncErr);
      }

      return {
        success: true,
        message: 'Timetable batch successfully approved and committed.',
        versions: result,
      };
    } catch (txErr) {
      this.logger.error('Transaction failed during timetable commit', txErr);
      throw new BadRequestException(`Failed to commit timetable: ${txErr.message}`);
    }
  }

  async checkSectionTimetable(sectionId: string) {
    const version = await this.prisma.timetableVersion.findFirst({
      where: { sectionId, isActive: true },
      include: {
        section: {
          include: {
            semester: {
              include: {
                program: {
                  include: {
                    department: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!version) {
      return { exists: false };
    }

    return {
      exists: true,
      versionId: version.id,
      sectionId: version.sectionId,
      sectionName: version.section.name,
      departmentName: version.section.semester.program.department.name,
      programName: version.section.semester.program.name,
      semesterName: version.section.semester.name,
      semesterNumber: version.section.semester.number,
      effectiveFrom: version.effectiveFrom,
    };
  }

  async getActiveSectionTimetable(sectionId: string) {
    const version = await this.prisma.timetableVersion.findFirst({
      where: { sectionId, isActive: true },
      include: {
        slots: {
          include: {
            subject: true,
            faculty: true,
            room: true,
          },
          orderBy: [
            { day: 'asc' },
            { lectureNumber: 'asc' },
          ],
        },
        section: {
          include: {
            semester: {
              include: {
                program: {
                  include: {
                    department: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!version) {
      throw new NotFoundException(`No active timetable found for section ${sectionId}`);
    }

    const dayMap: Record<string, string> = {
      MON: 'Monday', MONDAY: 'Monday',
      TUES: 'Tuesday', TUESDAY: 'Tuesday',
      WED: 'Wednesday', WEDNESDAY: 'Wednesday',
      THU: 'Thursday', THURS: 'Thursday', THURSDAY: 'Thursday',
      FRI: 'Friday', FRIDAY: 'Friday',
      SAT: 'Saturday', SATURDAY: 'Saturday',
    };

    const weeklySchedule: Record<string, any[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
    };

    for (const slot of version.slots) {
      const fullDay = dayMap[slot.day.toUpperCase()] || 'Monday';
      if (!weeklySchedule[fullDay]) {
        weeklySchedule[fullDay] = [];
      }

      weeklySchedule[fullDay].push({
        id: slot.id,
        lectureNumber: weeklySchedule[fullDay].length + 1,
        subjectCode: slot.subject.code,
        subjectName: slot.subject.name,
        facultyName: `${slot.faculty.firstName} ${slot.faculty.lastName || ''}`.trim(),
        facultyId: slot.facultyId,
        subjectId: slot.subjectId,
        roomId: slot.roomId,
        roomNumber: slot.room.code,
        startTime: slot.timeSlotStart,
        endTime: slot.timeSlotEnd,
        isLab: slot.isLab,
        batchSection: slot.batchSection || 'All',
        category: slot.category,
        dayOfWeek: fullDay,
      });
    }

    const parseTimeToMinutes = (timeStr?: string): number => {
      if (!timeStr) return 0;
      const str = timeStr.trim().toUpperCase();
      const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return 0;

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const period = match[3];

      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      return hours * 60 + minutes;
    };

    for (const day of Object.keys(weeklySchedule)) {
      weeklySchedule[day].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
      weeklySchedule[day].forEach((lec, idx) => {
        lec.lectureNumber = idx + 1;
      });
    }

    return {
      versionId: version.id,
      sectionId: version.sectionId,
      departmentName: version.section.semester.program.department.name,
      programName: version.section.semester.program.name,
      semesterName: version.section.semester.name,
      semesterNumber: version.section.semester.number,
      sectionName: version.section.name,
      effectiveFrom: version.effectiveFrom,
      weeklySchedule,
    };
  }

  async getActiveConfigurations() {
    const versions = await this.prisma.timetableVersion.findMany({
      where: { isActive: true },
      include: {
        slots: { select: { id: true } },
        section: {
          include: {
            semester: {
              include: {
                program: {
                  include: {
                    department: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return versions.map((v) => ({
      versionId: v.id,
      sectionId: v.sectionId,
      sectionName: v.section?.name,
      slotCount: v.slots.length,
      semesterId: v.section?.semester?.id,
      semesterNumber: v.section?.semester?.number,
      semesterName: v.section?.semester?.name,
      programId: v.section?.semester?.program?.id,
      programName: v.section?.semester?.program?.name,
      programCode: v.section?.semester?.program?.code,
      departmentId: v.section?.semester?.program?.department?.id,
      departmentName: v.section?.semester?.program?.department?.name,
      effectiveFrom: v.effectiveFrom,
    }));
  }

  async syncTimetableToSchedules(versionId?: string, startDateStr?: string, endDateStr?: string) {
    const whereClause: any = { isActive: true };
    if (versionId) whereClause.id = versionId;

    const versions = await this.prisma.timetableVersion.findMany({
      where: whereClause,
      include: {
        slots: {
          include: {
            subject: true,
            faculty: true,
            room: true,
          },
        },
        section: true,
      },
    });

    const dayToInt: Record<string, number> = {
      MON: 1, MONDAY: 1,
      TUE: 2, TUESDAY: 2,
      WED: 3, WEDNESDAY: 3,
      THU: 4, THURSDAY: 4,
      FRI: 5, FRIDAY: 5,
      SAT: 6, SATURDAY: 6,
      SUN: 7, SUNDAY: 7,
    };

    let templatesCreated = 0;
    let schedulesCreated = 0;

    // Default 14 days from today
    const start = startDateStr ? new Date(startDateStr) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = endDateStr ? new Date(endDateStr) : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);

    // Pre-fetch all existing templates into memory
    const existingTemplates = await this.prisma.scheduleTemplate.findMany();
    const templateMap = new Map<string, any>();
    for (const t of existingTemplates) {
      const key = `${t.sectionId}:${t.subjectId}:${t.facultyId}:${t.roomId}:${t.dayOfWeek}:${t.startTime}:${t.endTime}`;
      templateMap.set(key, t);
    }

    for (const version of versions) {
      for (const slot of version.slots) {
        const dayInt = dayToInt[slot.day.toUpperCase()] || 1;
        const startTime = slot.timeSlotStart.trim();
        const endTime = slot.timeSlotEnd.trim();
        const key = `${version.sectionId}:${slot.subjectId}:${slot.facultyId}:${slot.roomId}:${dayInt}:${startTime}:${endTime}`;

        if (!templateMap.has(key)) {
          const newTemplate = await this.prisma.scheduleTemplate.create({
            data: {
              sectionId: version.sectionId,
              subjectId: slot.subjectId,
              facultyId: slot.facultyId,
              roomId: slot.roomId,
              dayOfWeek: dayInt,
              startTime,
              endTime,
              effectiveFrom: version.effectiveFrom || new Date(),
            },
          });
          templateMap.set(key, newTemplate);
          templatesCreated++;
        }
      }
    }

    // Pre-fetch existing schedules in date range
    const existingSchedules = await this.prisma.schedule.findMany({
      where: {
        lectureDate: { gte: start, lte: end },
      },
      select: { templateId: true, lectureDate: true },
    });
    const scheduleSet = new Set<string>();
    for (const s of existingSchedules) {
      scheduleSet.add(`${s.templateId}:${s.lectureDate.toISOString().split('T')[0]}`);
    }

    const schedulesToCreate: any[] = [];
    for (const [, template] of templateMap.entries()) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const currentDayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
        if (currentDayOfWeek === template.dayOfWeek) {
          const dateStr = d.toISOString().split('T')[0];
          const schedKey = `${template.id}:${dateStr}`;
          if (!scheduleSet.has(schedKey)) {
            schedulesToCreate.push({
              templateId: template.id,
              lectureDate: new Date(dateStr),
              status: 'SCHEDULED',
            });
            scheduleSet.add(schedKey);
          }
        }
      }
    }

    if (schedulesToCreate.length > 0) {
      await this.prisma.schedule.createMany({
        data: schedulesToCreate,
        skipDuplicates: true,
      });
      schedulesCreated = schedulesToCreate.length;
    }

    return {
      success: true,
      message: `Synchronized ${templatesCreated} templates and generated ${schedulesCreated} daily lecture sessions.`,
      templatesCreated,
      schedulesCreated,
    };
  }

  async createTestLectureSession(params: {
    slotId?: string;
    scheduleId?: string;
    sectionId?: string;
  }) {
    let targetSchedule: any = null;
    let targetFacultyId: string | null = null;

    if (params.scheduleId) {
      targetSchedule = await this.prisma.schedule.findUnique({
        where: { id: params.scheduleId },
        include: {
          template: {
            include: {
              section: true,
              subject: true,
              faculty: { include: { user: true } },
              room: true,
            },
          },
        },
      });
      if (targetSchedule) {
        targetFacultyId = targetSchedule.template.facultyId;
      }
    }

    if (!targetSchedule && params.slotId) {
      const slot = await this.prisma.timetableSlot.findUnique({
        where: { id: params.slotId },
        include: {
          version: true,
          subject: true,
          faculty: true,
          room: true,
        },
      });

      if (slot) {
        targetFacultyId = slot.facultyId;
        const dayToInt: Record<string, number> = {
          MON: 1, MONDAY: 1, TUE: 2, TUESDAY: 2, WED: 3, WEDNESDAY: 3,
          THU: 4, THURSDAY: 4, FRI: 5, FRIDAY: 5, SAT: 6, SATURDAY: 6, SUN: 7, SUNDAY: 7,
        };
        const dayInt = dayToInt[slot.day.toUpperCase()] || 1;

        let template = await this.prisma.scheduleTemplate.findFirst({
          where: {
            sectionId: slot.version.sectionId,
            subjectId: slot.subjectId,
            facultyId: slot.facultyId,
            roomId: slot.roomId,
            dayOfWeek: dayInt,
            startTime: slot.timeSlotStart,
            endTime: slot.timeSlotEnd,
          },
        });

        if (!template) {
          template = await this.prisma.scheduleTemplate.create({
            data: {
              sectionId: slot.version.sectionId,
              subjectId: slot.subjectId,
              facultyId: slot.facultyId,
              roomId: slot.roomId,
              dayOfWeek: dayInt,
              startTime: slot.timeSlotStart,
              endTime: slot.timeSlotEnd,
              effectiveFrom: new Date(),
            },
          });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        targetSchedule = await this.prisma.schedule.findFirst({
          where: { templateId: template.id, lectureDate: today },
          include: {
            template: {
              include: { section: true, subject: true, faculty: true, room: true },
            },
          },
        });

        if (!targetSchedule) {
          targetSchedule = await this.prisma.schedule.create({
            data: {
              templateId: template.id,
              lectureDate: today,
              status: 'SCHEDULED',
            },
            include: {
              template: {
                include: { section: true, subject: true, faculty: true, room: true },
              },
            },
          });
        }
      }
    }

    // Fallback: pick any active slot from given section or system
    if (!targetSchedule) {
      let slotWhere: any = {};
      if (params.sectionId) {
        slotWhere = { version: { sectionId: params.sectionId, isActive: true } };
      } else {
        slotWhere = { version: { isActive: true } };
      }

      const anySlot = await this.prisma.timetableSlot.findFirst({
        where: slotWhere,
        include: {
          version: true,
          subject: true,
          faculty: true,
          room: true,
        },
      });

      if (anySlot) {
        return this.createTestLectureSession({ slotId: anySlot.id });
      } else {
        throw new BadRequestException('No active timetable slot found to create test lecture session.');
      }
    }

    if (!targetFacultyId) {
      const fallbackFaculty = await this.prisma.faculty.findFirst();
      targetFacultyId = fallbackFaculty?.id || '';
    }

    // Find or create AttendanceSession for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let session = await this.prisma.attendanceSession.findFirst({
      where: {
        scheduleId: targetSchedule.id,
        attendanceDate: today,
      },
      include: {
        records: {
          include: { student: true },
        },
      },
    });

    if (!session) {
      session = await this.prisma.attendanceSession.create({
        data: {
          scheduleId: targetSchedule.id,
          takenById: targetFacultyId,
          attendanceDate: today,
          status: 'OPEN',
        },
        include: {
          records: {
            include: { student: true },
          },
        },
      });
    }

    // Load active students
    const students = await this.prisma.student.findMany({
      where: { isActive: true },
      orderBy: { rollNumber: 'asc' },
    });

    return {
      success: true,
      message: 'Test lecture session ready for attendance demonstration.',
      schedule: targetSchedule,
      session,
      students: students.map((st) => {
        const rec = session.records.find((r) => r.studentId === st.id);
        return {
          id: st.id,
          rollNumber: st.rollNumber,
          collegeId: st.collegeId,
          firstName: st.firstName,
          lastName: st.lastName,
          photoKey: st.photoKey,
          currentStatus: rec?.status || 'PRESENT',
          recordId: rec?.id || null,
        };
      }),
    };
  }

  async addActiveSlot(versionId: string, dto: any) {
    const version = await this.prisma.timetableVersion.findUnique({
      where: { id: versionId },
      include: { section: { include: { semester: true } } },
    });
    if (!version) {
      throw new NotFoundException(`Timetable version with ID ${versionId} not found.`);
    }

    const subName = dto.subjectName || 'Subject';
    const subCode = (dto.subjectCode || subName.substring(0, 8)).toUpperCase();

    let subject = await this.prisma.subject.findFirst({
      where: {
        OR: [
          { code: { equals: subCode, mode: 'insensitive' } },
          { name: { equals: subName, mode: 'insensitive' } },
        ],
      },
    });
    if (subject) {
      subject = await this.prisma.subject.update({
        where: { id: subject.id },
        data: {
          code: subCode,
          name: subName,
        },
      });
    } else {
      const semNum = version.section?.semester?.number || 1;
      subject = await this.prisma.subject.create({
        data: {
          code: subCode,
          name: subName,
          year: Math.ceil(semNum / 2),
          semesterId: version.section.semesterId,
        },
      });
    }

    const roomCode = (dto.roomNumber || dto.room || 'L-101').trim();
    let room = await this.prisma.room.findFirst({
      where: { code: { equals: roomCode, mode: 'insensitive' } },
    });
    if (!room) {
      room = await this.prisma.room.create({
        data: { code: roomCode.toUpperCase(), name: `Room ${roomCode}` },
      });
    }

    let faculty = await this.prisma.faculty.findFirst({
      where: { firstName: { contains: dto.facultyName.split(' ')[0], mode: 'insensitive' } },
    });
    if (!faculty) {
      const facultyRole = await this.prisma.role.findFirst({ where: { code: 'FACULTY' } });
      const firstRole = await this.prisma.role.findFirst();
      const roleId = facultyRole ? facultyRole.id : firstRole!.id;
      const initials = dto.facultyName.split(' ').map((n) => n[0]).join('').toUpperCase().replace(/[^A-Z]/g, '');
      const employeeCode = `FAC-${initials}-${Math.floor(100 + Math.random() * 900)}`;
      const email = `${dto.facultyName.toLowerCase().replace(/[^a-z]/g, '')}@inca.edu`;
      const defaultPassHash = await bcrypt.hash('DefaultPass123!', 12);
      const user = await this.prisma.user.create({
        data: { email, password: defaultPassHash, roleId, mustChangePassword: true },
      });
      const names = dto.facultyName.replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '').split(' ');
      faculty = await this.prisma.faculty.create({
        data: { userId: user.id, employeeCode, firstName: names[0] || 'Faculty', lastName: names.slice(1).join(' ') || null, gender: 'OTHER', designation: 'Lecturer' },
      });
    }

    const dayMap: Record<string, string> = {
      Monday: 'MON', Tuesday: 'TUES', Wednesday: 'WED',
      Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT',
    };
    const dayInput = dto.dayOfWeek || dto.day || 'Monday';
    const dayCode = dayMap[dayInput] || dayInput.toUpperCase();
    const startTimeStr = dto.startTime || dto.timeSlotStart || '09:10 AM';
    const endTimeStr = dto.endTime || dto.timeSlotEnd || '10:05 AM';

    return this.prisma.timetableSlot.create({
      data: {
        versionId,
        day: dayCode,
        lectureNumber: dto.lectureNumber || 1,
        timeSlotStart: startTimeStr,
        timeSlotEnd: endTimeStr,
        subjectId: subject.id,
        facultyId: faculty.id,
        roomId: room.id,
        category: dto.category || 'academic',
        isLab: dto.isLab || false,
        batchSection: dto.batchSection || 'All',
      },
      include: { subject: true, faculty: true, room: true },
    });
  }

  async updateActiveSlot(slotId: string, dto: any) {
    const slot = await this.prisma.timetableSlot.findUnique({
      where: { id: slotId },
      include: { subject: true, version: { include: { section: { include: { semester: true } } } } },
    });
    if (!slot) {
      throw new NotFoundException(`Timetable slot with ID ${slotId} not found.`);
    }

    let subjectId = slot.subjectId;
    if (dto.subjectName || dto.subjectCode) {
      const subName = dto.subjectName || slot.subject.name;
      const subCode = (dto.subjectCode || slot.subject.code || subName.substring(0, 8)).toUpperCase();

      let subject = await this.prisma.subject.findFirst({
        where: {
          OR: [
            { code: { equals: subCode, mode: 'insensitive' } },
            { name: { equals: subName, mode: 'insensitive' } },
            { id: slot.subjectId },
          ],
        },
      });

      if (subject) {
        subject = await this.prisma.subject.update({
          where: { id: subject.id },
          data: {
            code: subCode,
            name: subName,
          },
        });
      } else {
        const semNum = slot.version?.section?.semester?.number || 1;
        subject = await this.prisma.subject.create({
          data: {
            code: subCode,
            name: subName,
            year: Math.ceil(semNum / 2),
            semesterId: slot.version.section.semesterId,
          },
        });
      }
      subjectId = subject.id;
    }

    let roomId = slot.roomId;
    const roomCode = dto.roomNumber || dto.room;
    if (roomCode) {
      let room = await this.prisma.room.findFirst({
        where: { code: { equals: roomCode, mode: 'insensitive' } },
      });
      if (!room) {
        room = await this.prisma.room.create({
          data: { code: roomCode.toUpperCase(), name: `Room ${roomCode}` },
        });
      }
      roomId = room.id;
    }

    let facultyId = slot.facultyId;
    if (dto.facultyName) {
      let faculty = await this.prisma.faculty.findFirst({
        where: { firstName: { contains: dto.facultyName.split(' ')[0], mode: 'insensitive' } },
      });
      if (!faculty) {
        const facultyRole = await this.prisma.role.findFirst({ where: { code: 'FACULTY' } });
        const firstRole = await this.prisma.role.findFirst();
        const roleId = facultyRole ? facultyRole.id : firstRole!.id;
        const initials = dto.facultyName.split(' ').map((n) => n[0]).join('').toUpperCase().replace(/[^A-Z]/g, '');
        const employeeCode = `FAC-${initials}-${Math.floor(100 + Math.random() * 900)}`;
        const email = `${dto.facultyName.toLowerCase().replace(/[^a-z]/g, '')}@inca.edu`;
        const defaultPassHash = await bcrypt.hash('DefaultPass123!', 12);
        const user = await this.prisma.user.create({
          data: { email, password: defaultPassHash, roleId, mustChangePassword: true },
        });
        const names = dto.facultyName.replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '').split(' ');
        faculty = await this.prisma.faculty.create({
          data: { userId: user.id, employeeCode, firstName: names[0] || 'Faculty', lastName: names.slice(1).join(' ') || null, gender: 'OTHER', designation: 'Lecturer' },
        });
      }
      facultyId = faculty.id;
    }

    const dayMap: Record<string, string> = {
      Monday: 'MON', Tuesday: 'TUES', Wednesday: 'WED',
      Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT',
    };
    const dayInput = dto.dayOfWeek || dto.day;
    const dayCode = dayInput ? (dayMap[dayInput] || dayInput.toUpperCase()) : slot.day;
    const startTimeStr = dto.startTime !== undefined ? dto.startTime : (dto.timeSlotStart !== undefined ? dto.timeSlotStart : slot.timeSlotStart);
    const endTimeStr = dto.endTime !== undefined ? dto.endTime : (dto.timeSlotEnd !== undefined ? dto.timeSlotEnd : slot.timeSlotEnd);

    return this.prisma.timetableSlot.update({
      where: { id: slotId },
      data: {
        day: dayCode,
        lectureNumber: dto.lectureNumber !== undefined ? dto.lectureNumber : slot.lectureNumber,
        timeSlotStart: startTimeStr,
        timeSlotEnd: endTimeStr,
        subjectId,
        facultyId,
        roomId,
        category: dto.category !== undefined ? dto.category : slot.category,
        isLab: dto.isLab !== undefined ? dto.isLab : slot.isLab,
        batchSection: dto.batchSection !== undefined ? dto.batchSection : slot.batchSection,
      },
      include: { subject: true, faculty: true, room: true },
    });
  }

  async deleteActiveSlot(slotId: string) {
    const slot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId } });
    if (!slot) {
      throw new NotFoundException(`Timetable slot with ID ${slotId} not found.`);
    }

    return this.prisma.timetableSlot.delete({
      where: { id: slotId },
    });
  }

  async rollbackVersion(versionId: string) {
    const version = await this.prisma.timetableVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) {
      throw new NotFoundException(`Timetable version with ID ${versionId} not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.timetableVersion.updateMany({
        where: { sectionId: version.sectionId, isActive: true },
        data: { isActive: false },
      });

      const rolled = await tx.timetableVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      });

      if (rolled.importBatchId) {
        await tx.timetableImportBatch.update({
          where: { id: rolled.importBatchId },
          data: { status: 'ROLLED_BACK' },
        });
      }

      return rolled;
    });
  }

  async getVersionHistory(sectionId: string) {
    return this.prisma.timetableVersion.findMany({
      where: { sectionId },
      include: {
        slots: {
          include: {
            subject: true,
            faculty: true,
            room: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllBatches() {
    return this.prisma.timetableImportBatch.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    return this.storageService.getFile(key);
  }
}
