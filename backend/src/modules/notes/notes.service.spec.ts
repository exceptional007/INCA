import { Test, TestingModule } from '@nestjs/testing';
import { NotesService } from './notes.service';
import { DocumentProcessingService } from './document-processing.service';
import { TutorService } from './tutor.service';
import { QuizService } from './quiz.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NoteSourceType, NoteStatus } from '@prisma/client';

describe('NotesService & AI Tutor Integration', () => {
  let notesService: NotesService;
  let tutorService: TutorService;
  let quizService: QuizService;
  let docProcessingService: DocumentProcessingService;

  const mockPrisma = {
    faculty: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    subject: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    program: {
      findMany: jest.fn(),
    },
    scheduleTemplate: {
      findMany: jest.fn(),
    },
    timetableSlot: {
      findMany: jest.fn(),
    },
    learningNote: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    learningNoteProgram: {
      deleteMany: jest.fn(),
    },
    learningNoteChunk: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    tutorConversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    tutorMessage: {
      create: jest.fn(),
    },
    learningQuiz: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    quizAttempt: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockR2 = {
    uploadLearningMaterial: jest.fn(),
    deleteObject: jest.fn(),
    getObjectStream: jest.fn(),
    getObjectBuffer: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'GEMINI_MODEL') return 'gemini-3.6-flash';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        DocumentProcessingService,
        TutorService,
        QuizService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StrictR2StorageService, useValue: mockR2 },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    notesService = module.get<NotesService>(NotesService);
    tutorService = module.get<TutorService>(TutorService);
    quizService = module.get<QuizService>(QuizService);
    docProcessingService = module.get<DocumentProcessingService>(DocumentProcessingService);
  });

  describe('Faculty Note Creation & Upload Validation', () => {
    it('should reject file upload exceeding 25 MB limit', async () => {
      mockPrisma.faculty.findUnique.mockResolvedValue({ id: 'fac-1', departmentId: 'dept-1' });
      mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-1', isActive: true });
      mockPrisma.program.findMany.mockResolvedValue([{ id: 'prog-1' }]);

      const oversizedFile: any = {
        originalname: 'large-notes.pdf',
        mimetype: 'application/pdf',
        size: 26 * 1024 * 1024, // 26 MB
        buffer: Buffer.from('large content'),
      };

      await expect(
        notesService.createNote('user-1', 'FACULTY', oversizedFile, {
          title: 'Deep Learning Notes',
          subjectId: 'sub-1',
          programIds: ['prog-1'],
          sourceType: NoteSourceType.FILE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unsupported file extension (e.g. .exe or .txt)', async () => {
      mockPrisma.faculty.findUnique.mockResolvedValue({ id: 'fac-1', departmentId: 'dept-1' });
      mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-1', isActive: true });
      mockPrisma.program.findMany.mockResolvedValue([{ id: 'prog-1' }]);

      const invalidFile: any = {
        originalname: 'malicious.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from('malicious'),
      };

      await expect(
        notesService.createNote('user-1', 'FACULTY', invalidFile, {
          title: 'Notes',
          subjectId: 'sub-1',
          programIds: ['prog-1'],
          sourceType: NoteSourceType.FILE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully upload valid PDF to R2 and persist note', async () => {
      mockPrisma.faculty.findUnique.mockResolvedValue({ id: 'fac-1', departmentId: 'dept-1' });
      mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-1', isActive: true });
      mockPrisma.program.findMany.mockResolvedValue([{ id: 'prog-1' }, { id: 'prog-2' }]);
      mockR2.uploadLearningMaterial.mockResolvedValue('learning-materials/dl-notes.pdf');

      const validNote = {
        id: 'note-1',
        title: 'Deep Learning Lecture 1',
        sourceType: NoteSourceType.FILE,
        storageKey: 'learning-materials/dl-notes.pdf',
        status: NoteStatus.PROCESSING,
      };
      mockPrisma.learningNote.create.mockResolvedValue(validNote);

      const file: any = {
        originalname: 'DL_Module1.pdf',
        mimetype: 'application/pdf',
        size: 2 * 1024 * 1024,
        buffer: Buffer.from('%PDF-1.4 test content'),
      };

      const result = await notesService.createNote('user-1', 'FACULTY', file, {
        title: 'Deep Learning Lecture 1',
        subjectId: 'sub-1',
        programIds: ['prog-1', 'prog-2'],
        sourceType: NoteSourceType.FILE,
      });

      expect(mockR2.uploadLearningMaterial).toHaveBeenCalledWith(
        file.buffer,
        file.originalname,
        file.mimetype,
      );
      expect(mockPrisma.learningNote.create).toHaveBeenCalled();
      expect(result.id).toBe('note-1');
    });

    it('should validate Google Drive link and persist note with DRIVE source type', async () => {
      mockPrisma.faculty.findUnique.mockResolvedValue({ id: 'fac-1', departmentId: 'dept-1' });
      mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-1', isActive: true });
      mockPrisma.program.findMany.mockResolvedValue([{ id: 'prog-1' }]);

      mockPrisma.learningNote.create.mockResolvedValue({
        id: 'note-2',
        title: 'Google Drive Study Sheet',
        sourceType: NoteSourceType.DRIVE,
        driveUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OGvE2upms/view',
      });

      const result = await notesService.createNote('user-1', 'FACULTY', undefined, {
        title: 'Google Drive Study Sheet',
        subjectId: 'sub-1',
        programIds: ['prog-1'],
        sourceType: NoteSourceType.DRIVE,
        driveUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OGvE2upms/view',
      });

      expect(mockR2.uploadLearningMaterial).not.toHaveBeenCalled();
      expect(result.sourceType).toBe(NoteSourceType.DRIVE);
    });

    it('should reject invalid non-Google Drive links', async () => {
      mockPrisma.faculty.findUnique.mockResolvedValue({ id: 'fac-1', departmentId: 'dept-1' });
      mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-1', isActive: true });
      mockPrisma.program.findMany.mockResolvedValue([{ id: 'prog-1' }]);

      await expect(
        notesService.createNote('user-1', 'FACULTY', undefined, {
          title: 'Phishing Note',
          subjectId: 'sub-1',
          programIds: ['prog-1'],
          sourceType: NoteSourceType.DRIVE,
          driveUrl: 'https://random-unverified-site.com/doc.pdf',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Student Access & Filtering', () => {
    it('should filter notes strictly by student enrolled program scope and PUBLISHED status', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({
        id: 'stud-1',
        section: { semester: { programId: 'prog-aiml' } },
        department: { programs: [{ id: 'prog-aiml' }] },
      });

      mockPrisma.learningNote.findMany.mockResolvedValue([
        { id: 'note-pub-1', title: 'AIML Notes', status: NoteStatus.PUBLISHED },
      ]);
      mockPrisma.learningNote.count.mockResolvedValue(1);

      const result = await notesService.listPublishedNotesForStudent('user-stud', 'STUDENT', {});

      expect(mockPrisma.learningNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: NoteStatus.PUBLISHED,
            programs: { some: { programId: { in: ['prog-aiml'] } } },
          }),
        }),
      );
      expect(result.items.length).toBe(1);
    });

    it('should prevent students from viewing draft or unpublished notes', async () => {
      mockPrisma.learningNote.findUnique.mockResolvedValue({
        id: 'draft-note',
        title: 'Secret Draft',
        status: NoteStatus.DRAFT,
      });

      await expect(
        notesService.getNoteById('user-stud', 'STUDENT', 'draft-note'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Document Replacement & Cache Invalidation', () => {
    it('should delete old R2 object, remove old chunks, and reset aiReady on replacement', async () => {
      mockPrisma.faculty.findUnique.mockResolvedValue({ id: 'fac-1' });
      mockPrisma.learningNote.findUnique.mockResolvedValue({
        id: 'note-1',
        facultyId: 'fac-1',
        storageKey: 'learning-materials/old-file.pdf',
        documentVersion: 1,
      });

      mockR2.uploadLearningMaterial.mockResolvedValue('learning-materials/new-file.pdf');
      mockPrisma.learningNote.update.mockResolvedValue({
        id: 'note-1',
        documentVersion: 2,
        storageKey: 'learning-materials/new-file.pdf',
        aiReady: false,
      });

      const newFile: any = {
        originalname: 'Updated_DL.pdf',
        mimetype: 'application/pdf',
        size: 3 * 1024 * 1024,
        buffer: Buffer.from('new pdf content'),
      };

      const updated = await notesService.replaceDocument('user-fac', 'FACULTY', 'note-1', newFile);

      expect(mockR2.deleteObject).toHaveBeenCalledWith('learning-materials/old-file.pdf');
      expect(mockPrisma.learningNoteChunk.deleteMany).toHaveBeenCalledWith({ where: { noteId: 'note-1' } });
      expect(updated.documentVersion).toBe(2);
    });
  });

  describe('Quiz Service & Objective Evaluation', () => {
    it('should accurately calculate score and pass/fail status for quiz submissions', async () => {
      const mockQuestions = [
        { id: 'q1', question: 'Q1?', correctAnswer: 'A', explanation: 'Exp 1' },
        { id: 'q2', question: 'Q2?', correctAnswer: 'B', explanation: 'Exp 2' },
        { id: 'q3', question: 'Q3?', correctAnswer: 'True', explanation: 'Exp 3' },
        { id: 'q4', question: 'Q4?', correctAnswer: 'C', explanation: 'Exp 4' },
        { id: 'q5', question: 'Q5?', correctAnswer: 'False', explanation: 'Exp 5' },
      ];

      mockPrisma.learningQuiz.findUnique.mockResolvedValue({
        id: 'quiz-1',
        noteId: 'note-1',
        questions: mockQuestions,
      });

      mockPrisma.quizAttempt.create.mockImplementation((args) => Promise.resolve({
        id: 'attempt-1',
        ...args.data,
        completedAt: new Date(),
      }));

      // Submit: 4 correct, 1 wrong (q4 answered 'D' instead of 'C')
      const result = await quizService.submitQuiz('stud-1', 'quiz-1', {
        answers: {
          q1: 'A',
          q2: 'B',
          q3: 'True',
          q4: 'D',
          q5: 'False',
        },
      });

      expect(result.correctCount).toBe(4);
      expect(result.totalQuestions).toBe(5);
      expect(result.score).toBe(80);
      expect(result.passed).toBe(true);
      expect(result.review.find((r: any) => r.id === 'q4').isCorrect).toBe(false);
    });
  });
});

