import { NoticeEnrichmentService } from '../notices/notice-enrichment.service';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import request from 'supertest';
import { StudentController } from './student.controller';
import { StudentRegistrationService } from './student-registration.service';
import { StudentService } from './student.service';
import { StudentRepository } from './repositories/student.repository';
import { NoticesService } from '../notices/notices.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesGuard } from '../../common/guards/roles.guard';

describe('Student dashboard notice-board integration', () => {
  let app: INestApplication;
  let studentService: StudentService;
  let board: NoticesService;
  let rows: any[];
  const db = {
    user: { findUnique: jest.fn() },
    notices: { findMany: jest.fn() },
    notice_reads: { create: jest.fn(), upsert: jest.fn() },
  };
  const user = {
    id: 'student-user',
    role: { code: 'STUDENT' },
    student: {
      departmentId: 'department-a',
      sectionId: 'section-a',
      section: { semester: { number: 3, programId: 'program-a' } },
    },
  };
  const date = new Date('2026-01-01T10:00:00Z');
  function notice(id: string, changes: object = {}) {
    return {
      id,
      title: 'Notice ' + id,
      content: 'Content ' + id,
      category: 'ACADEMIC',
      priority: 'NORMAL',
      status: 'PUBLISHED',
      targetScope: 'ALL',
      isPinned: false,
      isArchived: false,
      publishAt: date,
      createdAt: date,
      expiresAt: null,
      requiresAcknowledgement: false,
      notice_reads: [],
      notice_attachments: [],
      departments: null,
      programs: null,
      users_notices_authorIdTousers: {
        id: 'author',
        email: 'publisher@example.test',
        faculty: {
          firstName: 'Demo',
          lastName: 'Publisher',
          designation: 'Faculty',
          department: { name: 'Department A' },
        },
      },
      _count: { notice_reads: 0 },
      ...changes,
    };
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [
        { provide: StudentRegistrationService, useValue: {} },
        StudentService,
        NoticesService,
        {provide: NoticeEnrichmentService, useValue: {enrich: jest.fn().mockResolvedValue(null)}},
        RolesGuard,
        { provide: StudentRepository, useValue: {} },
        { provide: PrismaService, useValue: db },
        { provide: StrictR2StorageService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          if (!req.headers['x-test-auth']) throw new UnauthorizedException();
          req.user = { id: 'student-user', role: 'STUDENT' };
          return true;
        },
      })
      .compile();
    studentService = module.get(StudentService);
    board = module.get(NoticesService);
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    rows = [notice('campus')];
    db.user.findUnique.mockResolvedValue(user);
    // Emulate only the database WHERE predicates; the real board service performs
    // audience filtering, read-state mapping, pin/priority sorting, and pagination.
    db.notices.findMany.mockImplementation(async ({ where }) =>
      rows.filter(
        (n) =>
          n.status === where.status &&
          n.publishAt <= where.publishAt.lte &&
          n.isArchived === where.isArchived &&
          (n.expiresAt === null || n.expiresAt > where.OR[1].expiresAt.gt),
      ),
    );
  });
  afterAll(async () => {
    await app?.close();
  });
  const get = () =>
    request(app.getHttpServer())
      .get('/api/v1/students/academic/notices')
      .set('x-test-auth', 'yes');
  it('requires authentication before accessing the dashboard endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/students/academic/notices')
      .expect(401);
    expect(db.notices.findMany).not.toHaveBeenCalled();
  });
  it('maps the existing endpoint contract from the newer notice board without recording a read', async () => {
    rows = [
      notice('targeted', {
        requiresAcknowledgement: true,
        notice_attachments: [{ id: 'attachment' }],
        notice_reads: [{ readAt: date, acknowledgedAt: date }],
      }),
    ];
    const result = await get().expect(200);
    expect(result.body).toMatchObject({
      success: true,
      data: [
        {
          id: 'targeted',
          title: 'Notice targeted',
          body: 'Content targeted',
          date: date.toISOString(),
          author: 'Demo Publisher',
          priority: 'NORMAL',
          isPinned: false,
          isRead: true,
          requiresAcknowledgement: true,
          isAcknowledged: true,
          attachmentCount: 1,
        },
      ],
    });
    expect(db.notice_reads.create).not.toHaveBeenCalled();
    expect(db.notice_reads.upsert).not.toHaveBeenCalled();
  });
  it('shows only the same audience-targeted notices as the board', async () => {
    rows = [
      notice('campus'),
      notice('students', { targetScope: 'STUDENTS' }),
      notice('department', {
        targetScope: 'DEPARTMENT',
        departmentId: 'department-a',
      }),
      notice('program', { targetScope: 'PROGRAM', programId: 'program-a' }),
      notice('year', { targetYear: 2 }),
      notice('custom', {
        targetScope: 'CUSTOM',
        targetAudience: {
          userIds: ['student-user'],
          sectionIds: ['section-a'],
        },
      }),
      notice('other-department', {
        targetScope: 'DEPARTMENT',
        departmentId: 'department-b',
      }),
      notice('other-program', {
        targetScope: 'PROGRAM',
        programId: 'program-b',
      }),
      notice('other-year', { targetYear: 1 }),
      notice('faculty', { targetScope: 'FACULTY' }),
      notice('other-section', {
        targetAudience: { sectionIds: ['section-b'] },
      }),
    ];
    const dashboard = await get().expect(200);
    const feed = await board.getRecipientNotices('student-user', {
      page: 1,
      limit: 10,
      isArchived: false,
    });
    expect(dashboard.body.data.map((n) => n.id)).toEqual(
      feed.items.map((n) => n.id),
    );
    expect(dashboard.body.data.map((n) => n.id)).toEqual([
      'campus',
      'students',
      'department',
      'program',
      'year',
      'custom',
    ]);
  });
  it.each([
    { status: 'DRAFT' },
    { status: 'SCHEDULED' },
    { status: 'WITHDRAWN' },
    { status: 'EXPIRED' },
    { publishAt: new Date(Date.now() + 86400000) },
    { expiresAt: new Date(0) },
    { isArchived: true },
  ])('excludes unavailable notice %j', async (changes) => {
    rows = [notice('hidden', changes)];
    const result = await get().expect(200);
    expect(result.body.data).toEqual([]);
  });
  it('uses board pin/priority ordering and limits the dashboard preview to ten', async () => {
    rows = [
      ...Array.from({ length: 12 }, (_, i) => notice('ordinary-' + i)),
      notice('critical', { priority: 'CRITICAL' }),
      notice('pinned', { isPinned: true }),
    ];
    const result = await get().expect(200);
    expect(result.body.data).toHaveLength(10);
    expect(result.body.data.slice(0, 2).map((n) => n.id)).toEqual([
      'pinned',
      'critical',
    ]);
  });
  it('does not allow query parameters to impersonate another recipient', async () => {
    await get()
      .query({ userId: 'other', departmentId: 'department-b' })
      .expect(200);
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'student-user' } }),
    );
  });
  it('returns an actual empty feed when no applicable notices exist', async () => {
    rows = [];
    const result = await get().expect(200);
    expect(result.body.data).toEqual([]);
  });
  it('propagates database errors instead of disguising them as an empty feed', async () => {
    db.notices.findMany.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await get().expect(500);
  });
  it('fails closed when called without an authenticated identity', async () => {
    await expect(studentService.getAcademicNotices('')).rejects.toMatchObject({
      status: 403,
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
