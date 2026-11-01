import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import request from 'supertest';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { ScheduleRepository } from './repositories/schedule.repository';
import { TemplateRepository } from '../templates/repositories/template.repository';
import { TimetableImportService } from '../timetable-import/timetable-import.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

describe('Schedule update department authorization', () => {
  let app: INestApplication;
  let service: SchedulesService;
  const templateId = '11111111-1111-4111-8111-111111111111';
  const otherTemplateId = '22222222-2222-4222-8222-222222222222';
  const schedules = { findById: jest.fn(), update: jest.fn() };
  const templates = {
    getAdminDepartmentId: jest.fn(),
    findById: jest.fn(),
    getSectionDepartmentId: jest.fn(),
  };
  const deniedRoles = [
    'STUDENT',
    'FACULTY',
    'HOD',
    'COORDINATOR',
    'SUPER_ADMIN',
  ];
  function perform(role?: string, payload: object = { remarks: 'Updated' }) {
    const req = request(app.getHttpServer())
      .patch('/schedules/schedule')
      .send(payload);
    return role ? req.set('x-test-role', role) : req;
  }
  beforeAll(async () => {
    const guard = {
      canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        const role = req.headers['x-test-role'];
        if (!role) throw new UnauthorizedException();
        req.user = {
          id: 'actor',
          role: req.headers['x-role-object'] ? { code: role } : role,
        };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [
        SchedulesService,
        RolesGuard,
        { provide: ScheduleRepository, useValue: schedules },
        { provide: TemplateRepository, useValue: templates },
        { provide: TimetableImportService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guard)
      .overrideGuard(AuthGuard('jwt'))
      .useValue(guard)
      .compile();
    service = module.get(SchedulesService);
    app = module.createNestApplication();
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
    jest.resetAllMocks();
    schedules.findById.mockResolvedValue({ id: 'schedule', templateId });
    schedules.update.mockResolvedValue({ id: 'schedule' });
    templates.getAdminDepartmentId.mockResolvedValue('department-a');
    templates.findById.mockImplementation(async (id) => ({
      id,
      sectionId: id === templateId ? 'section-a' : 'section-b',
    }));
    templates.getSectionDepartmentId.mockResolvedValue('department-a');
  });
  it('requires authentication', async () => {
    await perform().expect(401);
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it.each(deniedRoles)('denies %s at the route', async (role) => {
    await perform(role).expect(403);
    expect(templates.getAdminDepartmentId).not.toHaveBeenCalled();
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it('allows an admin update within its department', async () => {
    await perform('ADMIN').expect(200);
    expect(templates.getAdminDepartmentId).toHaveBeenCalledWith('actor');
    expect(templates.getSectionDepartmentId).toHaveBeenCalledWith('section-a');
    expect(schedules.update).toHaveBeenCalledWith('schedule', {
      remarks: 'Updated',
    });
  });
  it('supports serialized role objects from authenticated sessions', async () => {
    await perform('ADMIN').set('x-role-object', '1').expect(200);
  });
  it('blocks cross-department schedule updates', async () => {
    templates.getSectionDepartmentId.mockResolvedValue('department-b');
    await perform('ADMIN').expect(403);
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it('blocks moving an authorized schedule to another department template', async () => {
    templates.getSectionDepartmentId.mockImplementation(async (id) =>
      id === 'section-a' ? 'department-a' : 'department-b',
    );
    await perform('ADMIN', { templateId: otherTemplateId }).expect(403);
    expect(templates.getSectionDepartmentId).toHaveBeenCalledWith('section-a');
    expect(templates.getSectionDepartmentId).toHaveBeenCalledWith('section-b');
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it('cannot move a foreign schedule into the admin department', async () => {
    templates.getSectionDepartmentId.mockImplementation(async (id) =>
      id === 'section-a' ? 'department-b' : 'department-a',
    );
    await perform('ADMIN', { templateId: otherTemplateId }).expect(403);
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it('allows moving between templates in the same department', async () => {
    await perform('ADMIN', { templateId: otherTemplateId }).expect(200);
    expect(schedules.update).toHaveBeenCalledWith('schedule', {
      templateId: otherTemplateId,
    });
  });
  it('fails closed without an assigned admin department', async () => {
    templates.getAdminDepartmentId.mockResolvedValue(null);
    await perform('ADMIN').expect(403);
    expect(schedules.findById).not.toHaveBeenCalled();
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it('fails closed when the section department cannot be resolved', async () => {
    templates.getSectionDepartmentId.mockResolvedValue(null);
    await perform('ADMIN').expect(403);
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing schedule', async () => {
    schedules.findById.mockResolvedValue(null);
    await perform('ADMIN').expect(404);
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing destination template', async () => {
    templates.findById.mockImplementation(async (id) =>
      id === templateId ? { id, sectionId: 'section-a' } : null,
    );
    await perform('ADMIN', { templateId: otherTemplateId }).expect(404);
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it('rejects a null replacement template', async () => {
    await perform('ADMIN', { templateId: null }).expect(400);
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it('rejects client-supplied department authority', async () => {
    await perform('ADMIN', {
      departmentId: 'department-b',
      role: 'ADMIN',
    }).expect(400);
    expect(schedules.update).not.toHaveBeenCalled();
  });
  it.each(deniedRoles)(
    'also denies direct service updates by %s',
    async (role) => {
      await expect(
        service.update('schedule', {}, { id: 'actor', role }),
      ).rejects.toMatchObject({ status: 403 });
      expect(schedules.update).not.toHaveBeenCalled();
    },
  );
  it('denies direct service updates with no identity', async () => {
    await expect(
      service.update('schedule', {}, { id: '', role: 'ADMIN' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(schedules.update).not.toHaveBeenCalled();
  });
});
