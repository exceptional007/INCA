import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AttendanceAccessService } from './sessions/attendance-access.service';
import { SessionsController } from './sessions/sessions.controller';
import { SessionsService } from './sessions/sessions.service';
import { SessionRepository } from './sessions/repositories/session.repository';
import { RecordsController } from './records/records.controller';
import { RecordsService } from './records/records.service';
import { RecordRepository } from './records/repositories/record.repository';
import { AuditController } from './audit/audit.controller';
import { AuditService } from './audit/audit.service';
import { AuditRepository } from './audit/repositories/audit.repository';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TimetableImportService } from '../scheduling/timetable-import/timetable-import.service';

const sessionId = '11111111-1111-4111-8111-111111111111';
const scheduleId = '22222222-2222-4222-8222-222222222222';
const activityId = '33333333-3333-4333-8333-333333333333';
const forgedId = '44444444-4444-4444-8444-444444444444';
const studentId = '55555555-5555-4555-8555-555555555555';
const facultyActor = { id: 'teacher-user', role: 'FACULTY' };

describe('Demo attendance authorization', () => {
  let db: any;
  let access: any;
  let sessions: any;
  let service: TimetableImportService;
  beforeEach(() => {
    db = {
      schedule: { findUnique: jest.fn().mockResolvedValue({ id: scheduleId }) },
      timetableSlot: { findFirst: jest.fn() },
      scheduleTemplate: { create: jest.fn() },
      attendanceSession: { create: jest.fn() },
      student: { findMany: jest.fn().mockResolvedValue([]) },
    };
    access = {
      facultyIdForActor: jest.fn().mockResolvedValue('own-faculty'),
      assertSourceAccess: jest.fn().mockResolvedValue(undefined),
      demoSlotScope: jest
        .fn()
        .mockResolvedValue({ faculty: { userId: facultyActor.id } }),
    };
    sessions = {
      getRoster: jest.fn().mockResolvedValue({ data: [] }),
      create: jest
        .fn()
        .mockResolvedValue({ data: { id: sessionId, records: [] } }),
    };
    service = new TimetableImportService(
      db,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      access,
      sessions,
    );
  });

  it('delegates demo session creation to the authenticated attendance service', async () => {
    await service.createTestLectureSession({ scheduleId }, facultyActor);
    expect(access.assertSourceAccess).toHaveBeenCalledWith(facultyActor, {
      scheduleId,
    });
    expect(sessions.create).toHaveBeenCalledWith(
      { scheduleId, attendanceDate: expect.any(String) },
      facultyActor,
    );
    expect(db.attendanceSession.create).not.toHaveBeenCalled();
    expect(sessions.getRoster).toHaveBeenCalledWith(sessionId, facultyActor);
    expect(db.student.findMany).not.toHaveBeenCalled();
  });

  it("rejects another lecturer's schedule before any demo writes or roster reads", async () => {
    access.assertSourceAccess.mockRejectedValue(new ForbiddenException());
    await expect(
      service.createTestLectureSession({ scheduleId }, facultyActor),
    ).rejects.toThrow(ForbiddenException);
    expect(sessions.create).not.toHaveBeenCalled();
    expect(db.student.findMany).not.toHaveBeenCalled();
    expect(db.schedule.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unauthorized timetable slot before creating a schedule', async () => {
    db.timetableSlot.findFirst.mockResolvedValue(null);
    await expect(
      service.createTestLectureSession({ slotId: 'other-slot' }, facultyActor),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.timetableSlot.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'other-slot',
        AND: [{ faculty: { userId: facultyActor.id } }],
      },
      select: { id: true },
    });
    expect(db.scheduleTemplate.create).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('scopes fallback demo selection instead of taking an arbitrary campus slot', async () => {
    db.timetableSlot.findFirst.mockResolvedValue(null);
    await expect(
      service.createTestLectureSession({}, facultyActor),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.timetableSlot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { version: { isActive: true } },
            { faculty: { userId: facultyActor.id } },
          ],
        },
      }),
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('does not invent a faculty identity for demo attendance', async () => {
    access.facultyIdForActor.mockRejectedValue(new ForbiddenException());
    await expect(
      service.createTestLectureSession({ scheduleId }, facultyActor),
    ).rejects.toThrow(ForbiddenException);
    expect(db.schedule.findUnique).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });
});

