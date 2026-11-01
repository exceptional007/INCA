import { ScheduleRepository } from './repositories/schedule.repository';
import { TemplateRepository } from '../templates/repositories/template.repository';
import { SchedulesService } from './schedules.service';
import { TimetableImportService } from '../timetable-import/timetable-import.service';

describe('Schedule creation and generation department scope', () => {
  const schedules = {
    create: jest.fn(),
    createMany: jest.fn(),
    findByDateRange: jest.fn(),
  };
  const templates = {
    getAdminDepartmentId: jest.fn(),
    findById: jest.fn(),
    getSectionDepartmentId: jest.fn(),
    findAll: jest.fn(),
  };
  const imports = { syncTimetableToSchedules: jest.fn() };
  let service: SchedulesService;
  const actor = { id: 'admin', role: 'ADMIN' };
  beforeEach(() => {
    jest.resetAllMocks();
    templates.getAdminDepartmentId.mockResolvedValue('department-a');
    templates.findById.mockResolvedValue({
      id: 'template',
      sectionId: 'section',
    });
    templates.getSectionDepartmentId.mockResolvedValue('department-a');
    templates.findAll.mockResolvedValue([]);
    schedules.findByDateRange.mockResolvedValue([]);
    imports.syncTimetableToSchedules.mockResolvedValue({
      sectionIds: [],
      schedulesCreated: 0,
    });
    schedules.create.mockResolvedValue({ id: 'new' });
    service = new SchedulesService(
      schedules as any,
      templates as any,
      imports as any,
    );
  });
  it('allows creating a schedule in the assigned department', async () => {
    const dto = { templateId: 'template', lectureDate: '2026-11-02' };
    await service.create(dto, actor);
    expect(schedules.create).toHaveBeenCalledWith(dto);
  });
  it('blocks creating a schedule in another department', async () => {
    templates.getSectionDepartmentId.mockResolvedValue('department-b');
    await expect(
      service.create(
        { templateId: 'template', lectureDate: '2026-11-02' },
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(schedules.create).not.toHaveBeenCalled();
  });
  it('scopes timetable synchronization and legacy templates to the same department', async () => {
    await service.generate(
      { startDate: '2026-11-02', endDate: '2026-11-02' },
      actor,
    );
    expect(imports.syncTimetableToSchedules).toHaveBeenCalledWith(
      undefined,
      '2026-11-02',
      '2026-11-02',
      undefined,
      'department-a',
    );
    expect(templates.findAll).toHaveBeenCalledWith('department-a');
  });
  it.each(['STUDENT', 'FACULTY', 'COORDINATOR', 'HOD', 'SUPER_ADMIN'])(
    'blocks %s from direct creation and generation',
    async (role) => {
      await expect(
        service.create(
          { templateId: 'template', lectureDate: '2026-11-02' },
          { id: 'user', role },
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.generate(
          { startDate: '2026-11-02', endDate: '2026-11-02' },
          { id: 'user', role },
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(schedules.create).not.toHaveBeenCalled();
      expect(imports.syncTimetableToSchedules).not.toHaveBeenCalled();
    },
  );
  it('fails closed if the admin has no assigned department', async () => {
    templates.getAdminDepartmentId.mockResolvedValue(null);
    await expect(
      service.generate(
        { startDate: '2026-11-02', endDate: '2026-11-02' },
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(imports.syncTimetableToSchedules).not.toHaveBeenCalled();
  });
  it('filters legacy templates through the actual section-program department relationship', async () => {
    const db = {
      scheduleTemplate: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await new TemplateRepository(db as any).findAll('department-a');
    expect(db.scheduleTemplate.findMany.mock.calls[0][0].where).toEqual({
      section: { semester: { program: { departmentId: 'department-a' } } },
    });
  });
  it('filters active timetable versions by department inside synchronization', async () => {
    const db = {
      timetableVersion: { findMany: jest.fn().mockResolvedValue([]) },
      scheduleTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      schedule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const sync = Object.create(
      TimetableImportService.prototype,
    ) as TimetableImportService;
    await sync.syncTimetableToSchedules(
      undefined,
      '2026-11-02',
      '2026-11-02',
      db,
      'department-a',
    );
    expect(db.timetableVersion.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      section: { semester: { program: { departmentId: 'department-a' } } },
    });
  });
});

describe('Student schedules use explicit current enrollment', () => {
  it.each([
    {
      profile: {
        isActive: true,
        sectionId: 'own-section',
        section: { isActive: true },
      },
      expected: ['own-section'],
    },
    { profile: null, expected: [] },
    {
      profile: { isActive: true, sectionId: null, section: null },
      expected: [],
    },
    {
      profile: {
        isActive: false,
        sectionId: 'old-section',
        section: { isActive: true },
      },
      expected: [],
    },
    {
      profile: {
        isActive: true,
        sectionId: 'old-section',
        section: { isActive: false },
      },
      expected: [],
    },
  ])(
    'returns $expected for the enrolled profile only',
    async ({ profile, expected }) => {
      const db = {
        student: { findUnique: jest.fn().mockResolvedValue(profile) },
        section: { findFirst: jest.fn(), findMany: jest.fn() },
        attendanceRecord: { findMany: jest.fn() },
      };
      await expect(
        new ScheduleRepository(db as any).getStudentSectionIdsForUser('user'),
      ).resolves.toEqual(expected);
      expect(db.section.findFirst).not.toHaveBeenCalled();
      expect(db.section.findMany).not.toHaveBeenCalled();
      expect(db.attendanceRecord.findMany).not.toHaveBeenCalled();
    },
  );
});
