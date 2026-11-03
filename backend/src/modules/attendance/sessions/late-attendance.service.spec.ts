import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  LateAttendanceService,
  lectureWindow,
} from './late-attendance.service';
import { AttendanceAccessService } from './attendance-access.service';
import { SessionRepository } from './repositories/session.repository';
import { RecordRepository } from '../records/repositories/record.repository';
import { RecordsService } from '../records/records.service';
import { OfflineAttendanceService } from '../records/offline-attendance.service';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LateRequestDto, LateDecisionDto } from './late-attendance.controller';

function memoryDatabase() {
  const person = (id: string, role: string, departmentId = 'dept') => ({
    id,
    email: `${id}@example.test`,
    isActive: true,
    role: { code: role, isActive: true },
    faculty: { id: `${id}-faculty`, userId: id, isActive: true, departmentId },
    adminProfile: { departmentId },
  });
  let state: any = {
    users: [
      person('teacher', 'FACULTY'),
      person('other', 'FACULTY'),
      person('admin', 'ADMIN'),
      person('hod', 'HOD'),
      person('foreign', 'ADMIN', 'elsewhere'),
      person('student', 'STUDENT'),
    ],
    schedule: {
      id: 'lecture',
      templateId: 'template',
      lectureDate: new Date('2026-11-03'),
      status: 'SCHEDULED',
      exceptions: [],
      template: {
        id: 'template',
        sectionId: 'section',
        subjectId: 'subject',
        startTime: '09:00 AM',
        endTime: '10:00 AM',
        faculty: { id: 'teacher-faculty', userId: 'teacher', isActive: true },
        subject: { code: 'CS-1', name: 'Algorithms' },
        section: {
          name: 'C',
          semester: {
            number: 1,
            program: { name: 'B.Tech', departmentId: 'dept' },
          },
        },
      },
    },
    session: {
      id: 'session',
      scheduleId: 'lecture',
      status: 'OPEN',
      attendanceDate: new Date('2026-11-03'),
      takenBy: { userId: 'teacher' },
    },
    students: [{ id: 's1', isActive: true, sectionId: 'section' }],
    records: [],
    requests: [],
    events: [],
    notifications: [],
  };
  function match(row: any, where: any): boolean {
    if (!where) return true;
    if (!row) return false;
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'AND') return value.every((w) => match(row, w));
      if (key === 'OR') return value.some((w) => match(row, w));
      const actual = row[key] ?? null;
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('in' in value) return value.in.includes(actual);
        if ('not' in value) return actual !== value.not;
        if ('gt' in value) return actual > value.gt;
        return match(actual, value);
      }
      return value instanceof Date ? +actual === +value : actual === value;
    });
  }
  const schedule = () => ({
    ...structuredClone(state.schedule),
    attendanceSessions: [
      { id: state.session.id, status: state.session.status },
    ],
  });
  const session = () => ({
    ...structuredClone(state.session),
    schedule: schedule(),
    records: structuredClone(state.records),
  });
  const hydrate = (row: any) =>
    row
      ? {
          ...structuredClone(row),
          schedule: schedule(),
          requester: state.users.find((u) => u.id === row.requesterId),
          reviewer: state.users.find((u) => u.id === row.reviewerId),
          events: state.events.filter((e) => e.requestId === row.id),
        }
      : null;
  const db: any = {
    user: {
      findUnique: jest.fn(async ({ where }) =>
        state.users.find((u) => u.id === where.id),
      ),
      findMany: jest.fn(async ({ where }) =>
        state.users.filter((u) => match(u, where)),
      ),
    },
    adminProfile: {
      findUnique: jest.fn(
        async ({ where }) =>
          state.users.find((u) => u.id === where.userId)?.adminProfile,
      ),
    },
    faculty: {
      findUnique: jest.fn(
        async ({ where }) =>
          state.users.find((u) => u.id === where.userId)?.faculty,
      ),
    },
    schedule: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === state.schedule.id ? schedule() : null,
      ),
    },
    student: {
      findMany: jest.fn(async ({ where }) =>
        state.students.filter((s) => match(s, where)),
      ),
      count: jest.fn(
        async ({ where }) =>
          state.students.filter((s) => match(s, where)).length,
      ),
    },
    attendanceSession: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === state.session.id ? session() : null,
      ),
      findFirst: jest.fn(async ({ where }) =>
        match(session(), where) ? session() : null,
      ),
      updateMany: jest.fn(async ({ where, data }) => {
        if (!match(state.session, where)) return { count: 0 };
        Object.assign(state.session, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }) => {
        Object.assign(state.session, data);
        return session();
      }),
      create: jest.fn(async ({ data }) => ({ ...data, id: 'new-session' })),
    },
    attendanceRecord: {
      upsert: jest.fn(async ({ where, create, update }) => {
        let row = state.records.find((r) =>
          match(r, where.attendanceSessionId_studentId),
        );
        if (row) Object.assign(row, update);
        else {
          row = { id: randomUUID(), ...create };
          state.records.push(row);
        }
        return row;
      }),
      createMany: jest.fn(async ({ data }) => {
        for (const row of data)
          state.records.push({ id: randomUUID(), ...row });
      }),
      update: jest.fn(async ({ where, data }) =>
        Object.assign(
          state.records.find((r) => r.id === where.id),
          data,
        ),
      ),
    },
    lateAttendanceRequest: {
      create: jest.fn(async ({ data }) => {
        if (
          state.requests.some(
            (r) =>
              r.status === 'PENDING' &&
              r.requesterId === data.requesterId &&
              r.scheduleId === data.scheduleId,
          )
        )
          throw { code: 'P2002' };
        const row = {
          id: randomUUID(),
          status: 'PENDING',
          usedAt: null,
          expiresAt: null,
          createdAt: new Date(),
          ...data,
        };
        state.requests.push(row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }) =>
        hydrate(state.requests.find((r) => match(r, where))),
      ),
      findUnique: jest.fn(async ({ where }) =>
        hydrate(state.requests.find((r) => r.id === where.id)),
      ),
      findMany: jest.fn(async ({ where }) =>
        state.requests.map(hydrate).filter((r) => match(r, where)),
      ),
      updateMany: jest.fn(async ({ where, data }) => {
        const rows = state.requests.filter((r) => match(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      }),
    },
    lateAttendanceEvent: {
      create: jest.fn(async ({ data }) => {
        const row = { id: randomUUID(), createdAt: new Date(), ...data };
        state.events.push(row);
        return row;
      }),
    },
    notifications: {
      create: jest.fn(async ({ data }) => {
        state.notifications.push(data);
        return data;
      }),
    },
  };
  let tail = Promise.resolve();
  db.$transaction = jest.fn((callback: any) => {
    const result = tail.then(async () => {
      const before = structuredClone(state);
      try {
        return await callback(db);
      } catch (error) {
        state = before;
        throw error;
      }
    });
    tail = result.then(
      () => {},
      () => {},
    );
    return result;
  });
  return {
    db,
    get state() {
      return state;
    },
  };
}

