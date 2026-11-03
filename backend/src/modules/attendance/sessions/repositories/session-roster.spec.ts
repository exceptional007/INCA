import { SessionRepository } from './session.repository';
import { RecordsService } from '../../records/records.service';

describe('Lecture enrollment roster', () => {
  let db: any;
  let repository: SessionRepository;
  beforeEach(() => {
    db = {
      attendanceSession: {
        findUnique: jest.fn().mockResolvedValue({
          scheduleId: 'lecture',
          activityId: null,
          schedule: { template: { sectionId: 'section-a' } },
        }),
      },
      student: { findMany: jest.fn().mockResolvedValue([]) },
    };
    repository = new SessionRepository(db);
  });

  it("selects active students by the lecture's exact section ID", async () => {
    await repository.getRoster('session');
    expect(db.student.findMany).toHaveBeenCalledWith({
      where: { isActive: true, sectionId: 'section-a' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rollNumber: true,
        collegeId: true,
        photoKey: true,
        sectionId: true,
      },
      orderBy: { rollNumber: 'asc' },
    });
  });

  it('keeps distinct section IDs isolated even if names match across programs', async () => {
    db.student.findMany.mockImplementation(async ({ where }) =>
      [
        { id: 'in-section', sectionId: 'section-a', isActive: true },
        {
          id: 'same-name-other-program',
          sectionId: 'section-b',
          isActive: true,
        },
        { id: 'inactive', sectionId: 'section-a', isActive: false },
        { id: 'unassigned', sectionId: null, isActive: true },
      ].filter(
        (student) =>
          student.sectionId === where.sectionId &&
          student.isActive === where.isActive,
      ),
    );
    expect(await repository.getRoster('session')).toEqual([
      { id: 'in-section', sectionId: 'section-a', isActive: true },
    ]);
  });

  it('returns an empty roster without inventing demo students', async () => {
    expect(await repository.getRoster('session')).toEqual([]);
  });

  it('preserves active-student rosters for activities without a section model', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({
      scheduleId: null,
      activityId: 'activity',
      schedule: null,
    });
    await repository.getRoster('session');
    expect(db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('fails closed when a lecture has no section', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({
      scheduleId: 'lecture',
      schedule: { template: { sectionId: null } },
    });
    await expect(repository.getRoster('session')).rejects.toMatchObject({
      status: 400,
    });
    expect(db.student.findMany).not.toHaveBeenCalled();
  });

  it('rejects sessions without a source', async () => {
    db.attendanceSession.findUnique.mockResolvedValue({
      scheduleId: null,
      activityId: null,
      schedule: null,
    });
    await expect(repository.getRoster('session')).rejects.toMatchObject({
      status: 400,
    });
    expect(db.student.findMany).not.toHaveBeenCalled();
  });

  it('reports missing sessions without reading students', async () => {
    db.attendanceSession.findUnique.mockResolvedValue(null);
    await expect(repository.getRoster('missing')).rejects.toMatchObject({
      status: 404,
    });
    expect(db.student.findMany).not.toHaveBeenCalled();
  });
});

describe('Attendance submission roster validation', () => {
  const actor = { id: 'teacher', role: 'FACULTY' };
  let recordRepository: any;
  let sessionRepository: any;
  let access: any;
  let service: RecordsService;
  beforeEach(() => {
    recordRepository = { bulkCreate: jest.fn().mockResolvedValue([]) };
    sessionRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'session', status: 'OPEN' }),
      getRoster: jest.fn().mockResolvedValue([{ id: 'enrolled' }]),
    };
    access = { assertSessionAccess: jest.fn().mockResolvedValue(undefined) };
    service = new RecordsService(recordRepository, sessionRepository, access);
  });
  it.each(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const)(
    'saves %s for an enrolled student',
    async (status) => {
      const records = [{ studentId: 'enrolled', status }];
      await service.submitRecords('session', { records }, actor);
      expect(recordRepository.bulkCreate).toHaveBeenCalledWith(
        'session',
        records,
        expect.any(Function),
      );
    },
  );
  it.each([
    'other-section',
    'inactive-student',
    'unknown-student',
    'unassigned-student',
  ])(
    'rejects the entire submission containing %s before any writes',
    async (studentId) => {
      await expect(
        service.submitRecords(
          'session',
          {
            records: [
              { studentId: 'enrolled', status: 'PRESENT' },
              { studentId, status: 'PRESENT' },
            ],
          },
          actor,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(recordRepository.bulkCreate).not.toHaveBeenCalled();
    },
  );
  it('rejects duplicate student IDs', async () => {
    await expect(
      service.submitRecords(
        'session',
        {
          records: [
            { studentId: 'enrolled', status: 'PRESENT' },
            { studentId: 'enrolled', status: 'ABSENT' },
          ],
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(recordRepository.bulkCreate).not.toHaveBeenCalled();
  });
  it('rejects a stale roster after enrollment changes', async () => {
    sessionRepository.getRoster.mockResolvedValue([]);
    await expect(
      service.submitRecords(
        'session',
        { records: [{ studentId: 'enrolled', status: 'PRESENT' }] },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(recordRepository.bulkCreate).not.toHaveBeenCalled();
  });
  it('does not query the roster if session authorization fails', async () => {
    access.assertSessionAccess.mockRejectedValue(new Error('Forbidden'));
    await expect(
      service.submitRecords(
        'session',
        { records: [{ studentId: 'enrolled', status: 'PRESENT' }] },
        actor,
      ),
    ).rejects.toThrow('Forbidden');
    expect(sessionRepository.getRoster).not.toHaveBeenCalled();
    expect(recordRepository.bulkCreate).not.toHaveBeenCalled();
  });
  it('does not save when roster lookup fails', async () => {
    sessionRepository.getRoster.mockRejectedValue(
      new Error('Database unavailable'),
    );
    await expect(
      service.submitRecords(
        'session',
        { records: [{ studentId: 'enrolled', status: 'PRESENT' }] },
        actor,
      ),
    ).rejects.toThrow('Database unavailable');
    expect(recordRepository.bulkCreate).not.toHaveBeenCalled();
  });
});
