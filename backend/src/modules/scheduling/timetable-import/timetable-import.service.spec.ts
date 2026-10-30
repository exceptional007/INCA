import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { ConflictService } from './conflict.service';
import { TimetableImportService } from './timetable-import.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import { GeminiExtractionService } from './gemini-extraction.service';
import { PdfTextParserService } from './pdf-text-parser.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

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
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      timetableSlot: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      scheduleTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      schedule: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
      },
      program: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
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
      prismaMock.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        name: 'C',
        semester: { programId: 'prog-1' },
      });
      prismaMock.timetableSlot.createMany.mockRejectedValue(new Error('DB connection timed out.'));

      await expect(importService.approveAndCommit(mockBatchId)).rejects.toThrow(
        BadRequestException,
      );
      
      // Verify that status was NOT set to committed
      expect(prismaMock.timetableImportBatch.update).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ data: expect.objectContaining({ status: 'COMMITTED' }) }),
      );
    });

    it('should reject approval when a slot has unmapped faculty without silently creating fake users', async () => {
      const mockBatchId = 'batch-unmapped-fac';
      prismaMock.timetableImportBatch.findUnique.mockResolvedValue({
        id: mockBatchId,
        status: 'PENDING_REVIEW',
        slots: [
          {
            id: 'slot-unmapped-1',
            day: 'MON',
            timeSlotStart: '09:10 AM',
            timeSlotEnd: '10:05 AM',
            sectionCodes: ['C'],
            subjectRaw: 'Deep Learning',
            facultyRaw: 'UNKNOWN PROFESSOR',
            room: '416',
            matchedSubjectId: 'sub-1',
            matchedFacultyId: null, // Unmapped faculty
            matchedRoomId: 'room-1',
            matchedSectionId: 'sec-1',
          },
        ],
      });

      prismaMock.timetableSlot.findMany.mockResolvedValue([]);
      prismaMock.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        name: 'C',
        semesterId: 'sem-1',
        semester: { number: 1, programId: 'prog-1' },
      });
      prismaMock.faculty.findFirst.mockResolvedValue(null); // DB also doesn't have it

      await expect(importService.approveAndCommit(mockBatchId)).rejects.toThrow(
        /Unresolved faculty/i,
      );

      // Verify no user or faculty was created
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.faculty.create).not.toHaveBeenCalled();
    });

    it('should detect invalid time ranges and duplicate entries in ConflictService', () => {
      const invalidTimeSlots: any[] = [
        {
          day: 'MON',
          timeSlotStart: '10:05 AM',
          timeSlotEnd: '09:10 AM', // Start > End
          subjectName: 'Test Subject',
          facultyFullName: 'Faculty Name',
          room: '416',
          sectionCodes: ['C'],
        },
      ];

      const timeConflicts = conflictService.detectConflicts(invalidTimeSlots, []);
      expect(timeConflicts.some((c) => c.type === 'TIME_RANGE')).toBe(true);

      const duplicateSlots: any[] = [
        {
          day: 'MON',
          timeSlotStart: '09:10 AM',
          timeSlotEnd: '10:05 AM',
          subjectName: 'Deep Learning',
          facultyFullName: 'Prof A',
          room: '416',
          sectionCodes: ['C'],
        },
        {
          day: 'MON',
          timeSlotStart: '09:10 AM',
          timeSlotEnd: '10:05 AM',
          subjectName: 'Deep Learning',
          facultyFullName: 'Prof A',
          room: '416',
          sectionCodes: ['C'],
        },
      ];

      const dupConflicts = conflictService.detectConflicts(duplicateSlots, []);
      expect(dupConflicts.some((c) => c.type === 'DUPLICATE')).toBe(true);
    });

    it('should safely return zero confidence for UNASSIGNED entity queries', async () => {
      const unassignedSub = await matchingService.matchSubject('UNASSIGNED', 'UNASSIGNED');
      expect(unassignedSub.matchedId).toBeNull();
      expect(unassignedSub.confidence).toBe(0.0);

      const unassignedFac = await matchingService.matchFaculty('Unassigned', 'Unassigned');
      expect(unassignedFac.matchedId).toBeNull();
      expect(unassignedFac.confidence).toBe(0.0);

      const unassignedRoom = await matchingService.matchRoom('UNASSIGNED');
      expect(unassignedRoom.matchedId).toBeNull();
      expect(unassignedRoom.confidence).toBe(0.0);
    });

    it('should successfully approve and commit batch, creating version, slots, templates and schedules', async () => {
      const mockBatchId = 'batch-approve-success-1';
      prismaMock.timetableImportBatch.findUnique.mockResolvedValue({
        id: mockBatchId,
        status: 'PENDING_REVIEW',
        slots: [
          {
            id: 'slot-1',
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
          {
            id: 'slot-2',
            day: 'TUES',
            timeSlotStart: '10:05 AM',
            timeSlotEnd: '11:00 AM',
            isMergedSlot: false,
            sectionCodes: ['C'],
            subjectRaw: 'Internet of Things',
            facultyRaw: 'MR KRISHNA JAISWAL',
            room: '416',
            category: 'academic',
            matchedSubjectId: 'sub-2',
            matchedFacultyId: 'fac-2',
            matchedRoomId: 'room-1',
            matchedSectionId: 'sec-1',
          },
        ],
      });

      prismaMock.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        name: 'C',
        semesterId: 'sem-1',
        semester: { programId: 'prog-1' },
      });
      prismaMock.section.findMany.mockResolvedValue([]);
      prismaMock.timetableSlot.findMany.mockResolvedValue([]);
      prismaMock.timetableVersion.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.timetableVersion.create.mockResolvedValue({
        id: 'ver-new-1',
        sectionId: 'sec-1',
        isActive: true,
        importBatchId: mockBatchId,
      });
      prismaMock.timetableVersion.findMany.mockResolvedValue([
        {
          id: 'ver-new-1',
          sectionId: 'sec-1',
          isActive: true,
          slots: [
            {
              day: 'MON',
              timeSlotStart: '09:10 AM',
              timeSlotEnd: '10:05 AM',
              subjectId: 'sub-1',
              facultyId: 'fac-1',
              roomId: 'room-1',
            },
            {
              day: 'TUES',
              timeSlotStart: '10:05 AM',
              timeSlotEnd: '11:00 AM',
              subjectId: 'sub-2',
              facultyId: 'fac-2',
              roomId: 'room-1',
            },
          ],
        },
      ]);
      prismaMock.timetableSlot.createMany.mockResolvedValue({ count: 2 });
      prismaMock.scheduleTemplate.findMany.mockResolvedValue([]);
      prismaMock.scheduleTemplate.create.mockImplementation((args: any) => ({
        id: `tpl-${Math.random().toString(36).substring(7)}`,
        ...args.data,
      }));
      prismaMock.schedule.findMany.mockResolvedValue([]);
      prismaMock.schedule.createMany.mockResolvedValue({ count: 4 });
      prismaMock.timetableImportBatch.update.mockResolvedValue({
        id: mockBatchId,
        status: 'COMMITTED',
      });

      const res = await importService.approveAndCommit(mockBatchId);

      expect(res.success).toBe(true);
      expect(prismaMock.timetableImportBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockBatchId },
          data: expect.objectContaining({ status: 'COMMITTED' }),
        }),
      );
      expect(prismaMock.timetableVersion.create).toHaveBeenCalled();
      expect(prismaMock.timetableSlot.createMany).toHaveBeenCalled();
      expect(prismaMock.scheduleTemplate.create).toHaveBeenCalled();
      expect(prismaMock.schedule.createMany).toHaveBeenCalled();
    });

    it('should be idempotent and return existing versions when batch is already COMMITTED', async () => {
      const mockBatchId = 'batch-already-committed';
      prismaMock.timetableImportBatch.findUnique.mockResolvedValue({
        id: mockBatchId,
        status: 'COMMITTED',
        slots: [],
      });
      prismaMock.timetableVersion.findMany.mockResolvedValue([
        { id: 'ver-existing-1', isActive: true, importBatchId: mockBatchId, slots: [] },
      ]);

      const res = await importService.approveAndCommit(mockBatchId);

      expect(res.success).toBe(true);
      expect(res.message).toMatch(/already approved and committed/i);
      expect(prismaMock.timetableSlot.createMany).not.toHaveBeenCalled();
      expect(prismaMock.schedule.createMany).not.toHaveBeenCalled();
    });

    it('should reject approval when batch is DISCARDED', async () => {
      const mockBatchId = 'batch-discarded-1';
      prismaMock.timetableImportBatch.findUnique.mockResolvedValue({
        id: mockBatchId,
        status: 'DISCARDED',
        slots: [],
      });

      await expect(importService.approveAndCommit(mockBatchId)).rejects.toThrow(
        /Cannot approve a discarded import batch/i,
      );
    });

    it('should throw NotFoundException when approving a nonexistent batch', async () => {
      prismaMock.timetableImportBatch.findUnique.mockResolvedValue(null);

      await expect(importService.approveAndCommit('nonexistent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return conflicts without modifying database when blocking timetable conflict exists', async () => {
      const mockBatchId = 'batch-with-conflict';
      prismaMock.timetableImportBatch.findUnique.mockResolvedValue({
        id: mockBatchId,
        status: 'PENDING_REVIEW',
        slots: [
          {
            id: 'slot-c1',
            day: 'MON',
            timeSlotStart: '09:10 AM',
            timeSlotEnd: '10:05 AM',
            sectionCodes: ['C'],
            subjectRaw: 'Deep Learning',
            facultyRaw: 'DR RANJEET SINGH',
            room: '416',
            category: 'academic',
            matchedSubjectId: 'sub-1',
            matchedFacultyId: 'fac-1',
            matchedRoomId: 'room-1',
            matchedSectionId: 'sec-c',
          },
        ],
      });

      // Existing active slot in another section with the same faculty at the same time
      prismaMock.section.findMany.mockResolvedValue([]);
      prismaMock.timetableSlot.findMany.mockResolvedValue([
        {
          id: 'exist-slot-1',
          day: 'MON',
          timeSlotStart: '09:10 AM',
          timeSlotEnd: '10:05 AM',
          facultyId: 'fac-1',
          roomId: 'room-other',
          version: { sectionId: 'sec-other', isActive: true },
          subject: { name: 'Machine Learning' },
          faculty: { firstName: 'Ranjeet', lastName: 'Singh' },
          room: { code: 'CR-501' },
        },
      ]);

      const res = await importService.approveAndCommit(mockBatchId);

      expect(res.success).toBe(false);
      expect(res.conflicts?.length).toBeGreaterThan(0);
      expect(res.conflicts?.[0].type).toBe('FACULTY');
      // Verify database was NOT updated
      expect(prismaMock.timetableImportBatch.update).not.toHaveBeenCalled();
      expect(prismaMock.timetableVersion.create).not.toHaveBeenCalled();
    });

    it('should resolve room using numeric digits fallback when exact room code differs by prefix', async () => {
      const mockBatchId = 'batch-room-fallback';
      prismaMock.timetableImportBatch.findUnique.mockResolvedValue({
        id: mockBatchId,
        status: 'PENDING_REVIEW',
        slots: [
          {
            id: 'slot-rf-1',
            day: 'MON',
            timeSlotStart: '09:10 AM',
            timeSlotEnd: '10:05 AM',
            sectionCodes: ['C'],
            subjectRaw: 'Deep Learning',
            facultyRaw: 'DR RANJEET SINGH',
            room: 'L-418', // Extracted code is L-418
            category: 'academic',
            matchedSubjectId: 'sub-1',
            matchedFacultyId: 'fac-1',
            matchedRoomId: null, // Unmapped room initially
            matchedSectionId: 'sec-1',
          },
        ],
      });

      prismaMock.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        name: 'C',
        semesterId: 'sem-1',
        semester: { programId: 'prog-1' },
      });
      prismaMock.section.findMany.mockResolvedValue([]);
      prismaMock.timetableSlot.findMany.mockResolvedValue([]);
      // Room first findFirst fails with exact L-418, but second findFirst with digits '418' succeeds
      prismaMock.room.findFirst = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'room-cr-418',
          code: 'CR-418',
          name: '418',
        });

      prismaMock.timetableVersion.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.timetableVersion.create.mockResolvedValue({ id: 'ver-1' });
      prismaMock.timetableVersion.findMany.mockResolvedValue([
        { id: 'ver-1', sectionId: 'sec-1', isActive: true, slots: [] },
      ]);
      prismaMock.timetableSlot.createMany.mockResolvedValue({ count: 1 });
      prismaMock.scheduleTemplate.findMany.mockResolvedValue([]);
      prismaMock.schedule.findMany.mockResolvedValue([]);
      prismaMock.timetableImportBatch.update.mockResolvedValue({ id: mockBatchId, status: 'COMMITTED' });

      const res = await importService.approveAndCommit(mockBatchId);

      expect(res.success).toBe(true);
      expect(prismaMock.timetableSlot.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              roomId: 'room-cr-418',
            }),
          ],
        }),
      );
    });
  });
});
