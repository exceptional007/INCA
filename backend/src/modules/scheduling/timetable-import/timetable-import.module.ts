import { Module } from '@nestjs/common';
import { TimetableImportController } from './timetable-import.controller';
import { TimetableImportService } from './timetable-import.service';
import { R2StorageService } from './r2-storage.service';
import { GeminiExtractionService } from './gemini-extraction.service';
import { PdfTextParserService } from './pdf-text-parser.service';
import { MatchingService } from './matching.service';
import { ConflictService } from './conflict.service';

@Module({
  controllers: [TimetableImportController],
  providers: [
    TimetableImportService,
    R2StorageService,
    GeminiExtractionService,
    PdfTextParserService,
    MatchingService,
    ConflictService,
  ],
  exports: [
    TimetableImportService,
    R2StorageService,
    GeminiExtractionService,
    PdfTextParserService,
    MatchingService,
    ConflictService,
  ],
})
export class TimetableImportModule {}
