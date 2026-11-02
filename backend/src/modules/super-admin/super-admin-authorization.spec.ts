import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

describe('Super-admin endpoint authorization', () => {
  let app: INestApplication;
  const adminId = 'admin-id';
  const adminBody = {
    name: 'Department Admin',
    email: 'admin@bit.ac.in',
    departmentId: 'faed3e96-4166-4a8d-86ac-25b800c33377',
  };
  const settingsBody = {
    academicPeriod: 'Autumn Semester 2026',
    minAttendance: 80,
    editWindow: 48,
    allowFacultyOverride: false,
  };
  const service = {
    getStats: jest.fn(),
    getAdmins: jest.fn(),
    createAdmin: jest.fn(),
    updateAdmin: jest.fn(),
    toggleAdminStatus: jest.fn(),
    deleteAdmin: jest.fn(),
    getAuditLogs: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  };
  const endpoints = [
    { method: 'get', path: '/stats', handler: 'getStats', args: [] },
    {
      method: 'get',
      path: '/admins',
      handler: 'getAdmins',
      args: ['SUPER_ADMIN'],
    },
    {
      method: 'post',
      path: '/admins',
      handler: 'createAdmin',
      body: adminBody,
      args: ['SUPER_ADMIN', adminBody],
    },
    {
      method: 'patch',
      path: `/admins/${adminId}`,
      handler: 'updateAdmin',
      body: { name: 'Updated Admin' },
      args: ['SUPER_ADMIN', adminId, { name: 'Updated Admin' }],
    },
    {
      method: 'patch',
      path: `/admins/${adminId}/toggle-status`,
      handler: 'toggleAdminStatus',
      args: ['SUPER_ADMIN', adminId],
    },
    {
      method: 'delete',
      path: `/admins/${adminId}`,
      handler: 'deleteAdmin',
      args: ['SUPER_ADMIN', adminId],
    },
    { method: 'get', path: '/audit-logs', handler: 'getAuditLogs', args: [] },
    { method: 'get', path: '/settings', handler: 'getSettings', args: [] },
    {
      method: 'patch',
      path: '/settings',
      handler: 'updateSettings',
      body: settingsBody,
      args: [settingsBody],
    },
  ] as const;
  const deniedRoles = ['ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT'];

  function perform(
    endpoint: (typeof endpoints)[number],
    role?: string,
    body?: object,
  ) {
    const client = request(app.getHttpServer());
    let req = client[endpoint.method](`/api/v1/super-admin${endpoint.path}`);
    if (body) req = req.send(body);
    else if ('body' in endpoint) req = req.send(endpoint.body);
    return role ? req.set('x-test-role', role) : req;
  }

  beforeAll(async () => {
    // Exercise real routing, validation and role checks without database access.
    const module = await Test.createTestingModule({
      controllers: [SuperAdminController],
      providers: [
        RolesGuard,
        { provide: SuperAdminService, useValue: service },
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
    for (const handler of Object.values(service))
      handler.mockResolvedValue({ id: 'result-id' });
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(endpoints)(
    'requires authentication for $method $path',
    async (endpoint) => {
      await perform(endpoint).expect(401);
      for (const handler of Object.values(service))
        expect(handler).not.toHaveBeenCalled();
    },
  );

  it.each(
    deniedRoles.flatMap((role) =>
      endpoints.map((endpoint) => ({ role, ...endpoint })),
    ),
  )(
    'blocks $role from $method $path before any service call',
    async (endpoint) => {
      await perform(endpoint, endpoint.role).expect(403);
      for (const handler of Object.values(service))
        expect(handler).not.toHaveBeenCalled();
    },
  );

  it.each(endpoints)(
    'preserves SUPER_ADMIN access to $method $path',
    async (endpoint) => {
      const response = await perform(endpoint, 'SUPER_ADMIN').expect(
        endpoint.method === 'post' ? 201 : 200,
      );
      expect(service[endpoint.handler]).toHaveBeenCalledTimes(1);
      expect(service[endpoint.handler]).toHaveBeenCalledWith(...endpoint.args);
      expect(response.body.success).toBe(true);
      if (endpoint.handler !== 'deleteAdmin')
        expect(response.body.data).toEqual({ id: 'result-id' });
    },
  );

  it.each([
    { minAttendance: 1, editWindow: 0 },
    { minAttendance: 101, editWindow: 169 },
    { allowFacultyOverride: 'true' },
    { role: 'SUPER_ADMIN' },
  ])('rejects invalid settings without writing: %j', async (body) => {
    const endpoint = endpoints.find(
      (endpoint) => endpoint.handler === 'updateSettings',
    )!;
    await perform(endpoint, 'SUPER_ADMIN', body).expect(400);
    expect(service.updateSettings).not.toHaveBeenCalled();
  });
});
