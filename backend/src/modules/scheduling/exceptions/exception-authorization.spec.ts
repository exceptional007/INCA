import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ExceptionsController } from './exceptions.controller';
import { ExceptionsService } from './exceptions.service';
import { ExceptionRepository } from './repositories/exception.repository';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScheduleRepository } from '../schedules/repositories/schedule.repository';
import { RolesGuard } from '../../../common/guards/roles.guard';

describe('Schedule exception authorization', () => {
  let app: INestApplication;
  let service: ExceptionsService;
  const scheduleId = '11111111-1111-4111-8111-111111111111';
  const otherScheduleId = '22222222-2222-4222-8222-222222222222';
  const body = { scheduleId, exceptionType: 'CANCELLATION' };
  const exception = { id: 'exception-id', ...body };
  const schedules = { findById: jest.fn(), update: jest.fn() };
  const repository = {
    getAdminDepartmentId: jest.fn(),
    getScheduleDepartmentId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
  };
  const deniedRoles = [
    'SUPER_ADMIN',
    'HOD',
    'FACULTY',
    'COORDINATOR',
    'STUDENT',
  ];
  const operations = ['create', 'update', 'delete'] as const;
  function perform(
    operation: (typeof operations)[number],
    role?: string,
    data?: object,
  ) {
    const client = request(app.getHttpServer());
    const base = '/api/v1/schedule-exceptions';
    let req: request.Test;
    if (operation === 'create') req = client.post(base).send(data || body);
    else if (operation === 'update')
      req = client
        .patch(`${base}/exception-id`)
        .send(data || { reason: 'Updated' });
    else req = client.delete(`${base}/exception-id`);
    return role ? req.set('x-test-role', role) : req;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExceptionsController],
      providers: [
        ExceptionsService,
        { provide: ScheduleRepository, useValue: schedules },
        RolesGuard,
        { provide: ExceptionRepository, useValue: repository },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          const role = req.headers['x-test-role'];
          if (!role) throw new UnauthorizedException();
          req.user = { id: 'actor-id', role };
          return true;
        },
      })
      .compile();
    service = module.get(ExceptionsService);
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
    schedules.findById.mockResolvedValue({ id: scheduleId });
    schedules.update.mockResolvedValue({});
    repository.getAdminDepartmentId.mockResolvedValue('department-a');
    repository.getScheduleDepartmentId.mockResolvedValue('department-a');
    repository.findById.mockResolvedValue(exception);
    repository.findAll.mockResolvedValue([exception]);
    repository.create.mockResolvedValue(exception);
    repository.update.mockResolvedValue(exception);
    repository.remove.mockResolvedValue(exception);
  });
  afterAll(async () => {
    await app?.close();
  });
  function expectNoWrites() {
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
    expect(schedules.update).not.toHaveBeenCalled();
  }

  it.each(operations)(
    'requires authentication to %s exceptions',
    async (operation) => {
      await perform(operation).expect(401);
      expectNoWrites();
    },
  );
  it.each(
    deniedRoles.flatMap((role) =>
      operations.map((operation) => ({ role, operation })),
    ),
  )(
    'blocks $role attempting to $operation exceptions',
    async ({ role, operation }) => {
      await perform(operation, role).expect(403);
      expect(repository.getAdminDepartmentId).not.toHaveBeenCalled();
      expectNoWrites();
    },
  );
  it.each(operations)(
    'allows ADMIN to %s exceptions in its own department',
    async (operation) => {
      await perform(operation, 'ADMIN').expect(
        operation === 'create' ? 201 : 200,
      );
      expect(repository.getAdminDepartmentId).toHaveBeenCalledWith('actor-id');
      expect(repository.getScheduleDepartmentId).toHaveBeenCalledWith(
        scheduleId,
      );
      expect(
        repository[operation === 'delete' ? 'remove' : operation],
      ).toHaveBeenCalledTimes(1);
    },
  );
  it.each(operations)(
    "blocks ADMIN from attempting to %s another department's exception",
    async (operation) => {
      repository.getScheduleDepartmentId.mockResolvedValue('department-b');
      await perform(operation, 'ADMIN').expect(403);
      expectNoWrites();
    },
  );
  it('blocks moving an authorized exception into another department', async () => {
    repository.getScheduleDepartmentId.mockImplementation(async (id) =>
      id === scheduleId ? 'department-a' : 'department-b',
    );
    await perform('update', 'ADMIN', { scheduleId: otherScheduleId }).expect(
      403,
    );
    expect(repository.getScheduleDepartmentId).toHaveBeenCalledWith(scheduleId);
    expect(repository.getScheduleDepartmentId).toHaveBeenCalledWith(
      otherScheduleId,
    );
    expectNoWrites();
  });
  it('allows moving an exception to another schedule in the same department', async () => {
    await perform('update', 'ADMIN', { scheduleId: otherScheduleId }).expect(
      200,
    );
    expect(repository.update).toHaveBeenCalledWith(
      'exception-id',
      {
        scheduleId: otherScheduleId,
      },
      scheduleId,
    );
  });
  it.each(operations)(
    'fails closed for %s without an assigned admin department',
    async (operation) => {
      repository.getAdminDepartmentId.mockResolvedValue(null);
      await perform(operation, 'ADMIN').expect(403);
      expectNoWrites();
    },
  );
  it.each(['update', 'delete'] as const)(
    'returns 404 for %s of a missing exception',
    async (operation) => {
      repository.findById.mockResolvedValue(null);
      await perform(operation, 'ADMIN').expect(404);
      expectNoWrites();
    },
  );
  it('returns 404 for a missing schedule', async () => {
    repository.getScheduleDepartmentId.mockResolvedValue(null);
    await perform('create', 'ADMIN').expect(404);
    expectNoWrites();
  });
  it('does not accept client-supplied role or department overrides', async () => {
    await perform('create', 'ADMIN', {
      ...body,
      role: 'SUPER_ADMIN',
      departmentId: 'department-b',
    }).expect(400);
    expectNoWrites();
  });
  it.each([
    '/api/v1/schedule-exceptions',
    '/api/v1/schedule-exceptions/exception-id',
  ])('preserves authenticated exception reads at %s', async (path) => {
    await request(app.getHttpServer())
      .get(path)
      .set('x-test-role', 'STUDENT')
      .expect(200);
  });
  it.each(deniedRoles)(
    'also enforces authorization for direct service calls by %s',
    async (role) => {
      const actor = { id: 'actor-id', role };
      for (const invoke of [
        () => service.create(body, actor),
        () => service.update('exception-id', {}, actor),
        () => service.remove('exception-id', actor),
      ])
        await expect(invoke()).rejects.toMatchObject({ status: 403 });
      expectNoWrites();
    },
  );
  it('rejects missing actor identity even with an ADMIN role', async () => {
    await expect(
      service.create(body, { id: '', role: 'ADMIN' }),
    ).rejects.toMatchObject({ status: 403 });
    expectNoWrites();
  });
});