describe('Late attendance workflow and actual write paths', () => {
  let store: ReturnType<typeof memoryDatabase>,
    service: LateAttendanceService,
    access: AttendanceAccessService;
  const actor = { id: 'teacher', role: 'FACULTY' },
    marks = [{ studentId: 's1', status: 'PRESENT' }] as any;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-03T08:00:00Z'));
    store = memoryDatabase();
    service = new LateAttendanceService(store.db);
    access = new AttendanceAccessService(store.db);
  });
  afterEach(() => jest.useRealTimers());
  const request = () =>
    service.create(
      'teacher',
      'lecture',
      'Connectivity failed during the class.',
    );
  async function approved() {
    const row = await request();
    await service.review('admin', row.id, 'APPROVED');
    return row.id;
  }
  function records() {
    return new RecordsService(
      new RecordRepository(store.db),
      new SessionRepository(store.db),
      access,
    );
  }
  it('creates an owned lecture request and notifies only its department reviewers', async () => {
    const row = await request();
    expect(row.requesterId).toBe('teacher');
    expect(store.state.notifications.map((n) => n.userId).sort()).toEqual([
      'admin',
      'hod',
    ]);
    expect(store.state.events[0]).toMatchObject({
      actorId: 'teacher',
      action: 'REQUESTED',
    });
  });
  it.each(['other', 'student', 'admin'])(
    'rejects request from unassigned/nonfaculty %s',
    async (id) => {
      await expect(
        service.create(id, 'lecture', 'Reason'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(store.state.requests).toHaveLength(0);
    },
  );
  it('rejects duplicate pending requests and blank reasons', async () => {
    await request();
    await expect(request()).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.create('teacher', 'lecture', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('keeps approval decisions immutable and handles concurrent reviewers', async () => {
    const row = await request();
    const results = await Promise.allSettled([
      service.review('admin', row.id, 'APPROVED'),
      service.review('hod', row.id, 'REJECTED'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(store.state.events).toHaveLength(2);
    await expect(
      service.review('admin', row.id, 'REJECTED'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each(['foreign', 'teacher', 'student'])(
    'rejects unauthorized reviewer %s',
    async (id) => {
      const row = await request();
      await expect(
        service.review(id, row.id, 'APPROVED'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(store.state.requests[0].status).toBe('PENDING');
    },
  );
  it('scopes faculty history and Admin/HOD queues, including empty foreign queues', async () => {
    await request();
    expect((await service.mine('teacher')).items).toHaveLength(1);
    expect((await service.mine('other')).items).toHaveLength(0);
    expect(await service.queue('admin')).toHaveLength(1);
    expect(await service.queue('hod')).toHaveLength(1);
    expect(await service.queue('foreign')).toHaveLength(0);
    await expect(service.queue('student')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('records rejection remarks and allows a new request', async () => {
    const row = await request();
    await service.review(
      'admin',
      row.id,
      'REJECTED',
      'Please attach the reason for delay.',
    );
    expect(store.state.requests[0].reviewRemark).toContain('reason');
    await expect(request()).resolves.toBeDefined();
  });
  it('permits optional rejection remarks', async () => {
    const row = await request();
    await service.review('admin', row.id, 'REJECTED');
    expect(store.state.requests[0].reviewRemark).toBeNull();
  });
  it('permits the full fifteen-minute grace period without approval', async () => {
    jest.setSystemTime(new Date('2026-11-03T04:45:00Z')); // 10:15 IST, end + 15 minutes
    await expect(
      records().submitRecords('session', { records: marks }, actor),
    ).resolves.toMatchObject({ success: true });
    expect(store.state.requests).toHaveLength(0);
    await expect(request()).rejects.toBeInstanceOf(BadRequestException);
  });
  it('blocks faculty record saves immediately after grace and before the opening time', async () => {
    jest.setSystemTime(new Date('2026-11-03T04:45:00.001Z'));
    await expect(
      records().submitRecords('session', { records: marks }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    jest.setSystemTime(new Date('2026-11-03T03:19:59Z'));
    await expect(
      records().submitRecords('session', { records: marks }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.state.records).toHaveLength(0);
  });
  it.each(['ADMIN', 'HOD', 'COORDINATOR'])(
    'preserves scoped %s operational marking without a late request',
    async (role) => {
      const userId =
        role === 'ADMIN' ? 'admin' : role === 'HOD' ? 'hod' : 'teacher';
      await expect(
        records().submitRecords(
          'session',
          { records: marks },
          { id: userId, role },
        ),
      ).resolves.toMatchObject({ success: true });
    },
  );
  it('lets approved faculty save and submit, consumes permission once, and preserves the locked session', async () => {
    const id = await approved();
    expect((await service.mine('teacher')).approvedScheduleIds).toEqual([
      'lecture',
    ]);
    await records().submitRecords('session', { records: marks }, actor);
    const repository = new SessionRepository(store.db);
    await repository.submit('session', (tx) =>
      access.authorizeMarking('session', actor, tx, true),
    );
    expect(store.state.session.status).toBe('SUBMITTED');
    expect(store.state.requests.find((r) => r.id === id).usedAt).toBeInstanceOf(
      Date,
    );
    expect(store.state.events.map((e) => e.action)).toEqual([
      'REQUESTED',
      'APPROVED',
      'USED',
    ]);
    await expect(
      records().submitRecords('session', { records: marks }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.mine('teacher')).approvedScheduleIds).toHaveLength(0);
  });
  it('does not consume approval for incomplete rosters or failed writes', async () => {
    await approved();
    await expect(
      new SessionRepository(store.db).submit('session', (tx) =>
        access.authorizeMarking('session', actor, tx, true),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.state.requests[0].usedAt).toBeNull();
    expect(store.state.session.status).toBe('OPEN');
    store.db.attendanceRecord.upsert.mockRejectedValueOnce(
      new Error('Synthetic failure'),
    );
    await expect(
      records().submitRecords('session', { records: marks }, actor),
    ).rejects.toThrow('Synthetic failure');
    expect(store.state.records).toHaveLength(0);
  });
  it('rejects expired and cancelled permission at every save', async () => {
    const id = await approved();
    jest.setSystemTime(new Date('2026-11-04T08:00:00.001Z'));
    await expect(
      records().submitRecords('session', { records: marks }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.mine('teacher')).items[0].effectiveStatus).toBe(
      'EXPIRED',
    );
    await service.cancel('teacher', id);
    await expect(
      records().submitRecords('session', { records: marks }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('invalidates permission after schedule timing or assignment changes', async () => {
    await approved();
    store.state.schedule.template.endTime = '10:05 AM';
    await expect(
      records().submitRecords('session', { records: marks }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.mine('teacher')).items[0].effectiveStatus).toBe(
      'STALE',
    );
    store.state.schedule.template.faculty.userId = 'other';
    await expect(service.enforce('lecture', actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('blocks approval if a pending lecture changed or became submitted', async () => {
    const row = await request();
    store.state.schedule.template.endTime = '10:05 AM';
    await expect(
      service.review('admin', row.id, 'APPROVED'),
    ).rejects.toBeInstanceOf(ConflictException);
    store.state.session.status = 'SUBMITTED';
    await expect(
      service.review('admin', row.id, 'APPROVED'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(request()).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects cancelling someone else’s request and allows cancelling stale pending requests', async () => {
    const row = await request();
    await expect(service.cancel('other', row.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await service.cancel('teacher', row.id);
    expect(store.state.requests[0].status).toBe('CANCELLED');
  });
  it('rolls back approval if notification persistence fails', async () => {
    const row = await request();
    store.db.notifications.create.mockRejectedValueOnce(
      new Error('Notification failure'),
    );
    await expect(service.review('admin', row.id, 'APPROVED')).rejects.toThrow(
      'Notification failure',
    );
    expect(store.state.requests[0].status).toBe('PENDING');
    expect(store.state.events).toHaveLength(1);
  });
  it('blocks atomic offline uploads without approval, permits approved upload, and keeps exact retries idempotent', async () => {
    const offline = new OfflineAttendanceService(store.db, access),
      dto = { records: marks, baseline: '[]' } as any;
    await expect(offline.sync('session', dto, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(store.state.records).toHaveLength(0);
    await approved();
    await offline.sync('session', dto, actor);
    expect(store.state.session.status).toBe('SUBMITTED');
    expect(store.state.events.filter((e) => e.action === 'USED')).toHaveLength(
      1,
    );
    await expect(offline.sync('session', dto, actor)).resolves.toMatchObject({
      success: true,
    });
    expect(store.state.events.filter((e) => e.action === 'USED')).toHaveLength(
      1,
    );
  });
  it('derives new session attendance dates from the lecture, not the supplied client date', async () => {
    await new SessionRepository(store.db).create({
      scheduleId: 'lecture',
      attendanceDate: '2099-01-01',
      takenById: 'teacher-faculty',
    });
    expect(store.db.attendanceSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendanceDate: new Date('2026-11-03'),
        }),
      }),
    );
  });
  it('uses Asia/Kolkata and handles noon/midnight correctly', () => {
    const schedule = structuredClone(store.state.schedule);
    schedule.template.startTime = '12:00 AM';
    schedule.template.endTime = '12:00 PM';
    expect(new Date(lectureWindow(schedule).closes).toISOString()).toBe(
      '2026-11-03T06:45:00.000Z',
    );
  });
  it('fails closed on malformed or reversed timetable times', () => {
    store.state.schedule.template.endTime = '12:05 AM';
    expect(() => lectureWindow(store.state.schedule)).toThrow(
      BadRequestException,
    );
    store.state.schedule.template.endTime = 'bad';
    expect(() => lectureWindow(store.state.schedule)).toThrow(
      BadRequestException,
    );
  });
  it('rejects blank/forged request DTOs and unsupported reviewer decisions', async () => {
    expect(
      (
        await validate(
          plainToInstance(LateRequestDto, {
            scheduleId: 'not-a-uuid',
            reason: 'x',
            requesterId: 'forged',
          }),
          { whitelist: true, forbidNonWhitelisted: true },
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(LateDecisionDto, { decision: 'PENDING' }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
