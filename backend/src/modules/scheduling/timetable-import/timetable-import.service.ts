import { Path2D } from '@napi-rs/canvas';
(global as any).Path2D = Path2D;
import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import { GeminiExtractionService } from './gemini-extraction.service';
import { MatchingService } from './matching.service';
import { ConflictService, ConflictDetail } from './conflict.service';
import { CreateDraftSlotDto } from './dto/create-draft-slot.dto';
import { UpdateDraftSlotDto } from './dto/update-draft-slot.dto';


import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { ImportBatchStatus } from '@prisma/client';

@Injectable()
export class TimetableImportService {
  private readonly logger = new Logger(TimetableImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: R2StorageService,
    private readonly extractionService: GeminiExtractionService,
    private readonly matchingService: MatchingService,
    private readonly conflictService: ConflictService,
  ) {}


  private async extractPageTexts(pdfBuffer: Buffer): Promise<string[]> {
    const pdfjsPath = require('path').join(process.cwd(), 'node_modules/pdf-to-png-converter/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
    const { getDocument } = await import(`file://${pdfjsPath.replace(/\\/g, '/')}`);
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
  }

  async uploadAndProcess(
    fileBuffer: Buffer,
    filename: string,
    userId: string,
  ) {
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

    // 3. Render pages to PNG
    this.logger.log('Rendering PDF pages to PNG...');
    let pngPages: any[] = [];
    try {
      const { pdfToPng } = await import('pdf-to-png-converter');
      pngPages = await pdfToPng(fileBuffer, { viewportScale: 2.0 });
    } catch (err) {
      this.logger.error('Failed to convert PDF to PNG pages', err);
      throw new BadRequestException('Failed to process PDF pages into images.');
    }

    // 4. Extract raw text from PDF
    this.logger.log('Extracting raw text from PDF...');
    let pageTexts: string[] = [];
    try {
      pageTexts = await this.extractPageTexts(fileBuffer);
    } catch (err) {
      this.logger.error('Failed to extract PDF text', err);
    }

    // 5. Create Batch record
    const batch = await this.prisma.timetableImportBatch.create({
      data: {
        uploadedByUserId: userId,
        sourceFileR2Key: uploadedKey,
        status: 'UPLOADED',
        notes: isDuplicate ? 'DUPLICATE_WARNING' : null,
      },
    });

    // 6. Process Page PNGs and store them
    const pagesMetadata: any[] = [];
    for (let i = 0; i < pngPages.length; i++) {
      const page = pngPages[i];
      const pageText = pageTexts[i] || '';
      const pngKey = await this.storageService.uploadFile(
        page.content,
        `batch-${batch.id}-page-${page.pageNumber}.png`,
        'image/png',
      );
      pagesMetadata.push({
        pageNumber: page.pageNumber,
        imageR2Key: pngKey,
        rawText: pageText,
      });
    }

    await this.prisma.timetableImportBatch.update({
      where: { id: batch.id },
      data: {
        pagesJson: pagesMetadata,
      },
    });

    // 7. Kick off AI Extraction & Matching asynchronously
    this.runExtractionAndMatching(batch.id, pagesMetadata).catch((err) => {
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

  private async runExtractionAndMatching(batchId: string, pagesMetadata: any[]) {
    this.logger.log(`Starting background extraction and matching for batch ${batchId}...`);
    try {
      for (const page of pagesMetadata) {
        const imageBuffer = await this.storageService.getFile(page.imageR2Key);
        
        let header;
        let gridData;
        try {
          // Pass 1: Header extraction
          header = await this.extractionService.extractHeader(imageBuffer, page.rawText);
          
          // Pass 2: Grid extraction
          gridData = await this.extractionService.extractGrid(imageBuffer, page.rawText, header);
        } catch (err) {
          this.logger.error(`AI Extraction failed for page ${page.pageNumber} in batch ${batchId}`, err);
          await this.prisma.timetableImportBatch.update({
            where: { id: batchId },
            data: { status: 'EXTRACTION_FAILED', notes: `Extraction failed on page ${page.pageNumber}: ${err.message}` },
          });
          return;
        }

        // Parse semester number from string (e.g. "7TH" -> 7)
        const semNumberMatch = header.semester.match(/(\d+)/);
        const semesterNum = semNumberMatch ? parseInt(semNumberMatch[1], 10) : undefined;
        const deptCode = header.department;

        // Save Extracted Slots
        for (const slot of gridData.slots) {
          // Normalize day to match UPPERCASE
          const day = slot.day.toUpperCase().trim();

          const draft = await this.prisma.timetableSlotDraft.create({
            data: {
              batchId,
              gridId: gridData.gridId || `${header.department}-${header.section}`,
              day,
              timeSlotStart: slot.timeSlotStart,
              timeSlotEnd: slot.timeSlotEnd,
              isMergedSlot: slot.isMergedSlot,
              sectionCodes: slot.sectionCodes,
              subjectRaw: slot.subjectName || slot.subjectCode,
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
            
            // Map section
            let matchedSectionId: string | null = null;
            let sectionConfidence = 0;
            if (slot.sectionCodes && slot.sectionCodes.length > 0) {
              const sectCode = slot.sectionCodes[0];
              const sectionMatch = await this.matchingService.matchSection(sectCode, semesterNum, deptCode);
              matchedSectionId = sectionMatch.matchedId;
              sectionConfidence = sectionMatch.confidence;
            }

            // Calculate overall matchConfidence as average
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
      }

      // Mark batch as pending review
      await this.prisma.timetableImportBatch.update({
        where: { id: batchId },
        data: { status: 'PENDING_REVIEW' },
      });
      this.logger.log(`Batch ${batchId} successfully completed Stage 2 & 3: PENDING_REVIEW`);
    } catch (err) {
      this.logger.error(`Fatal background processing error for batch ${batchId}`, err);
      await this.prisma.timetableImportBatch.update({
        where: { id: batchId },
        data: { status: 'EXTRACTION_FAILED', notes: `Fatal error: ${err.message}` },
      });
    }
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

    return this.prisma.timetableSlotDraft.update({
      where: { id: slotId },
      data: {
        ...data,
        adminEdited: true,
      },
    });
  }

  async addDraftSlot(id: string, data: CreateDraftSlotDto) {
    const batch = await this.prisma.timetableImportBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found.`);
    }

    return this.prisma.timetableSlotDraft.create({
      data: {
        batchId: id,
        ...data,
        rawCellText: data.rawCellText ?? '',
        adminEdited: true,
      },
    });
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

  async approveAndCommit(id: string) {
    const batch = await this.getBatchDetails(id);
    if (batch.status === 'COMMITTED') {
      throw new BadRequestException('Batch is already committed.');
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
      sectionName: s.version.sectionId, // fallback section ID/name representation
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
      const result = await this.prisma.$transaction(async (tx) => {
        // We will cache newly created entities within transaction
        const subjectCache = new Map<string, string>();
        const facultyCache = new Map<string, string>();
        const roomCache = new Map<string, string>();
        const sectionCache = new Map<string, string>();

        const facultyRole = await tx.role.findUnique({
          where: { code: 'FACULTY' },
        });

        // Loop through slot drafts and create missing
        for (const slot of slots) {
          // 1. Resolve Section
          let sectionId = slot.matchedSectionId;
          if (!sectionId && slot.sectionCodes && slot.sectionCodes.length > 0) {
            const secCode = slot.sectionCodes[0].trim().toUpperCase();
            if (sectionCache.has(secCode)) {
              sectionId = sectionCache.get(secCode) || null;
            } else {
              // Exact database check
              let dbSec = await tx.section.findFirst({
                where: { name: secCode },
              });
              if (!dbSec) {
                // Find a default batch and semester to link Section to
                const defaultSemester = await tx.semester.findFirst();
                const defaultBatch = await tx.batch.findFirst();
                if (!defaultSemester || !defaultBatch) {
                  throw new BadRequestException('Cannot auto-create Section without Batch or Semester in DB.');
                }
                dbSec = await tx.section.create({
                  data: {
                    name: secCode,
                    batchId: defaultBatch.id,
                    semesterId: defaultSemester.id,
                  },
                });
              }
              sectionId = dbSec.id;
              sectionCache.set(secCode, sectionId);
            }
          }

          if (!sectionId) {
            throw new BadRequestException(`Could not match or resolve Section for slot: ${slot.rawCellText}`);
          }

          // Fetch Section to get semester/program details for Subject
          const section = await tx.section.findUnique({
            where: { id: sectionId },
            include: { batch: true },
          });
          if (!section) {
            throw new BadRequestException(`Section with ID ${sectionId} not found.`);
          }
          const semesterId = section.semesterId;
          const programId = section.batch.programId;

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
                dbSub = await tx.subject.create({
                  data: {
                    code: subCode,
                    name: subClean,
                    credits: 3, // default
                    programId,
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
              // Generate employee code
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
                // Create user
                const email = `${facClean.toLowerCase().replace(/[^a-z]/g, '')}@inca.edu`;
                const defaultPassHash = await bcrypt.hash('DefaultPass123!', 12);
                
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

          // Update the slot draft mapping for transaction processing
          slot.matchedSectionId = sectionId;
          slot.matchedSubjectId = subjectId;
          slot.matchedFacultyId = facultyId;
          slot.matchedRoomId = roomId;
        }

        // Commit as new versions for each section
        const uniqueSectionIds = Array.from(new Set(slots.map((s) => s.matchedSectionId).filter((s): s is string => !!s)));
        const createdVersions: any[] = [];

        for (const secId of uniqueSectionIds) {
          // Deactivate current active timetable version
          await tx.timetableVersion.updateMany({
            where: { sectionId: secId, isActive: true },
            data: { isActive: false },
          });

          // Create new version
          const version = await tx.timetableVersion.create({
            data: {
              sectionId: secId,
              isActive: true,
              importBatchId: id,
              effectiveFrom: new Date(),
            },
          });

          // Filter slots belonging to this section
          const sectionSlots = slots.filter((s) => s.matchedSectionId === secId);
          for (const s of sectionSlots) {
            if (!s.matchedSubjectId || !s.matchedFacultyId || !s.matchedRoomId) {
              throw new BadRequestException('All slot drafts must have resolved Subject, Faculty, and Room before approval.');
            }
            await tx.timetableSlot.create({
              data: {
                versionId: version.id,
                day: s.day,
                timeSlotStart: s.timeSlotStart,
                timeSlotEnd: s.timeSlotEnd,
                subjectId: s.matchedSubjectId,
                facultyId: s.matchedFacultyId,
                roomId: s.matchedRoomId,
                category: s.category,
              },
            });
          }
          createdVersions.push(version);
        }

        // Mark batch as committed
        await tx.timetableImportBatch.update({
          where: { id },
          data: { status: 'COMMITTED', committedAt: new Date() },
        });

        return createdVersions;
      });

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

  async rollbackVersion(versionId: string) {
    const version = await this.prisma.timetableVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) {
      throw new NotFoundException(`Timetable version with ID ${versionId} not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Deactivate all active versions for this section
      await tx.timetableVersion.updateMany({
        where: { sectionId: version.sectionId, isActive: true },
        data: { isActive: false },
      });

      // Activate this specific version
      const rolled = await tx.timetableVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      });

      // Update import batch status if exists
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
