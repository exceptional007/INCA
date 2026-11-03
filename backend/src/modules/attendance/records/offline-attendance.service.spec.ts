import { ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { OfflineAttendanceService, attendanceSignature } from './offline-attendance.service';

describe('offline attendance upload', () => {
  const actor = { id: 'faculty-user', role: 'FACULTY' };
  const desired = [{ studentId: 'one', status: 'PRESENT' }, { studentId: 'two', status: 'ABSENT' }];
  let current: any, tx: any, prisma: any, access: any, service: OfflineAttendanceService;
  const dto = () => ({ records: desired, baseline: '[]' }) as any;
  beforeEach(() => {
    current = { id: 'session', status: 'OPEN', records: [], schedule: { status: 'SCHEDULED', template: { sectionId: 'section' } } };
    tx = {
      attendanceSession: { findFirst: jest.fn(async () => current), update: jest.fn(async ({ data }) => ({ ...current, ...data, records: desired })) },
      student: { findMany: jest.fn(async () => [{ id: 'one' }, { id: 'two' }]) },
      attendanceRecord: { createMany: jest.fn(), update: jest.fn() },
    };
    prisma = { $transaction: jest.fn(async callback => callback(tx)) };
    access = { sessionScope: jest.fn(async () => ({ takenBy: { userId: actor.id } })), authorizeMarking: jest.fn() };
    service = new OfflineAttendanceService(prisma, access);
  });
  it('checks write scope inside a serializable transaction and locks only after records', async () => {
    const result = await service.sync('session', dto(), actor);
    expect(access.sessionScope).toHaveBeenCalledWith(actor, true);
    expect(tx.attendanceSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session', AND: [{ takenBy: { userId: actor.id } }] } }));
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    expect(tx.student.findMany).toHaveBeenCalledWith({ where: { sectionId: 'section', isActive: true }, select: { id: true } });
    expect(result.data.status).toBe('SUBMITTED');
    expect(tx.attendanceRecord.createMany).toHaveBeenCalledTimes(1);
  });
  it('accepts an exact submitted retry without writing again', async () => {
    current.status = 'SUBMITTED'; current.records = desired;
    await service.sync('session', dto(), actor);
    expect(tx.attendanceRecord.createMany).not.toHaveBeenCalled(); expect(tx.attendanceSession.update).not.toHaveBeenCalled();
  });
  it('rejects a different submitted payload', async () => {
    current.status = 'SUBMITTED'; current.records = [{ studentId: 'one', status: 'LATE' }];
    await expect(service.sync('session', dto(), actor)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.attendanceRecord.createMany).not.toHaveBeenCalled();
  });
  it('rejects access removed since preparation', async () => {
    tx.attendanceSession.findFirst.mockResolvedValue(null);
    await expect(service.sync('session', dto(), actor)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects changed roster, duplicates and stale baseline', async () => {
    tx.student.findMany.mockResolvedValue([{ id: 'one' }]);
    await expect(service.sync('session', dto(), actor)).rejects.toBeInstanceOf(ConflictException);
    tx.student.findMany.mockResolvedValue([{ id: 'one' }, { id: 'two' }]);
    await expect(service.sync('session', { ...dto(), records: [desired[0], desired[0]] }, actor)).rejects.toBeInstanceOf(ConflictException);
    current.records = [{ id: 'record', studentId: 'one', status: 'EXCUSED' }];
    await expect(service.sync('session', dto(), actor)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.attendanceRecord.createMany).not.toHaveBeenCalled();
  });
  it('accepts baseline records and updates changed statuses', async () => {
    current.records = [{ id: 'record', studentId: 'one', status: 'EXCUSED', remarks: null }];
    await service.sync('session', { ...dto(), baseline: attendanceSignature(current.records) }, actor);
    expect(tx.attendanceRecord.update).toHaveBeenCalledWith({ where: { id: 'record' }, data: { status: 'PRESENT', remarks: null } });
  });
  it('rejects cancelled lectures', async () => {
    current.schedule.status = 'CANCELLED';
    await expect(service.sync('session', dto(), actor)).rejects.toBeInstanceOf(ConflictException);
  });
  it('turns serialization conflicts into retryable failures', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(service.sync('session', dto(), actor)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
