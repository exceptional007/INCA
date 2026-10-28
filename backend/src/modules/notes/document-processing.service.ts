import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { NoteSourceType, NoteStatus } from '@prisma/client';

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: StrictR2StorageService,
  ) {}

  /**
   * Process a learning note asynchronously in the background.
   */
  async processNoteAsync(noteId: string): Promise<void> {
    try {
      this.logger.log(`Starting document processing for note ${noteId}...`);
      await this.processNote(noteId);
    } catch (err: any) {
      this.logger.error(`Document processing failed for note ${noteId}: ${err?.message}`, err?.stack);
      await this.prisma.learningNote.update({
        where: { id: noteId },
        data: {
          status: NoteStatus.FAILED,
          aiReady: false,
          processingError: err?.message || 'Document processing failed unexpectedly.',
        },
      }).catch((dbErr) => this.logger.error(`Failed to update note status: ${dbErr?.message}`));
    }
  }

  /**
   * Main processing pipeline.
   */
  async processNote(noteId: string): Promise<{ success: boolean; chunkCount: number }> {
    const note = await this.prisma.learningNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Update status to PROCESSING
    await this.prisma.learningNote.update({
      where: { id: noteId },
      data: {
        status: NoteStatus.PROCESSING,
        processingError: null,
      },
    });

    let extractedText = '';
    let pageCount = 1;

    if (note.sourceType === NoteSourceType.FILE) {
      if (!note.storageKey) {
        throw new Error('Note is configured as FILE but has no storageKey in Cloudflare R2.');
      }

      const fileBuffer = await this.r2Storage.getObjectBuffer(note.storageKey);
      const ext = (note.originalFilename?.split('.').pop() || '').toLowerCase();
      const mime = note.mimeType || '';

      if (ext === 'pdf' || mime.includes('pdf')) {
        const result = await this.extractTextFromPdf(fileBuffer);
        extractedText = result.text;
        pageCount = result.pages;
      } else if (ext === 'docx' || mime.includes('wordprocessingml') || mime.includes('officedocument')) {
        extractedText = await this.extractTextFromDocx(fileBuffer);
      } else {
        throw new Error(`Unsupported document format: ${ext || mime}. INCA supports PDF and DOCX files.`);
      }
    } else if (note.sourceType === NoteSourceType.DRIVE) {
      if (!note.driveUrl) {
        throw new Error('Note is configured as DRIVE but no driveUrl was provided.');
      }

      const driveExtraction = await this.extractTextFromGoogleDrive(note.driveUrl);
      if (!driveExtraction.success || !driveExtraction.text || driveExtraction.text.trim().length < 50) {
        // Drive link requires private permissions or is inaccessible for automated indexing
        await this.prisma.learningNote.update({
          where: { id: noteId },
          data: {
            status: note.status === NoteStatus.DRAFT ? NoteStatus.DRAFT : NoteStatus.PUBLISHED,
            aiReady: false,
            processingError: driveExtraction.error || 'Google Drive document requires authentication or is restricted. AI tutor indexing is unavailable, but students can view the direct Drive link.',
          },
        });
        return { success: false, chunkCount: 0 };
      }
      extractedText = driveExtraction.text;
    }

    // Validate extracted text
    const cleanText = this.normalizeText(extractedText);
    if (!cleanText || cleanText.length < 50) {
      const errorMsg = 'Extracted text is empty or too short. The document may be scanned, image-only, or password protected. Please provide a text-based document for AI tutoring.';
      await this.prisma.learningNote.update({
        where: { id: noteId },
        data: {
          status: NoteStatus.FAILED,
          aiReady: false,
          processingError: errorMsg,
        },
      });
      return { success: false, chunkCount: 0 };
    }

    // Chunk text
    const chunks = this.chunkText(cleanText, pageCount);
    if (chunks.length === 0) {
      throw new Error('Failed to create text chunks from document.');
    }

    // Invalidate and delete previous chunks if document was replaced
    await this.prisma.learningNoteChunk.deleteMany({
      where: { noteId },
    });

    // Save chunks to database
    await this.prisma.learningNoteChunk.createMany({
      data: chunks.map((c, idx) => ({
        noteId,
        chunkIndex: idx,
        content: c.content,
        pageNumber: c.pageNumber,
        tokenCount: Math.ceil(c.content.length / 4),
        metadata: { wordCount: c.content.split(/\s+/).length },
      })),
    });

    // Mark as ready and publish if not draft
    const finalStatus = note.status === NoteStatus.DRAFT ? NoteStatus.DRAFT : NoteStatus.PUBLISHED;
    await this.prisma.learningNote.update({
      where: { id: noteId },
      data: {
        status: finalStatus,
        aiReady: true,
        processingError: null,
      },
    });

    this.logger.log(`Document processing complete for note ${noteId}: ${chunks.length} chunks indexed.`);
    return { success: true, chunkCount: chunks.length };
  }

  /**
   * PDF Text Extraction via pdf-parse.
   */
  private async extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
    let parser: any = null;
    try {
      const pdfParseModule = require('pdf-parse');
      const PDFParseClass = pdfParseModule.PDFParse || pdfParseModule.default?.PDFParse || pdfParseModule;
      parser = new PDFParseClass({ data: buffer });
      const result = await parser.getText();
      const text = result?.text || '';
      const pages = result?.numpages || 1;
      return { text, pages };
    } catch (err: any) {
      this.logger.warn(`pdf-parse text extraction failed: ${err?.message}`);
      return { text: '', pages: 1 };
    } finally {
      if (parser && typeof parser.destroy === 'function') {
        try {
          await parser.destroy();
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * DOCX Text Extraction via mammoth.
   */
  private async extractTextFromDocx(buffer: Buffer): Promise<string> {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result?.value || '';
    } catch (err: any) {
      this.logger.warn(`mammoth docx extraction failed: ${err?.message}`);
      throw new Error(`Failed to extract text from DOCX: ${err?.message}`);
    }
  }

  /**
   * Google Drive text extraction attempt with graceful fallback.
   */
  private async extractTextFromGoogleDrive(driveUrl: string): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      // Check for valid Google Drive URL patterns
      const fileIdMatch = driveUrl.match(/(?:file\/d\/|open\?id=|document\/d\/)([a-zA-Z0-9_-]+)/i);
      if (!fileIdMatch || !fileIdMatch[1]) {
        return {
          success: false,
          error: 'Invalid Google Drive URL. Please provide a standard Google Drive or Docs link.',
        };
      }

      const fileId = fileIdMatch[1];
      const isGoogleDoc = driveUrl.includes('/document/d/');

      let exportUrl = '';
      if (isGoogleDoc) {
        exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
      } else {
        exportUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }

      const response = await fetch(exportUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Google Drive file requires user permissions or sign-in. Public document text could not be extracted directly.',
        };
      }

      const data = await response.text();
      if (typeof data === 'string' && !data.includes('<!DOCTYPE html>') && data.trim().length > 50) {
        return { success: true, text: data };
      }

      return {
        success: false,
        error: 'Google Drive file requires user permissions or sign-in. Public document text could not be extracted directly.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'Google Drive file requires authentication or is restricted. AI tutor indexing is unavailable, but students can view the direct Drive link.',
      };
    }
  }

  /**
   * Text normalization: cleans extra whitespace while preserving paragraph breaks.
   */
  private normalizeText(rawText: string): string {
    if (!rawText) return '';
    return rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Semantic chunking with page awareness.
   */
  private chunkText(text: string, estimatedPages: number): Array<{ content: string; pageNumber: number }> {
    // If text contains form feeds (\f), split by page
    const rawPages = text.split('\f');
    const chunks: Array<{ content: string; pageNumber: number }> = [];

    const CHUNK_SIZE_CHARS = 1800; // ~350-450 words
    const CHUNK_OVERLAP_CHARS = 250;

    if (rawPages.length > 1) {
      rawPages.forEach((pageContent, pageIndex) => {
        const pageNum = pageIndex + 1;
        const pageTrimmed = pageContent.trim();
        if (!pageTrimmed) return;

        if (pageTrimmed.length <= CHUNK_SIZE_CHARS) {
          chunks.push({ content: pageTrimmed, pageNumber: pageNum });
        } else {
          // Split large page into multiple overlapping chunks
          let start = 0;
          while (start < pageTrimmed.length) {
            const end = Math.min(start + CHUNK_SIZE_CHARS, pageTrimmed.length);
            const chunkSlice = pageTrimmed.slice(start, end).trim();
            if (chunkSlice.length > 50) {
              chunks.push({ content: chunkSlice, pageNumber: pageNum });
            }
            if (end >= pageTrimmed.length) break;
            start += CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS;
          }
        }
      });
    } else {
      // Continuous document: divide into chunks with estimated page numbers
      const paragraphs = text.split('\n\n');
      let currentChunk = '';
      let currentWords = 0;
      let totalWordsSoFar = 0;
      const totalWords = text.split(/\s+/).length;

      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        const paraWords = trimmed.split(/\s+/).length;
        if (currentChunk.length + trimmed.length > CHUNK_SIZE_CHARS && currentChunk.length > 100) {
          const estimatedPage = Math.min(
            estimatedPages,
            Math.max(1, Math.round((totalWordsSoFar / Math.max(1, totalWords)) * estimatedPages)),
          );
          chunks.push({ content: currentChunk.trim(), pageNumber: estimatedPage });

          // Start new chunk with overlap if possible
          const words = currentChunk.split(/\s+/);
          const overlap = words.slice(Math.max(0, words.length - 25)).join(' ');
          currentChunk = overlap + '\n\n' + trimmed;
          currentWords = overlap.split(/\s+/).length + paraWords;
        } else {
          currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
          currentWords += paraWords;
        }
        totalWordsSoFar += paraWords;
      }

      if (currentChunk.trim().length > 50) {
        chunks.push({ content: currentChunk.trim(), pageNumber: estimatedPages || 1 });
      }
    }

    return chunks;
  }
}
