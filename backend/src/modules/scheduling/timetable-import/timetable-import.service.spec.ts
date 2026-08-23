import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { ConflictService } from './conflict.service';
import { TimetableImportService } from './timetable-import.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import { GeminiExtractionService } from './gemini-extraction.service';
import { BadRequestException } from '@nestjs/common';

describe('TimetableImport Testing Suite', () => {
  let matchingService: MatchingService;
  let conflictService: ConflictService;
  let importService: TimetableImportService;
  let prismaMock: any;

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
        delete: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
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
        {
          provide: GeminiExtractionService,
          useValue: {
            extractHeader: jest.fn(),
            extractGrid: jest.fn(),
          },
        },
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
      // Direct overlap
      expect(conflictService.isOverlapping('09:10 AM', '10:05 AM', '09:10 AM', '10:05 AM')).toBe(true);
      // Partial overlap
      expect(conflictService.isOverlapping('09:10 AM', '11:00 AM', '10:00 AM', '12:00 PM')).toBe(true);
      // Non-overlap (back-to-back)
      expect(conflictService.isOverlapping('09:10 AM', '10:05 AM', '10:05 AM', '11:00 AM')).toBe(false);
      // Non-overlap (separated)
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
      // Exact match
      expect(matchingService.calculateSimilarity('Deep Learning', 'DEEP LEARNING')).toBe(1.0);
      // Prefix titles stripping
      expect(matchingService.calculateSimilarity('Mr Ranjeet Singh', 'Ranjeet Singh')).toBe(1.0);
      expect(matchingService.calculateSimilarity('Prof. Roop Ranjan', 'Roop Ranjan')).toBe(1.0);
      // Small typo match
      expect(matchingService.calculateSimilarity('DEEP LEARING', 'DEEP LEARNING')).toBeGreaterThan(0.85);
    });

    it('should find exact subject code matches first', async () => {
      prismaMock.subject.findUnique.mockResolvedValue({ id: 'sub-dl', code: 'BAI 701', name: 'Deep Learning' });
      
      const match = await matchingService.matchSubject('BAI 701', 'Deep Learning');
      expect(match.matchedId).toBe('sub-dl');
      expect(match.confidence).toBe(1.0);
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

      prismaMock.timetableSlot.findMany.mockResolvedValue([]); // no conflicts

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
