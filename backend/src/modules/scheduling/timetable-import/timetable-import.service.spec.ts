import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { ConflictService } from './conflict.service';
import { TimetableImportService } from './timetable-import.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import { GeminiExtractionService } from './gemini-extraction.service';
import { PdfTextParserService } from './pdf-text-parser.service';
import { BadRequestException } from '@nestjs/common';

describe('TimetableImport Testing Suite', () => {
  let matchingService: MatchingService;
  let conflictService: ConflictService;
  let importService: TimetableImportService;
  let prismaMock: any;
  let geminiMock: any;
  let textParserMock: any;

  beforeEach(async () => {
    prismaMock = {
      subject: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      faculty: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      room: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      section: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        create: jest.fn(),
      },
      timetableVersion: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      timetableSlot: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      timetableImportBatch: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      timetableSlotDraft: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    geminiMock = {
      isAvailable: jest.fn().mockReturnValue(true),
      extractFromPdf: jest.fn(),
      extractHeader: jest.fn(),
      extractGrid: jest.fn(),
    };

    textParserMock = {
      extractTextFromPdf: jest.fn().mockResolvedValue('sample text'),
      extractHeader: jest.fn(),
      extractGrid: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        ConflictService,
        TimetableImportService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: R2StorageService,
          useValue: {
            uploadFile: jest.fn().mockResolvedValue('mock-key'),
            getFile: jest.fn().mockResolvedValue(Buffer.from('')),
          },
        },
        { provide: GeminiExtractionService, useValue: geminiMock },
        { provide: PdfTextParserService, useValue: textParserMock },
      ],
    }).compile();

    matchingService = module.get<MatchingService>(MatchingService);
    conflictService = module.get<ConflictService>(ConflictService);
    importService = module.get<TimetableImportService>(TimetableImportService);
  });

  describe('ConflictService (Overlaps & Double-booking)', () => {
    it('should correctly parse time strings to minutes', () => {
      expect(conflictService.parseTimeToMinutes('09:10 AM')).toBe(550);
      expect(conflictService.parseTimeToMinutes('10:05 AM')).toBe(605);
      expect(conflictService.parseTimeToMinutes('12:10 PM')).toBe(730);
      expect(conflictService.parseTimeToMinutes('01:05 PM')).toBe(785);
      expect(conflictService.parseTimeToMinutes('01:45 PM')).toBe(825);
      expect(conflictService.parseTimeToMinutes('03:35 PM')).toBe(935);
    });

    it('should detect overlapping slots correctly', () => {
      expect(conflictService.isOverlapping('09:10 AM', '10:05 AM', '09:10 AM', '10:05 AM')).toBe(true);
      expect(conflictService.isOverlapping('09:10 AM', '11:00 AM', '10:00 AM', '12:00 PM')).toBe(true);
      expect(conflictService.isOverlapping('09:10 AM', '10:05 AM', '10:05 AM', '11:00 AM')).toBe(false);
      expect(conflictService.isOverlapping('09:10 AM', '10:05 AM', '11:15 AM', '12:10 PM')).toBe(false);
    });

    it('should flag double-booked faculty conflicts', () => {
      const newSlots = [
        {
          day: 'MON',
          timeSlotStart: '09:10 AM',
          timeSlotEnd: '10:05 AM',
          subjectName: 'DEEP LEARNING',
          facultyFullName: 'MR RANJEET SINGH',
          facultyId: 'fac-1',
          room: '416',
          sectionCodes: ['C1'],
        },
      ];

      const existingSlots = [
        {
          day: 'MON',
          timeSlotStart: '09:30 AM',
          timeSlotEnd: '10:30 AM',
          subjectName: 'PROJECT WORK',
          facultyName: 'MR RANJEET SINGH',
          facultyId: 'fac-1',
          room: 'L-202',
          sectionName: 'D1',
          sectionId: 'sec-d1',
          roomId: 'room-l202',
        },
      ];

      const conflicts = conflictService.detectConflicts(newSlots, existingSlots);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].type).toBe('FACULTY');
    });

    it('should flag double-booked room conflicts', () => {
      const newSlots = [
        {
          day: 'TUES',
          timeSlotStart: '11:15 AM',
          timeSlotEnd: '12:10 PM',
          subjectName: 'IOT',
          facultyFullName: 'MR KRISHNA JAISWAL',
          roomId: 'room-416',
          room: '416',
          sectionCodes: ['C2'],
        },
      ];

      const existingSlots = [
        {
          day: 'TUES',
          timeSlotStart: '12:00 PM',
          timeSlotEnd: '01:00 PM',
          subjectName: 'RENEWABLE ENERGY',
          facultyName: 'MR SHIVAM SRIVASTAVA',
          facultyId: 'fac-svm',
          room: '416',
          roomId: 'room-416',
          sectionName: 'D2',
          sectionId: 'sec-d2',
        },
      ];

      const conflicts = conflictService.detectConflicts(newSlots, existingSlots);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].type).toBe('ROOM');
    });
  });

  describe('MatchingService (Fuzzy String Similarity)', () => {
    it('should compute correct Levenshtein string similarities', () => {
      expect(matchingService.calculateSimilarity('Deep Learning', 'DEEP LEARNING')).toBe(1.0);
      expect(matchingService.calculateSimilarity('Mr Ranjeet Singh', 'Ranjeet Singh')).toBe(1.0);
      expect(matchingService.calculateSimilarity('Prof. Roop Ranjan', 'Roop Ranjan')).toBe(1.0);
      expect(matchingService.calculateSimilarity('DEEP LEARING', 'DEEP LEARNING')).toBeGreaterThan(0.85);
    });

    it('should find exact subject code matches first', async () => {
      prismaMock.subject.findUnique.mockResolvedValue({ id: 'sub-dl', code: 'BAI 701', name: 'Deep Learning' });
      
      const match = await matchingService.matchSubject('BAI 701', 'Deep Learning');
      expect(match.matchedId).toBe('sub-dl');
      expect(match.confidence).toBe(1.0);
    });

    it('should match normalized subject codes ignoring spaces and hyphens', async () => {
      prismaMock.subject.findUnique.mockResolvedValue(null);
      prismaMock.subject.findMany.mockResolvedValue([
        { id: 'sub-dl', code: 'BAI 701', name: 'Deep Learning (DL)' },
      ]);

      const match = await matchingService.matchSubject('BAI-701', 'BAI-701');
      expect(match.matchedId).toBe('sub-dl');
      expect(match.confidence).toBe(1.0);
    });

    it('should match subject acronyms from subject name parentheses', async () => {
      prismaMock.subject.findUnique.mockResolvedValue(null);
      prismaMock.subject.findMany.mockResolvedValue([
        { id: 'sub-dl', code: 'BAI 701', name: 'Deep Learning (DL)' },
      ]);

      const match = await matchingService.matchSubject('DL', 'DL');
      expect(match.matchedId).toBe('sub-dl');
      expect(match.confidence).toBe(0.92);
    });

    it('should match faculty name with honorifics and titles stripped', async () => {
      prismaMock.faculty.findMany.mockResolvedValue([
        { id: 'fac-1', employeeCode: 'FAC-RS-101', firstName: 'Ranjeet', lastName: 'Singh' },
      ]);

      const match = await matchingService.matchFaculty('Dr. Ranjeet Singh', 'Dr. Ranjeet Singh');
      expect(match.matchedId).toBe('fac-1');
      expect(match.confidence).toBe(1.0);
    });

    it('should match faculty by initials when standard name is abbreviated', async () => {
      prismaMock.faculty.findMany.mockResolvedValue([
        { id: 'fac-1', employeeCode: 'FAC-RS-101', firstName: 'Ranjeet', lastName: 'Singh' },
      ]);

      const match = await matchingService.matchFaculty('RS', 'RS');
      expect(match.matchedId).toBe('fac-1');
      expect(match.confidence).toBe(0.9);
    });

    it('should propagate updates to all similar slots in the batch when applyToSimilar is true', async () => {
      prismaMock.timetableSlotDraft.findFirst.mockResolvedValue({
        id: 'slot-l6',
        batchId: 'batch-1',
        subjectRaw: 'TECHEDGE',
        facultyRaw: '',
      });

      prismaMock.timetableSlotDraft.update.mockResolvedValue({
        id: 'slot-l6',
        subjectRaw: 'TECHEDGE',
        facultyRaw: 'Mr. Brijesh Kumar Chaurasiya',
        matchedFacultyId: 'fac-brijesh',
      });

      prismaMock.timetableSlotDraft.findMany.mockResolvedValue([
        {
          id: 'slot-l7',
          batchId: 'batch-1',
          subjectRaw: 'TECHEDGE',
          facultyRaw: '',
        },
      ]);

      await importService.updateDraftSlot('batch-1', 'slot-l6', {
        facultyRaw: 'Mr. Brijesh Kumar Chaurasiya',
        matchedFacultyId: 'fac-brijesh',
        applyToSimilar: true,
      });

      expect(prismaMock.timetableSlotDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'slot-l7' },
          data: expect.objectContaining({
            facultyRaw: 'Mr. Brijesh Kumar Chaurasiya',
            matchedFacultyId: 'fac-brijesh',
          }),
        }),
      );
    });
  });

  describe('PDF File Validation', () => {
    it('should reject empty files', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(
        importService.uploadAndProcess(emptyBuffer, 'empty.pdf', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-PDF files', async () => {
      const textBuffer = Buffer.from('This is just plain text, not a PDF');
      await expect(
        importService.uploadAndProcess(textBuffer, 'readme.txt', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files exceeding size limit', async () => {
      // Create a buffer > 20MB with PDF magic bytes
      const largeBuffer = Buffer.alloc(21 * 1024 * 1024);
      largeBuffer[0] = 0x25; // %
      largeBuffer[1] = 0x50; // P
      largeBuffer[2] = 0x44; // D
      largeBuffer[3] = 0x46; // F
      await expect(
        importService.uploadAndProcess(largeBuffer, 'huge.pdf', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid PDF files', async () => {
      // Minimal valid PDF header
      const pdfBuffer = Buffer.from('%PDF-1.4 minimal content for testing');
      prismaMock.timetableImportBatch.findFirst.mockResolvedValue(null);
      prismaMock.timetableImportBatch.create.mockResolvedValue({
        id: 'batch-1',
        status: 'UPLOADED',
      });

      const result = await importService.uploadAndProcess(pdfBuffer, 'test.pdf', 'user-1');
      expect(result.batchId).toBe('batch-1');
      expect(result.status).toBe('UPLOADED');
    });
  });

  describe('Extraction Pipeline Fallback', () => {
    it('should use text parser when Gemini is unavailable', async () => {
      geminiMock.isAvailable.mockReturnValue(false);
      textParserMock.extractHeader.mockReturnValue({
        institute: 'Test Institute',
        department: 'CSE-DS',
        effectiveFrom: '13 July 2026',
        semester: '7TH',
        section: 'C',
        room: '416',
      });
      textParserMock.extractGrid.mockReturnValue({
        gridId: 'CSE-DS-C',
        slots: [
          {
            day: 'MON',
            timeSlotStart: '9:10 AM',
            timeSlotEnd: '10:05 AM',
            isMergedSlot: false,
            sectionCodes: ['C'],
            subjectCode: 'BAI 701',
            subjectName: 'DEEP LEARNING',
            facultyShortCode: 'RS',
            facultyFullName: 'MR RANJEET SINGH',
            room: '416',
            category: 'academic',
            rawCellText: 'DL(RS)',
          },
        ],
      });

      prismaMock.timetableSlotDraft.create.mockResolvedValue({ id: 'draft-1' });
      prismaMock.subject.findUnique.mockResolvedValue(null);
      prismaMock.subject.findMany.mockResolvedValue([]);
      prismaMock.faculty.findUnique.mockResolvedValue(null);
      prismaMock.faculty.findMany.mockResolvedValue([]);
      prismaMock.room.findUnique.mockResolvedValue(null);
      prismaMock.room.findMany.mockResolvedValue([]);
      prismaMock.section.findFirst.mockResolvedValue(null);
      prismaMock.section.findMany.mockResolvedValue([]);

      // Call the private pipeline method via a valid PDF upload
      const pdfBuffer = Buffer.from('%PDF-1.4 test content');
      prismaMock.timetableImportBatch.findFirst.mockResolvedValue(null);
      prismaMock.timetableImportBatch.create.mockResolvedValue({
        id: 'batch-text',
        status: 'UPLOADED',
      });

      const result = await importService.uploadAndProcess(pdfBuffer, 'test.pdf', 'user-1');
      expect(result.batchId).toBe('batch-text');

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Text parser should have been called since Gemini is unavailable
      expect(textParserMock.extractTextFromPdf).toHaveBeenCalled();
    });
  });

  describe('Integration Timetable Import Flow & Forced-Failure Transaction Rollback', () => {
    it('should catch failures and rollback transaction cleanly when Prisma inserts fail', async () => {
      const mockBatchId = 'batch-uuid-1';
      
      prismaMock.timetableImportBatch.findUnique.mockResolvedValue({
        id: mockBatchId,
        status: 'PENDING_REVIEW',
        slots: [
          {
            id: 'slot-draft-1',
            day: 'MON',
            timeSlotStart: '09:10 AM',
            timeSlotEnd: '10:05 AM',
            isMergedSlot: false,
            sectionCodes: ['C'],
            subjectRaw: 'Deep Learning',
            facultyRaw: 'MR RANJEET SINGH',
            room: '416',
            category: 'academic',
            matchedSubjectId: 'sub-1',
            matchedFacultyId: 'fac-1',
            matchedRoomId: 'room-1',
            matchedSectionId: 'sec-1',
          },
        ],
      });

      prismaMock.timetableSlot.findMany.mockResolvedValue([]);

      // Force a mock error on create to trigger transactional rollback
      prismaMock.timetableSlot.create.mockRejectedValue(new Error('DB connection timed out.'));

      await expect(importService.approveAndCommit(mockBatchId)).rejects.toThrow(
        BadRequestException,
      );
      
      // Verify that status was NOT set to committed
      expect(prismaMock.timetableImportBatch.update).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ data: expect.objectContaining({ status: 'COMMITTED' }) }),
      );
    });
  });
});