describe('Attendance access policy', () => {
  let prisma: any;
  let access: AttendanceAccessService;
  beforeEach(() => {
    prisma = {
      adminProfile: {
        findUnique: jest.fn().mockResolvedValue({ departmentId: 'dept-a' }),
      },
      faculty: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'own-faculty', departmentId: 'dept-a' }),
      },
      attendanceSession: {
        findFirst: jest.fn().mockResolvedValue({ id: sessionId }),
      },
      schedule: {
        findUnique: jest.fn().mockResolvedValue({ id: scheduleId }),
        findFirst: jest.fn().mockResolvedValue({ id: scheduleId }),
      },
      activity: {
        findUnique: jest.fn().mockResolvedValue({ id: activityId }),
        findFirst: jest.fn().mockResolvedValue({ id: activityId }),
      },
    };
    access = new AttendanceAccessService(prisma);
  });

  it('scopes faculty sessions to ownership, lectures (including substitutions), or activities', async () => {
    expect(await access.sessionScope(facultyActor, true)).toEqual({
      OR: [
        {
          schedule: {
            OR: [
              { template: { faculty: { userId: facultyActor.id } } },
              {
                exceptions: {
                  some: { newFaculty: { userId: facultyActor.id } },
                },
              },
            ],
          },
        },
        { activity: { faculty: { userId: facultyActor.id } } },
        { takenBy: { userId: facultyActor.id } },
      ],
    });
  });

  it.each(['ADMIN', 'HOD'])(
    'limits %s to its database-assigned department',
    async (role) => {
      const actor = { id: 'actor', role };
      const scope = await access.sessionScope(actor, true);
      expect(scope).toEqual({
        OR: [
          {
            schedule: {
              template: {
                section: { semester: { program: { departmentId: 'dept-a' } } },
              },
            },
          },
          { activity: { faculty: { departmentId: 'dept-a' } } },
        ],
      });
      await access.assertSessionAccess(sessionId, actor, true);
      expect(prisma.attendanceSession.findFirst).toHaveBeenCalledWith({
        where: { id: sessionId, AND: [scope] },
        select: { id: true },
      });
    },
  );

  it.each(['ADMIN', 'HOD'])(
    'fails closed for %s without a department',
    async (role) => {
      prisma.adminProfile.findUnique.mockResolvedValue(null);
      prisma.faculty.findUnique.mockResolvedValue(null);
      await expect(
        access.sessionScope({ id: 'actor', role }, true),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it('preserves campus-wide coordinator oversight', async () => {
    expect(
      await access.sessionScope(
        { id: 'coordinator', role: 'COORDINATOR' },
        true,
      ),
    ).toEqual({ OR: [{ schedule: {} }, { activity: {} }] });
  });

  it('permits super-admin reads but forbids writes', async () => {
    const actor = { id: 'super-admin', role: 'SUPER_ADMIN' };
    await expect(access.sessionScope(actor)).resolves.toBeDefined();
    await expect(access.sessionScope(actor, true)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it.each(['STUDENT', 'UNKNOWN', ''])(
    'rejects unsupported role %s',
    async (role) => {
      await expect(
        access.sessionScope({ id: 'actor', role }, true),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it('rejects a missing authenticated actor', async () => {
    await expect(access.sessionScope(undefined as any, true)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects inaccessible session IDs', async () => {
    prisma.attendanceSession.findFirst.mockResolvedValue(null);
    await expect(
      access.assertSessionAccess(sessionId, facultyActor, true),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([{ scheduleId }, { activityId }])(
    'rejects unassigned source %j',
    async (source) => {
      prisma.schedule.findFirst.mockResolvedValue(null);
      prisma.activity.findFirst.mockResolvedValue(null);
      await expect(
        access.assertSourceAccess(facultyActor, source),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it.each([{ scheduleId }, { activityId }])(
    'reports missing source %j',
    async (source) => {
      prisma.schedule.findUnique.mockResolvedValue(null);
      prisma.activity.findUnique.mockResolvedValue(null);
      await expect(
        access.assertSourceAccess(facultyActor, source),
      ).rejects.toMatchObject({ status: 404 });
    },
  );

  it('derives the recording faculty exclusively from authenticated user ID', async () => {
    expect(await access.facultyIdForActor(facultyActor)).toBe('own-faculty');
    expect(prisma.faculty.findUnique).toHaveBeenCalledWith({
      where: { userId: facultyActor.id },
      select: { id: true },
    });
  });

  it('does not substitute another faculty for an account without a faculty profile', async () => {
    prisma.faculty.findUnique.mockResolvedValue(null);
    await expect(access.facultyIdForActor(facultyActor)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('restricts demo slot selection to the same faculty or department scope', async () => {
    expect(await access.demoSlotScope(facultyActor)).toEqual({
      faculty: { userId: facultyActor.id },
    });
    expect(await access.demoSlotScope({ id: 'admin', role: 'ADMIN' })).toEqual({
      version: {
        section: { semester: { program: { departmentId: 'dept-a' } } },
      },
    });
  });
});

describe('Attendance HTTP authorization and actor attribution', () => {
  let app: INestApplication;
  const scope = { OR: [{ takenBy: { userId: facultyActor.id } }] };
  const access = {
    sessionScope: jest.fn(),
    assertSessionAccess: jest.fn(),
    assertSourceAccess: jest.fn(),
    facultyIdForActor: jest.fn(),
  };
  const sessions = {
    findBySchedule: jest.fn(),
    findByActivity: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findToday: jest.fn(),
    findByFaculty: jest.fn(),
    submit: jest.fn(),
    getRoster: jest.fn(),
  };
  const records = {
    bulkCreate: jest.fn(),
    findBySession: jest.fn(),
    findById: jest.fn(),
  };
  const audits = {
    editRecordWithAudit: jest.fn(),
    findByRecord: jest.fn(),
    findAll: jest.fn(),
  };
  const paths = [
    {
      method: 'post',
      path: '/sessions',
      body: { scheduleId, attendanceDate: '2026-10-31', takenById: forgedId },
    },
    { method: 'patch', path: `/sessions/${sessionId}/submit` },
    {
      method: 'post',
      path: `/sessions/${sessionId}/records`,
      body: { records: [{ studentId, status: 'PRESENT' }] },
    },
    {
      method: 'patch',
      path: '/records/record-id/edit',
      body: {
        newStatus: 'PRESENT',
        editedById: forgedId,
        reason: 'Correction',
      },
    },
    { method: 'get', path: `/sessions/${sessionId}` },
    { method: 'get', path: `/sessions/${sessionId}/records` },
    { method: 'get', path: '/records/record-id' },
    { method: 'get', path: '/records/record-id/audits' },
    { method: 'get', path: `/sessions/${sessionId}/roster` },
  ] as const;

  function perform(endpoint: (typeof paths)[number], role?: string) {
    let req = request(app.getHttpServer())[endpoint.method](
      `/api/v1/attendance${endpoint.path}`,
    );
    if ('body' in endpoint) req = req.send(endpoint.body);
    return role ? req.set('x-test-role', role) : req;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SessionsController, RecordsController, AuditController],
      providers: [
        SessionsService,
        RecordsService,
        AuditService,
        RolesGuard,
        { provide: AttendanceAccessService, useValue: access },
        { provide: SessionRepository, useValue: sessions },
        { provide: RecordRepository, useValue: records },
        { provide: AuditRepository, useValue: audits },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          const role = req.headers['x-test-role'];
          if (!role) throw new UnauthorizedException();
          req.user = { id: facultyActor.id, role };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
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
  beforeEach(() => {
    jest.clearAllMocks();
    access.sessionScope.mockResolvedValue(scope);
    access.assertSessionAccess.mockResolvedValue(undefined);
    access.assertSourceAccess.mockResolvedValue(undefined);
    access.facultyIdForActor.mockResolvedValue('authenticated-faculty');
    sessions.findBySchedule.mockResolvedValue(null);
    sessions.findByActivity.mockResolvedValue(null);
    sessions.findById.mockResolvedValue({
      id: sessionId,
      status: 'SUBMITTED',
      submittedAt: new Date(),
    });
    sessions.create.mockImplementation(async (data) => ({
      id: sessionId,
      ...data,
    }));
    sessions.findAll.mockResolvedValue([]);
    sessions.findToday.mockResolvedValue([]);
    sessions.findByFaculty.mockResolvedValue([]);
    sessions.getRoster.mockResolvedValue([{ id: studentId }]);
    sessions.submit.mockResolvedValue({ id: sessionId, status: 'SUBMITTED' });
    records.findById.mockResolvedValue({
      id: 'record-id',
      attendanceSessionId: sessionId,
      status: 'ABSENT',
    });
    records.findBySession.mockResolvedValue([]);
    records.bulkCreate.mockResolvedValue([{ studentId, status: 'PRESENT' }]);
    audits.editRecordWithAudit.mockResolvedValue({
      audit: { id: 'audit-id' },
      record: { id: 'record-id' },
    });
    audits.findByRecord.mockResolvedValue([]);
    audits.findAll.mockResolvedValue([]);
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each(paths)(
    'requires authentication for $method $path',
    async (endpoint) => {
      await perform(endpoint).expect(401);
      expect(sessions.create).not.toHaveBeenCalled();
      expect(records.bulkCreate).not.toHaveBeenCalled();
      expect(audits.editRecordWithAudit).not.toHaveBeenCalled();
    },
  );
  it.each(paths)('blocks students from $method $path', async (endpoint) => {
    await perform(endpoint, 'STUDENT').expect(403);
  });
  it.each(paths)(
    'denies unauthorized resource access to $method $path',
    async (endpoint) => {
      access.assertSessionAccess.mockRejectedValue(new ForbiddenException());
      access.assertSourceAccess.mockRejectedValue(new ForbiddenException());
      await perform(endpoint, 'FACULTY').expect(403);
      expect(sessions.create).not.toHaveBeenCalled();
      expect(sessions.submit).not.toHaveBeenCalled();
      expect(records.bulkCreate).not.toHaveBeenCalled();
      expect(audits.editRecordWithAudit).not.toHaveBeenCalled();
      expect(records.findBySession).not.toHaveBeenCalled();
      expect(audits.findByRecord).not.toHaveBeenCalled();
    },
  );

  it.each([{ scheduleId }, { activityId }])(
    'attributes a new session to the caller for %j',
    async (source) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/attendance/sessions')
        .set('x-test-role', 'FACULTY')
        .send({ ...source, attendanceDate: '2026-10-31', takenById: forgedId })
        .expect(201);
      expect(access.assertSourceAccess).toHaveBeenCalledWith(
        facultyActor,
        expect.objectContaining(source),
      );
      expect(access.facultyIdForActor).toHaveBeenCalledWith(facultyActor);
      expect(sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ takenById: 'authenticated-faculty' }),
      );
      expect(response.body.data.takenById).toBe('authenticated-faculty');
    },
  );
  it('accepts session creation without the legacy identity field', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/attendance/sessions')
      .set('x-test-role', 'FACULTY')
      .send({ scheduleId, attendanceDate: '2026-10-31' })
      .expect(201);
  });

  it('returns the authorized session roster without loading a campus-wide student list', async () => {
    const response = await perform(paths[8], 'FACULTY').expect(200);
    expect(response.body.data).toEqual([{ id: studentId }]);
    expect(access.assertSessionAccess).toHaveBeenCalledWith(sessionId, facultyActor);
    expect(sessions.getRoster).toHaveBeenCalledWith(sessionId);
  });
  it("rejects new sessions without the caller's own faculty profile", async () => {
    access.facultyIdForActor.mockRejectedValue(new ForbiddenException());
    await perform(paths[0], 'COORDINATOR').expect(403);
    expect(sessions.create).not.toHaveBeenCalled();
  });
  it('checks access before returning an already opened session', async () => {
    sessions.findBySchedule.mockResolvedValue({ id: sessionId });
    access.assertSessionAccess.mockRejectedValue(new ForbiddenException());
    await perform(paths[0], 'FACULTY').expect(403);
    expect(sessions.create).not.toHaveBeenCalled();
  });
  it('attributes corrections to the authenticated user despite a forged editor ID', async () => {
    await perform(paths[3], 'FACULTY').expect(200);
    expect(access.assertSessionAccess).toHaveBeenCalledWith(
      sessionId,
      facultyActor,
      true,
    );
    expect(audits.editRecordWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({ editedById: facultyActor.id }),
    );
  });
  it('accepts corrections without a legacy editor ID', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/attendance/records/record-id/edit')
      .set('x-test-role', 'FACULTY')
      .send({ newStatus: 'PRESENT', reason: 'Correction' })
      .expect(200);
    expect(audits.editRecordWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({ editedById: facultyActor.id }),
    );
  });
  it.each(['ADMIN', 'HOD', 'COORDINATOR'])(
    'preserves permitted %s corrections',
    async (role) => {
      await perform(paths[3], role).expect(200);
      expect(access.assertSessionAccess).toHaveBeenCalledWith(
        sessionId,
        { id: facultyActor.id, role },
        true,
      );
    },
  );
  it.each(paths.slice(0, 4))(
    'keeps SUPER_ADMIN read-only for $method $path',
    async (endpoint) => {
      await perform(endpoint, 'SUPER_ADMIN').expect(403);
    },
  );
  it('preserves session submission and record saves when authorized', async () => {
    sessions.findById.mockResolvedValue({ id: sessionId, status: 'OPEN' });
    await perform(paths[2], 'FACULTY').expect(201);
    await perform(paths[1], 'FACULTY').expect(200);
    expect(records.bulkCreate).toHaveBeenCalledWith(sessionId, [
      { studentId, status: 'PRESENT' },
    ]);
    expect(sessions.submit).toHaveBeenCalledWith(sessionId);
  });
  it('keeps submitted sessions locked for bulk saves', async () => {
    await perform(paths[2], 'FACULTY').expect(400);
    expect(records.bulkCreate).not.toHaveBeenCalled();
  });
  it('preserves the correction edit window', async () => {
    sessions.findById.mockResolvedValue({
      id: sessionId,
      status: 'SUBMITTED',
      submittedAt: new Date(Date.now() - 25 * 3600000),
    });
    await perform(paths[3], 'FACULTY').expect(403);
    expect(audits.editRecordWithAudit).not.toHaveBeenCalled();
  });
  it.each([
    '/sessions',
    '/sessions/today',
    '/sessions/my-sessions',
    '/sessions/faculty/faculty-id',
    '/audits',
  ])('passes the authorization scope to list queries for %s', async (path) => {
    const role = path === '/audits' ? 'HOD' : 'FACULTY';
    await request(app.getHttpServer())
      .get(`/api/v1/attendance${path}`)
      .set('x-test-role', role)
      .expect(200);
    expect(access.sessionScope).toHaveBeenCalledWith({
      id: facultyActor.id,
      role,
    });
    if (path === '/sessions/today')
      expect(sessions.findToday).toHaveBeenCalledWith(scope);
    else if (path.includes('/faculty/'))
      expect(sessions.findByFaculty).toHaveBeenCalledWith('faculty-id', scope);
    else if (path === '/audits')
      expect(audits.findAll).toHaveBeenCalledWith(scope);
    else expect(sessions.findAll).toHaveBeenCalledWith(scope);
  });
});
