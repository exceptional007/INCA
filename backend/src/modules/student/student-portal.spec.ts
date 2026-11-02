import {
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StudentPortalService } from './student-portal.service';
import { AttendanceObjectionsService } from './attendance-objections.service';
import {
  CreateAttendanceObjectionDto,
  StudentAttendanceFilterDto,
  ReviewAttendanceObjectionDto,
} from './dto/student-portal.dto';

describe('Student attendance privacy and filters', () => {
  let db: any, portal: StudentPortalService;
  beforeEach(() => {
    db = {
      student: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'own-student',
            userId: 'own-user',
            firstName: 'Student',
            rollNumber: '1',
            sectionId: null,
          }),
      },
      subject: { findMany: jest.fn().mockResolvedValue([]) },
      timetableVersion: { findFirst: jest.fn() },
      schedule: { findMany: jest.fn().mockResolvedValue([]) },
      scheduleTemplate: { findMany: jest.fn() },
      attendanceRecord: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PRESENT', _count: { _all: 2 } },
          { status: 'ABSENT', _count: { _all: 1 } },
        ]),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    portal = new StudentPortalService(db);
  });
  it('requires an active student bound to the authenticated user', async () => {
    db.student.findFirst.mockResolvedValue(null);
    await expect(
      portal.attendance('own-user', {} as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'own-user',
          isActive: true,
          user: { isActive: true, role: { code: 'STUDENT', isActive: true } },
        },
      }),
    );
    expect(db.attendanceRecord.findMany).not.toHaveBeenCalled();
  });
  it('uses only own submitted records, including in totals and pagination', async () => {
    const result = await portal.attendance('own-user', {
      page: 2,
      limit: 2,
    } as any);
    for (const method of ['groupBy', 'findMany'])
      expect(db.attendanceRecord[method]).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            studentId: 'own-student',
            attendanceSession: { status: 'SUBMITTED' },
          },
        }),
      );
    expect(db.attendanceRecord.findMany.mock.calls[0][0]).toMatchObject({
      skip: 2,
      take: 2,
    });
    expect(result.summary).toMatchObject({
      total: 3,
      attended: 2,
      percentage: 66.7,
    });
    expect(result.pagination.totalPages).toBe(2);
  });
  it.each([
    [
      { date: '2026-10-30' },
      { gte: new Date('2026-10-30'), lte: new Date('2026-10-30') },
    ],
    [
      { startDate: '2026-10-01', endDate: '2026-10-31' },
      { gte: new Date('2026-10-01'), lte: new Date('2026-10-31') },
    ],
  ])('applies date bounds %p to own data', async (filters, expected) => {
    await portal.attendance('own-user', {
      ...filters,
      subjectId: 'own-subject',
    } as any);
    expect(db.attendanceRecord.findMany.mock.calls[0][0].where).toEqual({
      studentId: 'own-student',
      attendanceSession: {
        status: 'SUBMITTED',
        attendanceDate: expected,
        schedule: { template: { subjectId: 'own-subject' } },
      },
    });
  });
  it.each([
    { date: '2026-10-01', startDate: '2026-10-01' },
    { startDate: '2026-11-01', endDate: '2026-10-01' },
  ])('rejects contradictory date filters %p', async (filters) => {
    await expect(
      portal.attendance('own-user', filters as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('does not infer a timetable for students without a section', async () => {
    const result = await portal.timetable('own-user', '2026-10-30');
    expect(result).toMatchObject({
      sectionAssigned: false,
      weekly: [],
      lectures: [],
    });
    expect(db.timetableVersion.findFirst).not.toHaveBeenCalled();
    expect(db.scheduleTemplate.findMany).not.toHaveBeenCalled();
    expect(db.schedule.findMany.mock.calls[0][0].where.OR).toEqual([
      {
        attendanceSessions: {
          some: {
            status: 'SUBMITTED',
            records: { some: { studentId: 'own-student' } },
          },
        },
      },
    ]);
  });
  it('reports no percentage when there are no submitted records', async () => {
    db.attendanceRecord.groupBy.mockResolvedValue([]);
    expect(
      (await portal.attendance('own-user', {} as any)).summary.percentage,
    ).toBeNull();
  });
});

describe('Attendance objection lifecycle', () => {
  let db: any,
    portal: any,
    service: AttendanceObjectionsService,
    student: any,
    request: any,
    actor: any,
    session: any;
  beforeEach(() => {
    student = {
      id: 'student',
      userId: 'student-user',
      sectionId: 'section',
      departmentId: 'CSE',
      rollNumber: '123',
    };
    actor = {
      id: 'reviewer',
      isActive: true,
      role: { code: 'ADMIN', isActive: true },
      faculty: { departmentId: 'OTHER' },
    };
    session = {
      id: 'lecture-session',
      status: 'SUBMITTED',
      attendanceDate: new Date('2026-01-01'),
      schedule: { status: 'SCHEDULED', template: { sectionId: 'section' } },
      records: [{ id: 'record', status: 'ABSENT' }],
    };
    request = {
      id: 'objection',
      studentId: 'student',
      attendanceSessionId: session.id,
      student,
      attendanceSession: session,
      reason: 'I attended this class.',
      originalStatus: 'ABSENT',
      requestedStatus: 'PRESENT',
      status: 'PENDING',
    };
    db = {
      user: {
        findUnique: jest.fn().mockImplementation(async () => actor),
        findMany: jest.fn().mockImplementation(async () => [actor]),
      },
      attendanceSession: {
        findUnique: jest.fn().mockImplementation(async () => session),
      },
      attendanceObjection: {
        create: jest.fn().mockResolvedValue({ id: 'objection' }),
        findUnique: jest.fn().mockImplementation(async () => request),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      attendanceRecord: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'record', status: 'ABSENT' }),
        upsert: jest
          .fn()
          .mockResolvedValue({ id: 'record', status: 'PRESENT' }),
      },
      attendanceAudit: { create: jest.fn() },
      notifications: { create: jest.fn() },
    };
    db.$transaction = jest.fn(async (callback) => callback(db));
    portal = { student: jest.fn().mockImplementation(async () => student) };
    service = new AttendanceObjectionsService(db, portal);
  });
  const createDto = () =>
    ({
      sessionId: 'lecture-session',
      reason: 'I was present.',
      requestedStatus: 'PRESENT',
    }) as CreateAttendanceObjectionDto;
  it('binds the request to the authenticated student and notifies campus admins', async () => {
    await service.create('student-user', createDto());
    expect(portal.student).toHaveBeenCalledWith('student-user');
    expect(db.attendanceObjection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: 'student',
        attendanceSessionId: 'lecture-session',
        originalStatus: 'ABSENT',
      }),
    });
    expect(db.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'reviewer',
        type: 'ATTENDANCE_OBJECTION',
      }),
    });
  });
  it('allows historical own records after a section transfer', async () => {
    student.sectionId = 'new-section';
    await expect(
      service.create('student-user', createDto()),
    ).resolves.toHaveProperty('id');
  });
  it('blocks a foreign lecture with no own record', async () => {
    student.sectionId = 'other';
    session.records = [];
    await expect(
      service.create('student-user', createDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.attendanceObjection.create).not.toHaveBeenCalled();
  });
  it.each(['OPEN', 'CANCELLED', 'FUTURE', 'ACTIVITY'])(
    'blocks unsupported lecture state %s',
    async (state) => {
      if (state === 'OPEN') session.status = state;
      if (state === 'CANCELLED') session.schedule.status = state;
      if (state === 'FUTURE') session.attendanceDate = new Date('2999-01-01');
      if (state === 'ACTIVITY') session.schedule = null;
      await expect(
        service.create('student-user', createDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('rejects a blank reason', async () => {
    await expect(
      service.create('student-user', { ...createDto(), reason: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('maps the pending unique constraint to a conflict', async () => {
    db.attendanceObjection.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.create('student-user', createDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('permits campus-wide admin review and records the attendance correction audit', async () => {
    await service.review('reviewer', 'objection', { decision: 'APPROVED' });
    expect(db.attendanceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { status: 'PRESENT' } }),
    );
    expect(db.attendanceAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        oldStatus: 'ABSENT',
        newStatus: 'PRESENT',
        editedById: 'reviewer',
      }),
    });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });
  it('creates an audited missing record on approved correction', async () => {
    request.originalStatus = null;
    db.attendanceRecord.findUnique.mockResolvedValue(null);
    await service.review('reviewer', 'objection', { decision: 'APPROVED' });
    expect(db.attendanceAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ oldStatus: 'NOT_RECORDED' }),
    });
  });
  it('does not modify attendance for review-only approvals or rejection', async () => {
    request.requestedStatus = null;
    await service.review('reviewer', 'objection', { decision: 'APPROVED' });
    await service.review('reviewer', 'objection', { decision: 'REJECTED' });
    expect(db.attendanceRecord.upsert).not.toHaveBeenCalled();
    expect(db.attendanceObjection.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          reviewRemark: null,
        }),
      }),
    );
  });
  it.each([
    'self',
    'other-department',
    'inactive',
    'faculty',
    'unassigned-hod',
  ])('blocks unauthorized reviewer: %s', async (kind) => {
    if (kind === 'self') actor.id = student.userId;
    if (kind === 'other-department') actor.role.code = 'HOD';
    if (kind === 'inactive') actor.isActive = false;
    if (kind === 'faculty') actor.role.code = 'FACULTY';
    if (kind === 'unassigned-hod') {
      actor.role.code = 'HOD';
      actor.faculty = null;
    }
    await expect(
      service.review('reviewer', 'objection', { decision: 'APPROVED' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.attendanceRecord.upsert).not.toHaveBeenCalled();
  });
  it('permits department HOD review via section department fallback', async () => {
    actor.role.code = 'HOD';
    actor.faculty.departmentId = 'CSE';
    student.departmentId = null;
    student.section = { semester: { program: { departmentId: 'CSE' } } };
    await expect(
      service.review('reviewer', 'objection', {
        decision: 'REJECTED',
        remark: 'Checked register.',
      }),
    ).resolves.toBeDefined();
  });
  it('scopes the HOD inbox in the database and excludes self', async () => {
    actor.role.code = 'HOD';
    actor.faculty.departmentId = 'CSE';
    await service.queue('reviewer');
    expect(
      db.attendanceObjection.findMany.mock.calls[0][0].where,
    ).toMatchObject({
      student: {
        userId: { not: 'reviewer' },
        OR: [
          { departmentId: 'CSE' },
          {
            departmentId: null,
            section: { semester: { program: { departmentId: 'CSE' } } },
          },
        ],
      },
    });
    expect(
      db.attendanceObjection.findMany.mock.calls[0][0].include.student.include
        .user,
    ).toEqual({ select: { id: true, email: true } });
  });
  it('blocks stale attendance and duplicate decisions', async () => {
    db.attendanceRecord.findUnique.mockResolvedValue({
      id: 'record',
      status: 'LATE',
    });
    await expect(
      service.review('reviewer', 'objection', { decision: 'APPROVED' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.attendanceRecord.upsert).not.toHaveBeenCalled();
    request.status = 'APPROVED';
    await expect(
      service.review('reviewer', 'objection', { decision: 'REJECTED' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('does not write attendance after losing the concurrent decision claim', async () => {
    db.attendanceObjection.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.review('reviewer', 'objection', { decision: 'APPROVED' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.attendanceRecord.upsert).not.toHaveBeenCalled();
  });
});

describe('Student portal input validation', () => {
  it.each([
    { date: '2026-02-30' },
    { page: 0 },
    { limit: 101 },
    { subjectId: 'not-a-uuid' },
  ])('rejects invalid report query %p', async (fields) => {
    expect(
      (await validate(plainToInstance(StudentAttendanceFilterDto, fields)))
        .length,
    ).toBeGreaterThan(0);
  });
  it('requires a supported review decision and limits optional remarks', async () => {
    expect(
      await validate(
        plainToInstance(ReviewAttendanceObjectionDto, { decision: 'REJECTED' }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(ReviewAttendanceObjectionDto, {
            decision: 'INVALID',
            remark: 'a'.repeat(2001),
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
