import { SchedulesService } from './schedules.service';
import { TimetableImportService } from '../timetable-import/timetable-import.service';

describe('semester schedule synchronization', () => {
  it('synchronizes active slots and does not regenerate their obsolete templates', async () => {
    const repository = { findByDateRange: jest.fn().mockResolvedValue([]), createMany: jest.fn() };
    const templates = { getAdminDepartmentId: jest.fn().mockResolvedValue('department'), findAll: jest.fn().mockResolvedValue([
      { id: 'obsolete', sectionId: 'section', dayOfWeek: 1, effectiveFrom: new Date('2026-01-01') },
    ]) };
    const sync = { syncTimetableToSchedules: jest.fn().mockResolvedValue({ sectionIds: ['section'], schedulesCreated: 1 }) };
    const service = new SchedulesService(repository as any, templates as any, sync as any);
    const result = await service.generate({ startDate: '2026-11-02', endDate: '2026-11-02' }, {id: 'admin', role: 'ADMIN'});
    expect(sync.syncTimetableToSchedules).toHaveBeenCalledWith(undefined, '2026-11-02', '2026-11-02', undefined, 'department');
    expect(repository.createMany).not.toHaveBeenCalled();
    expect(result.message).toContain('1 schedules generated');
  });

  it('returns no old lectures when today is empty, with an exclusive next-day boundary', async () => {
    const repository = { findByDateRange: jest.fn().mockResolvedValue([]), findAll: jest.fn() };
    const service = new SchedulesService(repository as any, {} as any, {} as any);
    const result = await service.getTodaySchedules(undefined, undefined, undefined, '2026-11-02');
    expect(result.data).toEqual([]);
    expect(repository.findAll).not.toHaveBeenCalled();
    expect(repository.findByDateRange).toHaveBeenCalledWith(
      new Date('2026-11-02T00:00:00Z'), new Date('2026-11-02T23:59:59.999Z'), undefined, undefined,
    );
  });

  it('replaces stale untouched sessions, preserves history, and avoids duplicates on rerun', async () => {
    const template = { id: 'current', sectionId: 'section', subjectId: 'subject', facultyId: 'faculty', roomId: 'room', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', effectiveFrom: new Date('2026-01-01'), effectiveTo: null };
    const db = {
      timetableVersion: { findMany: jest.fn().mockResolvedValue([{ sectionId: 'section', slots: [{ day: 'MON', subjectId: 'subject', facultyId: 'faculty', roomId: 'room', timeSlotStart: '09:00', timeSlotEnd: '10:00' }] }]) },
      scheduleTemplate: { findMany: jest.fn().mockResolvedValue([template]) },
      schedule: { deleteMany: jest.fn(), findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ templateId: 'current', lectureDate: new Date('2026-11-02') }]), createMany: jest.fn() },
    };
    const service = Object.create(TimetableImportService.prototype) as TimetableImportService;
    const first = await service.syncTimetableToSchedules(undefined, '2026-11-02', '2026-11-02', db);
    const second = await service.syncTimetableToSchedules(undefined, '2026-11-02', '2026-11-02', db);
    expect(first.schedulesCreated).toBe(1);
    expect(second.schedulesCreated).toBe(0);
    expect(db.schedule.createMany).toHaveBeenCalledTimes(1);
    expect(db.schedule.deleteMany).toHaveBeenCalledWith({ where: {
      template: { sectionId: { in: ['section'] } }, templateId: { notIn: ['current'] },
      lectureDate: { gte: new Date('2026-11-02'), lte: new Date('2026-11-02') },
      status: 'SCHEDULED', attendanceSessions: { none: {} }, exceptions: { none: {} },
    } });
  });
});
