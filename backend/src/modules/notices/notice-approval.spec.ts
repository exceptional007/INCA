import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { NoticesService } from './notices.service';
import { NoticesController } from './notices.controller';
import { NoticeEnrichmentService } from './notice-enrichment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { RolesGuard } from '../../common/guards/roles.guard';

describe('Notice approval workflow', () => {
  let app: INestApplication, service: NoticesService;
  let state: {
    notices: any[];
    audits: any[];
    notifications: any[];
    attachments: any[];
  };
  let failAudit: boolean, failNotification: boolean;
  let tail: Promise<void>;
  const users: Record<string, any> = {
    faculty: {
      id: 'faculty',
      email: 'faculty@example.test',
      isActive: true,
      role: { code: 'FACULTY' },
      faculty: { departmentId: 'a', firstName: 'Faculty' },
    },
    hod: {
      id: 'hod',
      email: 'hod@example.test',
      isActive: true,
      role: { code: 'HOD' },
      faculty: { departmentId: 'a', firstName: 'HOD' },
    },
    adminA: {
      id: 'adminA',
      email: 'a@example.test',
      isActive: true,
      role: { code: 'ADMIN' },
      adminProfile: { departmentId: 'a' },
    },
    adminB: {
      id: 'adminB',
      email: 'b@example.test',
      isActive: true,
      role: { code: 'ADMIN' },
      adminProfile: { departmentId: 'b' },
    },
    unassigned: {
      id: 'unassigned',
      email: 'unassigned@example.test',
      isActive: true,
      role: { code: 'ADMIN' },
    },
    super: {
      id: 'super',
      email: 'super@example.test',
      isActive: true,
      role: { code: 'SUPER_ADMIN' },
    },
    student: {
      id: 'student',
      email: 'student@example.test',
      isActive: true,
      role: { code: 'STUDENT' },
      student: { departmentId: 'a' },
    },
    coordinator: {
      id: 'coordinator',
      isActive: true,
      role: { code: 'COORDINATOR' },
    },
  };
  const db: any = {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    notices: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    notice_reads: { create: jest.fn(), upsert: jest.fn() },
    notifications: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  db.notice_attachments = { findUnique: jest.fn() };
  const storage = {
    uploadNoticeAttachment: jest.fn(),
    deleteObject: jest.fn(),
    getObjectStream: jest.fn(),
  };
  const ai = { enrich: jest.fn() };
  const base = () => ({
    id: 'notice',
    authorId: 'faculty',
    departmentId: 'a',
    title: 'Campus announcement',
    content: 'Attend the orientation.',
    category: 'ACADEMIC',
    priority: 'NORMAL',
    targetScope: 'DEPARTMENT',
    status: 'DRAFT',
    isArchived: false,
    isPinned: false,
    publishAt: new Date(0),
    expiresAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    approvedById: null,
    approvedAt: null,
    rejectionReason: null,
    requiresAcknowledgement: false,
  });
  function matches(row: any, where: any): boolean {
    if (where.id && row.id !== where.id) return false;
    if (typeof where.authorId === 'string' && row.authorId !== where.authorId)
      return false;
    if (where.authorId?.not && row.authorId === where.authorId.not)
      return false;
    if (where.departmentId && row.departmentId !== where.departmentId)
      return false;
    if (where.status && row.status !== where.status) return false;
    if (where.isArchived !== undefined && row.isArchived !== where.isArchived)
      return false;
    if (where.publishAt?.lte && row.publishAt > where.publishAt.lte)
      return false;
    if (
      where.OR &&
      !where.OR.some((clause: any) =>
        clause.expiresAt === null
          ? row.expiresAt === null
          : clause.expiresAt?.gt
            ? row.expiresAt > clause.expiresAt.gt
            : matches(row, clause),
      )
    )
      return false;
    return true;
  }
  function returned(row: any, draft = state) {
    if (!row) return null;
    return {
      ...structuredClone(row),
      users_notices_authorIdTousers: users[row.authorId],
      notice_attachments: draft.attachments.filter(
        (a) => a.noticeId === row.id,
      ),
      notice_reads: [],
      departments: null,
      programs: null,
      _count: { notice_reads: 0 },
    };
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NoticesController],
      providers: [
        NoticesService,
        RolesGuard,
        { provide: PrismaService, useValue: db },
        { provide: StrictR2StorageService, useValue: storage },
        { provide: NoticeEnrichmentService, useValue: ai },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          const user = users[req.headers['x-test-user']];
          if (!user) throw new UnauthorizedException();
          req.user = { id: user.id, role: user.role.code };
          return true;
        },
      })
      .compile();
    service = module.get(NoticesService);
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    state = {
      notices: [base()],
      audits: [],
      notifications: [],
      attachments: [],
    };
    tail = Promise.resolve();
    failAudit = false;
    failNotification = false;
    db.notice_attachments.findUnique.mockImplementation(
      async ({ where }: any) =>
        state.attachments.find((a) => a.id === where.id),
    );
    ai.enrich.mockResolvedValue(null);
    storage.uploadNoticeAttachment.mockResolvedValue('notices/synthetic.pdf');
    storage.deleteObject.mockResolvedValue(undefined);
    db.user.findUnique.mockImplementation(
      async ({ where }: any) => users[where.id],
    );
    db.user.findMany.mockResolvedValue(Object.values(users));
    db.notices.findUnique.mockImplementation(async ({ where }: any) =>
      returned(state.notices.find((row) => row.id === where.id)),
    );
    db.notices.findMany.mockImplementation(
      async ({ where, skip = 0, take = 100 }: any) =>
        state.notices
          .filter((row) => matches(row, where))
          .slice(skip, skip + take)
          .map((row) => returned(row)),
    );
    db.notices.count.mockImplementation(
      async ({ where }: any) =>
        state.notices.filter((row) => matches(row, where)).length,
    );
    db.notifications.createMany.mockImplementation(async ({ data }: any) => {
      state.notifications.push(...data);
      return { count: data.length };
    });
    // Serialize mocked transactions, commit a draft only on success, and fail if
    // review writes escape the transaction. No real DB or external services run.
    db.$transaction.mockImplementation(async (callback: any) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const draft = structuredClone(state);
      const tx: any = {
        $queryRaw: jest.fn(async (_sql: any, id: string) =>
          draft.notices.some((row) => row.id === id) ? [{ id }] : [],
        ),
        user: db.user,
        notices: {
          delete: jest.fn(async ({ where }: any) => {
            const row = draft.notices.find((n) => n.id === where.id);
            draft.notices = draft.notices.filter((n) => n.id !== where.id);
            return row;
          }),
          findUnique: jest.fn(async ({ where }: any) =>
            returned(
              draft.notices.find((row) => row.id === where.id),
              draft,
            ),
          ),
          create: jest.fn(async ({ data }: any) => {
            const row = { ...base(), ...data, id: 'created' };
            draft.notices.push(row);
            return returned(row, draft);
          }),
          update: jest.fn(async ({ where, data }: any) => {
            const row = draft.notices.find(
              (n) =>
                n.id === where.id &&
                (!where.updatedAt ||
                  n.updatedAt.getTime() === where.updatedAt.getTime()),
            );
            if (!row)
              throw new Prisma.PrismaClientKnownRequestError('Stale revision', {
                code: 'P2025',
                clientVersion: '6.19.3',
              });
            Object.assign(row, data);
            return returned(row, draft);
          }),
        },
        notice_attachments: {
          create: jest.fn(async ({ data }: any) => {
            const att = { id: 'attachment', ...data };
            draft.attachments.push(att);
            return att;
          }),
          delete: jest.fn(async ({ where }: any) => {
            draft.attachments = draft.attachments.filter(
              (a) => a.id !== where.id,
            );
            return {};
          }),
        },
        notice_audit_logs: {
          findFirst: jest.fn(
            async ({ where }: any) =>
              draft.audits.find(
                (a) =>
                  a.noticeId === where.noticeId &&
                  where.action.in.includes(a.action),
              ) ?? null,
          ),
          create: jest.fn(async ({ data }: any) => {
            if (failAudit) throw new Error('audit unavailable');
            draft.audits.push(data);
            return data;
          }),
        },
        notifications: {
          createMany: jest.fn(async ({ data }: any) => {
            if (failNotification) throw new Error('notification unavailable');
            draft.notifications.push(...data);
            return { count: data.length };
          }),
        },
      };
      try {
        const result = await callback(tx);
        state = draft;
        return result;
      } finally {
        release();
      }
    });
  });
  const revision = () => state.notices[0].updatedAt.toISOString();
  const action = (
    name: string,
    user: string,
    body: object = { expectedUpdatedAt: revision() },
  ) =>
    request(app.getHttpServer())
      .post('/api/v1/notices/notice/' + name)
      .set('x-test-user', user)
      .send(body);
  const pending = () => {
    state.notices[0].status = 'PENDING_REVIEW';
  };

  it('allows deleting an unsubmitted draft', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/notices/notice')
      .set('x-test-user', 'faculty')
      .expect(200);
    expect(state.notices).toHaveLength(0);
  });

  it('preserves review history when a reviewed notice returns to draft', async () => {
    state.audits.push({ noticeId: 'notice', action: 'SUBMITTED_FOR_REVIEW' });
    await request(app.getHttpServer())
      .delete('/api/v1/notices/notice')
      .set('x-test-user', 'faculty')
      .expect(409);
    expect(state.notices).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
  });

  it.each(['faculty', 'hod'])(
    'holds %s publication requests for review without notifications',
    async (user) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/notices')
        .set('x-test-user', user)
        .send({ title: 'Title', content: 'Body', status: 'PUBLISHED' })
        .expect(201);
      expect(response.body.status).toBe('PENDING_REVIEW');
      expect(response.body.approvedById).toBeNull();
      expect(state.notifications).toEqual([]);
    },
  );
  it('preserves direct admin publishing under the selected policy', async () => {
    jest.spyOn(service, 'notifyAudience').mockResolvedValue(undefined);
    const result = await request(app.getHttpServer())
      .post('/api/v1/notices')
      .set('x-test-user', 'adminA')
      .send({ title: 'Title', content: 'Body' })
      .expect(201);
    expect(result.body.status).toBe('PUBLISHED');
  });
  it('supports draft → pending → approved/publication with reviewer identity and audit', async () => {
    await action('submit', 'faculty').expect(200);
    expect(state.notices[0].status).toBe('PENDING_REVIEW');
    expect(state.notifications).toHaveLength(0);
    const approval = await action('approve', 'adminA').expect(200);
    expect(approval.body).toMatchObject({
      status: 'PUBLISHED',
      approvedById: 'adminA',
      rejectionReason: null,
    });
    expect(approval.body.approvedAt).toBeTruthy();
    expect(state.audits.map((a) => a.action)).toEqual([
      'SUBMITTED_FOR_REVIEW',
      'APPROVED',
    ]);
    expect(state.notifications.length).toBeGreaterThan(0);
  });
  it('approves future notices into SCHEDULED without sending early notifications', async () => {
    pending();
    state.notices[0].publishAt = new Date(Date.now() + 86400000);
    await action('approve', 'adminA').expect(200);
    expect(state.notices[0].status).toBe('SCHEDULED');
    expect(
      state.notifications.filter((n) => n.type === 'NOTICE_NEW'),
    ).toHaveLength(0);
    expect(state.notifications[0]).toMatchObject({
      userId: 'faculty',
      type: 'NOTICE_APPROVED',
    });
  });
  it('supports rejection, revision, and author resubmission', async () => {
    pending();
    await action('reject', 'adminA', {
      expectedUpdatedAt: revision(),
      reason: 'Please correct the venue.',
    }).expect(200);
    expect(state.notices[0].status).toBe('REJECTED');
    expect(state.notices[0].rejectionReason).toBe('Please correct the venue.');
    await service.updateNotice('faculty', 'FACULTY', 'notice', {
      content: 'Corrected venue.',
    });
    expect(state.notices[0].status).toBe('DRAFT');
    await action('submit', 'faculty').expect(200);
    expect(state.notices[0].status).toBe('PENDING_REVIEW');
    expect(state.notices[0].rejectionReason).toBeNull();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      userId: 'faculty',
      type: 'NOTICE_REJECTED',
    });
  });
  it.each(['student', 'faculty', 'hod', 'coordinator'])(
    'denies approval and rejection by %s',
    async (user) => {
      pending();
      await action('approve', user).expect(403);
      await action('reject', user, {
        expectedUpdatedAt: revision(),
        reason: 'Reason supplied',
      }).expect(403);
      expect(state.audits).toHaveLength(0);
    },
  );
  it('blocks self-approval even for an admin author', async () => {
    pending();
    state.notices[0].authorId = 'adminA';
    await action('approve', 'adminA').expect(403);
    await action('reject', 'adminA', {
      expectedUpdatedAt: revision(),
      reason: 'Self rejection',
    }).expect(403);
  });
  it('limits department admins to their own review scope', async () => {
    pending();
    await action('approve', 'adminB').expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/notices/management/review-queue')
      .set('x-test-user', 'adminB')
      .expect(200)
      .expect((res) => expect(res.body.items).toEqual([]));
    await request(app.getHttpServer())
      .get('/api/v1/notices/management/review-queue')
      .set('x-test-user', 'adminA')
      .expect(200)
      .expect((res) =>
        expect(res.body.items.map((n) => n.id)).toEqual(['notice']),
      );
  });
  it('fails closed for an unassigned admin reviewer', async () => {
    pending();
    await action('approve', 'unassigned').expect(403);
  });
  it('allows SUPER_ADMIN to review across department boundaries', async () => {
    pending();
    await action('approve', 'super').expect(200);
    expect(state.notices[0].approvedById).toBe('super');
  });
  it.each(['approve', 'reject', 'submit'])(
    'requires authentication for %s',
    async (name) => {
      await request(app.getHttpServer())
        .post('/api/v1/notices/notice/' + name)
        .send({ expectedUpdatedAt: revision(), reason: 'Reason' })
        .expect(401);
    },
  );
  it.each([undefined, null, 'not-a-date'])(
    'requires a valid revision for approval: %j',
    async (expectedUpdatedAt) => {
      pending();
      await action('approve', 'adminA', { expectedUpdatedAt }).expect(400);
    },
  );
  it.each(['', '  ', 'a'])(
    'requires a meaningful rejection reason %j',
    async (reason) => {
      pending();
      await action('reject', 'adminA', {
        expectedUpdatedAt: revision(),
        reason,
      }).expect(400);
    },
  );
  it('rejects stale reviewer decisions after a concurrent source edit', async () => {
    pending();
    const old = revision();
    await service.updateNotice('faculty', 'FACULTY', 'notice', {
      content: 'Changed after review opened.',
    });
    await action('approve', 'adminA', { expectedUpdatedAt: old }).expect(409);
    expect(state.notices[0].status).toBe('PENDING_REVIEW');
  });
  it('prevents duplicate approval and notifications across concurrent requests', async () => {
    pending();
    const old = revision();
    const results = await Promise.all([
      action('approve', 'adminA', { expectedUpdatedAt: old }),
      action('approve', 'super', { expectedUpdatedAt: old }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(state.audits.filter((a) => a.action === 'APPROVED')).toHaveLength(1);
  });
  it('rolls back approval when notification creation fails', async () => {
    pending();
    failNotification = true;
    await action('approve', 'adminA').expect(500);
    expect(state.notices[0].status).toBe('PENDING_REVIEW');
    expect(state.notices[0].approvedById).toBeNull();
    expect(state.audits).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
  });
  it('rolls back rejection when auditing fails', async () => {
    pending();
    failAudit = true;
    await action('reject', 'adminA', {
      expectedUpdatedAt: revision(),
      reason: 'Incorrect venue',
    }).expect(500);
    expect(state.notices[0].status).toBe('PENDING_REVIEW');
    expect(state.notices[0].rejectionReason).toBeNull();
  });
  it.each(['PUBLISHED', 'SCHEDULED', 'REJECTED', 'WITHDRAWN'])(
    'does not review a notice in state %s',
    async (status) => {
      state.notices[0].status = status;
      await action('approve', 'adminA').expect(409);
    },
  );
  it('never approves an archived or expired notice', async () => {
    pending();
    state.notices[0].isArchived = true;
    await action('approve', 'adminA').expect(409);
    state.notices[0].isArchived = false;
    state.notices[0].expiresAt = new Date(0);
    await action('approve', 'adminA').expect(400);
  });
  it('does not let another publisher submit the author’s draft', async () => {
    await action('submit', 'hod').expect(403);
  });
  it('blocks approval field spoofing and direct publication of a pending notice', async () => {
    pending();
    await request(app.getHttpServer())
      .put('/api/v1/notices/notice')
      .set('x-test-user', 'faculty')
      .send({ approvedById: 'adminA', approvedAt: new Date().toISOString() })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/v1/notices/notice')
      .set('x-test-user', 'adminA')
      .send({ status: 'PUBLISHED' })
      .expect(409);
    await request(app.getHttpServer())
      .put('/api/v1/notices/notice')
      .set('x-test-user', 'faculty')
      .send({ rejectionReason: null })
      .expect(400);
  });
  it('invalidates previous approval when faculty changes an approved notice', async () => {
    state.notices[0] = {
      ...base(),
      status: 'PUBLISHED',
      approvedById: 'adminA',
      approvedAt: new Date(),
    };
    await service.updateNotice('faculty', 'FACULTY', 'notice', {
      priority: 'HIGH' as any,
    });
    expect(state.notices[0]).toMatchObject({
      status: 'PENDING_REVIEW',
      approvedById: null,
      approvedAt: null,
    });
  });
  it('invalidates an approved revision when an attachment is added', async () => {
    state.notices[0] = {
      ...base(),
      status: 'PUBLISHED',
      approvedById: 'adminA',
      approvedAt: new Date(),
    };
    await service.uploadAttachment('faculty', 'FACULTY', 'notice', {
      originalname: 'demo.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 demo'),
      size: 13,
    } as any);
    expect(state.notices[0]).toMatchObject({
      status: 'PENDING_REVIEW',
      approvedById: null,
    });
    expect(state.attachments).toHaveLength(1);
  });
  it('increments revisions even when two edits happen during the same clock millisecond', async () => {
    const now = new Date();
    state.notices[0].updatedAt = now;
    await service.updateNotice('faculty', 'FACULTY', 'notice', {
      title: 'Revised title',
    });
    expect(state.notices[0].updatedAt.getTime()).toBeGreaterThan(now.getTime());
  });
  it('does not record a recipient read when the publisher previews a pending notice', async () => {
    pending();
    const notice = await service.getNoticeById('faculty', 'notice');
    expect(notice.isRead).toBe(false);
    expect(db.notice_reads.create).not.toHaveBeenCalled();
  });
  it('invalidates approval when an attachment is removed', async () => {
    state.notices[0] = {
      ...base(),
      status: 'PUBLISHED',
      approvedById: 'adminA',
      approvedAt: new Date(),
    };
    state.attachments = [
      {
        id: 'attachment',
        noticeId: 'notice',
        fileKey: 'notices/synthetic.pdf',
      },
    ];
    await service.deleteAttachment(
      'faculty',
      'FACULTY',
      'notice',
      'attachment',
    );
    expect(state.notices[0]).toMatchObject({
      status: 'PENDING_REVIEW',
      approvedById: null,
    });
    expect(state.attachments).toHaveLength(0);
  });
  it.each(['PENDING_REVIEW', 'REJECTED'])(
    'keeps %s notices out of recipient feeds and attachment streams',
    async (status) => {
      state.notices[0].status = status;
      await request(app.getHttpServer())
        .get('/api/v1/notices')
        .set('x-test-user', 'student')
        .expect(200)
        .expect((res) => expect(res.body.items).toEqual([]));
      await request(app.getHttpServer())
        .get('/api/v1/notices/notice/attachments/attachment/stream')
        .set('x-test-user', 'student')
        .expect(403);
      expect(storage.getObjectStream).not.toHaveBeenCalled();
    },
  );
  it('ignores status-filter attempts to escape the review queue', async () => {
    pending();
    state.notices.push({ ...base(), id: 'published', status: 'PUBLISHED' });
    await request(app.getHttpServer())
      .get('/api/v1/notices/management/review-queue?status=PUBLISHED')
      .set('x-test-user', 'adminA')
      .expect(200)
      .expect((res) =>
        expect(res.body.items.map((n) => n.id)).toEqual(['notice']),
      );
  });
  it('does not allow a stale editor to overwrite a reviewed revision', async () => {
    const old = revision();
    await service.updateNotice('faculty', 'FACULTY', 'notice', {
      title: 'Changed title',
    });
    await request(app.getHttpServer())
      .put('/api/v1/notices/notice')
      .set('x-test-user', 'faculty')
      .send({ content: 'Stale body', expectedUpdatedAt: old })
      .expect(409);
  });
  it('rejects spoofed service reviewer roles against the current account', async () => {
    pending();
    await expect(
      service.approveNotice('faculty', 'ADMIN', 'notice', revision()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rolls back attachment changes and cleans the new file if auditing fails', async () => {
    state.notices[0] = {
      ...base(),
      status: 'PUBLISHED',
      approvedById: 'adminA',
      approvedAt: new Date(),
    };
    failAudit = true;
    await expect(
      service.uploadAttachment('faculty', 'FACULTY', 'notice', {
        originalname: 'demo.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 demo'),
        size: 13,
      } as any),
    ).rejects.toThrow('audit unavailable');
    expect(state.notices[0]).toMatchObject({
      status: 'PUBLISHED',
      approvedById: 'adminA',
    });
    expect(state.attachments).toHaveLength(0);
    expect(storage.deleteObject).toHaveBeenCalledWith('notices/synthetic.pdf');
  });
});
