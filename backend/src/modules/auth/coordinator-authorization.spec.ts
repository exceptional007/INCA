import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './repositories/auth.repository';
import { SessionService } from './session.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-test-password'),
}));

describe('Coordinator account authorization', () => {
  let app: INestApplication;
  let service: AuthService;
  const coordinator = {
    id: 'coordinator-id',
    email: 'coordinator@bit.ac.in',
    password: 'stored-password-hash',
    isActive: true,
    role: { id: 'coordinator-role', code: 'COORDINATOR' },
  };
  const repository = {
    findCoordinators: jest.fn(),
    findUserById: jest.fn(),
    findUserByEmail: jest.fn(),
    findRoleByCode: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  };
  const operations = ['list', 'create', 'update', 'delete'] as const;
  const forbiddenRoles = [
    'STUDENT',
    'FACULTY',
    'COORDINATOR',
    'HOD',
    'SUPER_ADMIN',
  ];

  function perform(
    operation: (typeof operations)[number],
    role?: string,
    body?: object,
  ) {
    const route = '/api/v1/auth/coordinators';
    const client = request(app.getHttpServer());
    let req: request.Test;
    switch (operation) {
      case 'list':
        req = client.get(route);
        break;
      case 'create':
        req = client.post(route).send(body || { email: coordinator.email });
        break;
      case 'update':
        req = client
          .patch(`${route}/${coordinator.id}`)
          .send(
            body || { email: 'updated@bit.ac.in', password: 'NewPassword123!' },
          );
        break;
      case 'delete':
        req = client.delete(`${route}/${coordinator.id}`);
        break;
    }
    return role ? req.set('x-test-role', role) : req;
  }

  beforeAll(async () => {
    // Isolated HTTP application: real controller/service/role guard, no database or AppModule startup.
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        RolesGuard,
        { provide: AuthRepository, useValue: repository },
        { provide: JwtService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: ConfigService, useValue: {} },
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
    service = module.get(AuthService);
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
    repository.findCoordinators.mockResolvedValue([coordinator]);
    repository.findUserById.mockResolvedValue(coordinator);
    repository.findUserByEmail.mockResolvedValue(null);
    repository.findRoleByCode.mockResolvedValue(coordinator.role);
    repository.createUser.mockResolvedValue(coordinator);
    repository.updateUser.mockResolvedValue(coordinator);
    repository.deleteUser.mockResolvedValue(coordinator);
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(operations)(
    'requires authentication to %s coordinators',
    async (operation) => {
      await perform(operation).expect(401);
      for (const method of Object.values(repository))
        expect(method).not.toHaveBeenCalled();
    },
  );

  it.each(
    forbiddenRoles.flatMap((role) =>
      operations.map((operation) => ({ role, operation })),
    ),
  )(
    'rejects $role attempting to $operation coordinators before repository access',
    async ({ role, operation }) => {
      await perform(operation, role).expect(403);
      for (const method of Object.values(repository))
        expect(method).not.toHaveBeenCalled();
    },
  );

  it.each(forbiddenRoles)(
    'enforces service authorization for %s callers',
    async (role) => {
      const calls = [
        () => service.getAllCoordinators(role),
        () => service.createCoordinator(role, { email: coordinator.email }),
        () =>
          service.updateCoordinator(role, coordinator.id, {
            password: 'NewPassword123!',
          }),
        () => service.deleteCoordinator(role, coordinator.id),
      ];
      for (const call of calls)
        await expect(call()).rejects.toMatchObject({ status: 403 });
      for (const method of Object.values(repository))
        expect(method).not.toHaveBeenCalled();
    },
  );

  it('allows an ADMIN to list coordinators without returning password hashes', async () => {
    const response = await perform('list', 'ADMIN').expect(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: coordinator.id }),
    ]);
    expect(response.body.data[0]).not.toHaveProperty('password');
  });

  it('allows an ADMIN to create a coordinator with the existing default-password flow', async () => {
    const response = await perform('create', 'ADMIN').expect(201);
    expect(repository.createUser).toHaveBeenCalledWith({
      email: coordinator.email,
      password: 'hashed-test-password',
      roleId: coordinator.role.id,
    });
    expect(response.body.data).not.toHaveProperty('password');
  });

  it('allows an ADMIN to update an actual coordinator without returning the password hash', async () => {
    const response = await perform('update', 'ADMIN').expect(200);
    expect(repository.updateUser).toHaveBeenCalledWith(coordinator.id, {
      email: 'updated@bit.ac.in',
      password: 'hashed-test-password',
    });
    expect(response.body.data).not.toHaveProperty('password');
  });

  it('allows an ADMIN to delete an actual coordinator', async () => {
    await perform('delete', 'ADMIN').expect(200);
    expect(repository.deleteUser).toHaveBeenCalledWith(coordinator.id);
  });

  it.each(
    forbiddenRoles
      .filter((role) => role !== 'COORDINATOR')
      .concat('ADMIN')
      .flatMap((role) =>
        (['update', 'delete'] as const).map((operation) => ({
          role,
          operation,
        })),
      ),
  )(
    'prevents an ADMIN from using $operation to target a $role account',
    async ({ role, operation }) => {
      repository.findUserById.mockResolvedValue({
        ...coordinator,
        role: { code: role },
      });
      await perform(operation, 'ADMIN').expect(403);
      expect(repository.updateUser).not.toHaveBeenCalled();
      expect(repository.deleteUser).not.toHaveBeenCalled();
    },
  );

  it.each(['update', 'delete'] as const)(
    'returns 404 for %s of a missing target',
    async (operation) => {
      repository.findUserById.mockResolvedValue(null);
      await perform(operation, 'ADMIN').expect(404);
      expect(repository.updateUser).not.toHaveBeenCalled();
      expect(repository.deleteUser).not.toHaveBeenCalled();
    },
  );

  it.each(['create', 'update'] as const)(
    'rejects role injection in a %s request',
    async (operation) => {
      await perform(operation, 'ADMIN', {
        email: coordinator.email,
        roleId: 'super-admin-role',
      }).expect(400);
      expect(repository.createUser).not.toHaveBeenCalled();
      expect(repository.updateUser).not.toHaveBeenCalled();
    },
  );

  it.each(['create', 'update'] as const)(
    'validates credentials in a %s request',
    async (operation) => {
      await perform(operation, 'ADMIN', {
        email: 'invalid-email',
        password: 'short',
      }).expect(400);
      expect(repository.createUser).not.toHaveBeenCalled();
      expect(repository.updateUser).not.toHaveBeenCalled();
    },
  );
});
