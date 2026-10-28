import { Test, TestingModule } from '@nestjs/testing';
import { NoticesService } from './notices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  NoticeCategory,
  NoticePriority,
  NoticeStatus,
  NoticeTargetScope,
} from './dto/create-notice.dto';

describe('NoticesService Unit Tests', () => {
  let service: NoticesService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    student: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    faculty: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
    },
    program: {
      findMany: jest.fn(),
    },
    academicSession: {
      findMany: jest.fn(),
    },
    notices: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notice_attachments: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    notice_reads: {
      create: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    notice_audit_logs: {
      create: jest.fn(),
    },
    notifications: {
      createMany: jest.fn(),
    },
  };

  const mockR2Storage = {
    uploadNoticeAttachment: jest.fn().mockResolvedValue('notices/sample-uuid.pdf'),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getObjectStream: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StrictR2StorageService, useValue: mockR2Storage },
      ],
    }).compile();

    service = module.get<NoticesService>(NoticesService);
    jest.clearAllMocks();
  });

  describe('User Roles and Publishing Authorization', () => {
    it('should forbid students from creating or publishing notices', async () => {
      await expect(
        service.createNotice('student-1', 'STUDENT', {
          title: 'Unauthorized Student Announcement',
          content: 'This should be blocked',
          category: NoticeCategory.GENERAL,
          priority: NoticePriority.NORMAL,
          targetScope: NoticeTargetScope.ALL,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow faculty to create notices within their department', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'fac-1',
        role: { code: 'FACULTY' },
        faculty: { departmentId: 'dept-cse' },
        student: null,
      });

      mockPrisma.notices.create.mockImplementation((args) =>
        Promise.resolve({
          id: 'notice-1',
          ...args.data,
        }),
      );
      mockPrisma.notice_audit_logs.create.mockResolvedValue({});

      const notice = await service.createNotice('fac-1', 'FACULTY', {
        title: 'CSE Department Colloquium',
        content: 'Colloquium on Distributed Systems and High Performance Computing',
        category: NoticeCategory.ACADEMIC,
        priority: NoticePriority.HIGH,
        targetScope: NoticeTargetScope.DEPARTMENT,
      });

      expect(notice.departmentId).toBe('dept-cse');
      expect(mockPrisma.notices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            departmentId: 'dept-cse',
            authorId: 'fac-1',
          }),
        }),
      );
    });

    it('should forbid unauthorized user from withdrawing another publisher notice', async () => {
      mockPrisma.notices.findUnique.mockResolvedValue({
        id: 'notice-1',
        authorId: 'fac-original',
        departmentId: 'dept-cse',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'fac-other',
        role: { code: 'FACULTY' },
        faculty: { departmentId: 'dept-me' },
      });

      await expect(
        service.withdrawNotice('fac-other', 'FACULTY', 'notice-1', 'Inappropriate content'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Audience Targeting Logic', () => {
    it('should match institution-wide notice for both students and faculty', () => {
      const notice = { targetScope: 'ALL' };
      const studentCtx = { role: 'STUDENT', departmentId: 'dept-ece' };
      const facultyCtx = { role: 'FACULTY', departmentId: 'dept-cse' };

      expect(service.matchesAudience(notice, studentCtx)).toBe(true);
      expect(service.matchesAudience(notice, facultyCtx)).toBe(true);
    });

    it('should restrict student-only notices from being matched by faculty', () => {
      const notice = { targetScope: 'STUDENTS' };
      const studentCtx = { role: 'STUDENT', departmentId: 'dept-cse' };
      const facultyCtx = { role: 'FACULTY', departmentId: 'dept-cse' };

      expect(service.matchesAudience(notice, studentCtx)).toBe(true);
      expect(service.matchesAudience(notice, facultyCtx)).toBe(false);
    });

    it('should match departmental notices only for users belonging to that department', () => {
      const notice = { targetScope: 'DEPARTMENT', departmentId: 'dept-cse' };
      const cseStudent = { role: 'STUDENT', departmentId: 'dept-cse' };
      const eceStudent = { role: 'STUDENT', departmentId: 'dept-ece' };

      expect(service.matchesAudience(notice, cseStudent)).toBe(true);
      expect(service.matchesAudience(notice, eceStudent)).toBe(false);
    });

    it('should enforce semester and program targeting correctly', () => {
      const notice = {
        targetScope: 'PROGRAM',
        programId: 'prog-btech-ds',
        targetSemester: 5,
      };

      const matchingStudent = {
        role: 'STUDENT',
        programId: 'prog-btech-ds',
        semesterNumber: 5,
      };
      const wrongSemester = {
        role: 'STUDENT',
        programId: 'prog-btech-ds',
        semesterNumber: 3,
      };
      const wrongProgram = {
        role: 'STUDENT',
        programId: 'prog-btech-aiml',
        semesterNumber: 5,
      };

      expect(service.matchesAudience(notice, matchingStudent)).toBe(true);
      expect(service.matchesAudience(notice, wrongSemester)).toBe(false);
      expect(service.matchesAudience(notice, wrongProgram)).toBe(false);
    });

    it('should enforce multi-criteria JSON targetAudience', () => {
      const notice = {
        targetScope: 'CUSTOM',
        targetAudience: {
          departmentIds: ['dept-cse', 'dept-it'],
          targetSemesters: [5, 6],
        },
      };

      const validStudent = {
        role: 'STUDENT',
        departmentId: 'dept-cse',
        semesterNumber: 5,
      };
      const wrongDept = {
        role: 'STUDENT',
        departmentId: 'dept-civil',
        semesterNumber: 5,
      };
      const wrongSem = {
        role: 'STUDENT',
        departmentId: 'dept-cse',
        semesterNumber: 2,
      };

      expect(service.matchesAudience(notice, validStudent)).toBe(true);
      expect(service.matchesAudience(notice, wrongDept)).toBe(false);
      expect(service.matchesAudience(notice, wrongSem)).toBe(false);
    });
  });

  describe('Scheduled Publication and Expiration Validation', () => {
    it('should set status to SCHEDULED if publishAt is in the future', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: { code: 'ADMIN' },
      });
      mockPrisma.notices.create.mockImplementation((args) =>
        Promise.resolve({
          id: 'notice-sched',
          ...args.data,
        }),
      );
      mockPrisma.notice_audit_logs.create.mockResolvedValue({});

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const notice = await service.createNotice('admin-1', 'ADMIN', {
        title: 'Upcoming Hackathon Kickoff',
        content: 'Registration will start next week',
        publishAt: futureDate,
      });

      expect(notice.status).toBe(NoticeStatus.SCHEDULED);
    });

    it('should reject creation if expiresAt is before or equal to publishAt', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: { code: 'ADMIN' },
      });

      const now = new Date();
      const past = new Date(now.getTime() - 100000).toISOString();

      await expect(
        service.createNotice('admin-1', 'ADMIN', {
          title: 'Invalid Notice Expiry',
          content: 'Dates are backwards',
          publishAt: now.toISOString(),
          expiresAt: past,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('PDF Attachments & Security', () => {
    it('should reject non-PDF attachments with BadRequestException', async () => {
      mockPrisma.notices.findUnique.mockResolvedValue({
        id: 'notice-1',
        authorId: 'user-admin',
      });

      const badFile = {
        mimetype: 'image/png',
        originalname: 'screenshot.png',
        size: 5000,
        buffer: Buffer.from('not a pdf'),
      } as Express.Multer.File;

      await expect(
        service.uploadAttachment('user-admin', 'ADMIN', 'notice-1', badFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files exceeding 25MB with BadRequestException', async () => {
      mockPrisma.notices.findUnique.mockResolvedValue({
        id: 'notice-1',
        authorId: 'user-admin',
      });

      const hugeFile = {
        mimetype: 'application/pdf',
        originalname: 'huge.pdf',
        size: 26 * 1024 * 1024,
        buffer: Buffer.from('%PDF huge content'),
      } as Express.Multer.File;

      await expect(
        service.uploadAttachment('user-admin', 'ADMIN', 'notice-1', hugeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject corrupt files that do not have %PDF magic header', async () => {
      mockPrisma.notices.findUnique.mockResolvedValue({
        id: 'notice-1',
        authorId: 'user-admin',
      });

      const corruptFile = {
        mimetype: 'application/pdf',
        originalname: 'fake.pdf',
        size: 1024,
        buffer: Buffer.from('FAKE NOT PDF HEADER'),
      } as Express.Multer.File;

      await expect(
        service.uploadAttachment('user-admin', 'ADMIN', 'notice-1', corruptFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully upload valid PDF to Cloudflare R2', async () => {
      mockPrisma.notices.findUnique.mockResolvedValue({
        id: 'notice-1',
        authorId: 'user-admin',
      });
      mockPrisma.notice_attachments.create.mockResolvedValue({
        id: 'att-1',
        noticeId: 'notice-1',
        fileName: 'official-circular.pdf',
        fileKey: 'notices/sample.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      });

      const validPdf = {
        mimetype: 'application/pdf',
        originalname: 'official-circular.pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.4 official content'),
      } as Express.Multer.File;

      const att = await service.uploadAttachment('user-admin', 'ADMIN', 'notice-1', validPdf);

      expect(mockR2Storage.uploadNoticeAttachment).toHaveBeenCalledWith(
        validPdf.buffer,
        'official-circular.pdf',
        'application/pdf',
      );
      expect(att.fileName).toBe('official-circular.pdf');
    });
  });

  describe('Read Tracking and Acknowledgements', () => {
    it('should mark notice as read for authenticated user', async () => {
      mockPrisma.notices.findUnique.mockResolvedValue({ id: 'notice-1' });
      mockPrisma.notice_reads.upsert.mockResolvedValue({
        id: 'read-1',
        noticeId: 'notice-1',
        userId: 'student-1',
        readAt: new Date(),
      });

      const res = await service.markAsRead('student-1', 'notice-1');
      expect(res.success).toBe(true);
      expect(mockPrisma.notice_reads.upsert).toHaveBeenCalled();
    });

    it('should reject acknowledgement if notice does not require acknowledgement', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'student-1',
        role: { code: 'STUDENT' },
      });
      mockPrisma.notices.findUnique.mockResolvedValue({
        id: 'notice-regular',
        targetScope: 'ALL',
        requiresAcknowledgement: false,
      });

      await expect(
        service.acknowledgeNotice('student-1', 'notice-regular'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully record acknowledgement timestamp when required', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'student-1',
        role: { code: 'STUDENT' },
      });
      mockPrisma.notices.findUnique.mockResolvedValue({
        id: 'notice-exam',
        targetScope: 'ALL',
        requiresAcknowledgement: true,
      });
      mockPrisma.notice_reads.upsert.mockResolvedValue({
        id: 'read-1',
        acknowledgedAt: new Date(),
      });
      mockPrisma.notice_audit_logs.create.mockResolvedValue({});

      const res = await service.acknowledgeNotice('student-1', 'notice-exam');
      expect(res.success).toBe(true);
      expect(mockPrisma.notice_reads.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { noticeId_userId: { noticeId: 'notice-exam', userId: 'student-1' } },
          create: expect.objectContaining({ acknowledgedAt: expect.any(Date) }),
        }),
      );
    });
  });
});

