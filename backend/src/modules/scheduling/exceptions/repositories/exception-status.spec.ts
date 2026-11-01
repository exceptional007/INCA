import { ExceptionRepository } from './exception.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ScheduleStatus } from '@prisma/client';

describe('Schedule exception status consistency', () => {
  let schedules: Record<string, { status: ScheduleStatus }>;
  let exceptions: Record<string, any>;
  let repository: ExceptionRepository;
  let failStatusUpdate: boolean;
  let locks: string[];
  const tx = {
    $queryRaw: jest.fn(),
    schedule: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    scheduleException: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const prisma = { $transaction: jest.fn() };
  const cancellation = {
    id: 'exception',
    scheduleId: 'a',
    exceptionType: 'CANCELLATION',
  };
  beforeEach(() => {
    jest.resetAllMocks();
    schedules = { a: { status: 'CANCELLED' }, b: { status: 'SCHEDULED' } };
    exceptions = { exception: { ...cancellation } };
    locks = [];
    failStatusUpdate = false;
    tx.$queryRaw.mockImplementation(
      async (sql: TemplateStringsArray, id: string) => {
        if (sql.join('').includes('schedule_exceptions'))
          return exceptions[id]
            ? [{ scheduleId: exceptions[id].scheduleId }]
            : [];
        locks.push(id);
        return schedules[id] ? [{ id }] : [];
      },
    );
    tx.schedule.findUniqueOrThrow.mockImplementation(
      async ({ where }) => schedules[where.id],
    );
    tx.schedule.update.mockImplementation(async ({ where, data }) => {
      if (failStatusUpdate) throw new Error('status write failed');
      schedules[where.id] = { ...schedules[where.id], ...data };
      return schedules[where.id];
    });
    tx.scheduleException.findMany.mockImplementation(async ({ where }) =>
      Object.values(exceptions).filter(
        (e) => e.scheduleId === where.scheduleId,
      ),
    );
    tx.scheduleException.create.mockImplementation(async ({ data }) => {
      exceptions.new = { id: 'new', ...data };
      return exceptions.new;
    });
    tx.scheduleException.update.mockImplementation(async ({ where, data }) => {
      exceptions[where.id] = { ...exceptions[where.id], ...data };
      return exceptions[where.id];
    });
    tx.scheduleException.delete.mockImplementation(async ({ where }) => {
      const old = exceptions[where.id];
      delete exceptions[where.id];
      return old;
    });
    // Model transaction rollback; exercise the real repository orchestration.
    prisma.$transaction.mockImplementation(async (callback) => {
      const oldSchedules = structuredClone(schedules),
        oldExceptions = structuredClone(exceptions);
      try {
        return await callback(tx);
      } catch (error) {
        schedules = oldSchedules;
        exceptions = oldExceptions;
        throw error;
      }
    });
    repository = new ExceptionRepository(prisma as unknown as PrismaService);
  });
  it('restores SCHEDULED after deleting the final cancellation', async () => {
    await repository.remove('exception', 'a');
    expect(schedules.a.status).toBe('SCHEDULED');
    expect(exceptions.exception).toBeUndefined();
  });
  it('restores SCHEDULED after deleting the final reschedule', async () => {
    exceptions.exception.exceptionType = 'RESCHEDULE';
    schedules.a.status = 'RESCHEDULED';
    await repository.remove('exception', 'a');
    expect(schedules.a.status).toBe('SCHEDULED');
  });
  it('retains cancellation when another cancellation remains', async () => {
    exceptions.other = { ...cancellation, id: 'other' };
    await repository.remove('exception', 'a');
    expect(schedules.a.status).toBe('CANCELLED');
  });
  it('restores remaining reschedule after deleting cancellation', async () => {
    exceptions.other = {
      id: 'other',
      scheduleId: 'a',
      exceptionType: 'RESCHEDULE',
    };
    await repository.remove('exception', 'a');
    expect(schedules.a.status).toBe('RESCHEDULED');
  });
  it('changes cancellation to rescheduled on edit', async () => {
    await repository.update('exception', { exceptionType: 'RESCHEDULE' }, 'a');
    expect(schedules.a.status).toBe('RESCHEDULED');
  });
  it('restores scheduled after changing to a non-effective exception', async () => {
    await repository.update('exception', { exceptionType: 'NOTE' }, 'a');
    expect(schedules.a.status).toBe('SCHEDULED');
  });
  it('recalculates both schedules when an exception moves', async () => {
    await repository.update('exception', { scheduleId: 'b' }, 'a');
    expect(schedules.a.status).toBe('SCHEDULED');
    expect(schedules.b.status).toBe('CANCELLED');
    expect(locks).toEqual(['a', 'b']);
  });
  it('retains the source schedule status from remaining exceptions on move', async () => {
    exceptions.other = {
      id: 'other',
      scheduleId: 'a',
      exceptionType: 'ROOM_CHANGE',
      newRoomId: 'room',
    };
    await repository.update('exception', { scheduleId: 'b' }, 'a');
    expect(schedules.a.status).toBe('RESCHEDULED');
  });
  it('locks schedules in stable order even when moving backwards', async () => {
    exceptions.exception.scheduleId = 'b';
    await repository.update('exception', { scheduleId: 'a' }, 'b');
    expect(locks).toEqual(['a', 'b']);
  });
  it('does not let new rescheduling override an existing cancellation', async () => {
    await repository.create({ scheduleId: 'a', exceptionType: 'RESCHEDULE' });
    expect(schedules.a.status).toBe('CANCELLED');
  });
  it.each(['newStartTime', 'newEndTime', 'newRoomId', 'newFacultyId'])(
    'detects rescheduling from %s',
    async (key) => {
      exceptions = {};
      schedules.a.status = 'SCHEDULED';
      await repository.create({
        scheduleId: 'a',
        exceptionType: 'CHANGE',
        [key]: 'value',
      });
      expect(schedules.a.status).toBe('RESCHEDULED');
    },
  );
  it('updates a scheduled destination when creating cancellation', async () => {
    await repository.create({ scheduleId: 'b', exceptionType: 'CANCELLATION' });
    expect(schedules.b.status).toBe('CANCELLED');
  });
  it.each(['create', 'update', 'delete'])(
    'preserves completed schedules on %s',
    async (op) => {
      schedules.a.status = 'COMPLETED';
      if (op === 'create')
        await repository.create({
          scheduleId: 'a',
          exceptionType: 'CANCELLATION',
        });
      else if (op === 'update')
        await repository.update(
          'exception',
          { exceptionType: 'RESCHEDULE' },
          'a',
        );
      else await repository.remove('exception', 'a');
      expect(schedules.a.status).toBe('COMPLETED');
    },
  );
  it.each(['create', 'update', 'delete'])(
    'rolls back %s when the status update fails',
    async (op) => {
      failStatusUpdate = true;
      const before = structuredClone({ schedules, exceptions });
      const invoke =
        op === 'create'
          ? () =>
              repository.create({
                scheduleId: 'b',
                exceptionType: 'CANCELLATION',
              })
          : op === 'update'
            ? () => repository.update('exception', { scheduleId: 'b' }, 'a')
            : () => repository.remove('exception', 'a');
      await expect(invoke()).rejects.toThrow('status write failed');
      expect({ schedules, exceptions }).toEqual(before);
    },
  );
  it.each(['update', 'delete'])(
    'rejects %s if the exception moved after authorization',
    async (op) => {
      exceptions.exception.scheduleId = 'b';
      await expect(
        op === 'update'
          ? repository.update('exception', { reason: 'changed' }, 'a')
          : repository.remove('exception', 'a'),
      ).rejects.toMatchObject({ status: 409 });
      expect(tx.scheduleException.update).not.toHaveBeenCalled();
      expect(tx.scheduleException.delete).not.toHaveBeenCalled();
    },
  );
  it('returns 404 when an exception disappears before mutation', async () => {
    exceptions = {};
    await expect(repository.remove('exception', 'a')).rejects.toMatchObject({
      status: 404,
    });
  });
  it('rolls back a move to a missing schedule', async () => {
    await expect(
      repository.update('exception', { scheduleId: 'missing' }, 'a'),
    ).rejects.toMatchObject({ status: 404 });
    expect(exceptions.exception.scheduleId).toBe('a');
  });
});
