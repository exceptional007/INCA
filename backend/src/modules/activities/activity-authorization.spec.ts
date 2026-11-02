import {
  ExecutionContext,
  ConflictException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ActivityRepository } from './repositories/activity.repository';
import { ActivityTypeRepository } from './repositories/activity-type.repository';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

describe('Activity authorization', () => {
  let app: INestApplication;
  let service: ActivitiesService;
  const facultyId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const body = {
    facultyId,
    activityTypeId: otherId,
    title: 'Workshop',
    startTime: '2026-11-01T09:00:00Z',
    endTime: '2026-11-01T10:00:00Z',
  };
  const activities = {
    getAdminDepartmentId: jest.fn(),
    getFacultyAccess: jest.fn(),
    roomExists: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findUpcoming: jest.fn(),
    findByFaculty: jest.fn(),
  };
  const types = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
  };
  const operations = ['create', 'update', 'delete'] as const;
  type Operation = (typeof operations)[number];
  function perform(
    op: Operation,
    role?: string,
    type = false,
    payload?: object,
  ) {
    const client = request(app.getHttpServer());
    const base = '/activities' + (type ? '/types' : '');
    let req =
      op === 'create'
        ? client
            .post(base)
            .send(payload ?? (type ? { name: 'Workshop' } : body))
        : op === 'update'
          ? client
              .patch(base + '/item')
              .send(
                payload ?? (type ? { name: 'Updated' } : { title: 'Updated' }),
              )
          : client.delete(base + '/item');
    return role ? req.set('x-test-role', role) : req;
  }
  function noWrites() {
    for (const repo of [activities, types])
      for (const op of ['create', 'update', 'remove'] as const)
        expect(repo[op]).not.toHaveBeenCalled();
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        ActivitiesService,
        RolesGuard,
        { provide: ActivityRepository, useValue: activities },
        { provide: ActivityTypeRepository, useValue: types },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          const role = req.headers['x-test-role'];
          if (!role) throw new UnauthorizedException();
          req.user = { id: 'actor', role };
          return true;
        },
      })
      .compile();
    service = module.get(ActivitiesService);
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
    activities.getAdminDepartmentId.mockResolvedValue('department-a');
    activities.roomExists.mockResolvedValue(true);
    activities.getFacultyAccess.mockImplementation(async (id) => ({
      userId: id === facultyId ? 'actor' : 'other-user',
      departmentId: 'department-a',
    }));
    activities.findById.mockResolvedValue({ id: 'item', ...body });
    types.findById.mockResolvedValue({ id: otherId, activities: [] });
    for (const repo of [activities, types])
      for (const op of ['create', 'update', 'remove'] as const)
        repo[op].mockResolvedValue({ id: 'item' });
  });
  it.each(operations)(
    'requires login for %s of activities and types',
    async (op) => {
      await perform(op).expect(401);
      await perform(op, undefined, true).expect(401);
      noWrites();
    },
  );
  it.each(
    ['STUDENT', 'COORDINATOR', 'HOD', 'SUPER_ADMIN'].flatMap((role) =>
      operations.map((op) => ({ role, op })),
    ),
  )('denies $role activity $op', async ({ role, op }) => {
    await perform(op, role).expect(403);
    noWrites();
  });
  it.each(
    ['STUDENT', 'COORDINATOR', 'HOD', 'SUPER_ADMIN', 'FACULTY'].flatMap(
      (role) => operations.map((op) => ({ role, op })),
    ),
  )('denies $role type $op', async ({ role, op }) => {
    await perform(op, role, true).expect(403);
    noWrites();
  });
  it.each(operations)('allows ADMIN type %s', async (op) => {
    await perform(op, 'ADMIN', true).expect(op === 'create' ? 201 : 200);
  });
  it.each(
    ['ADMIN', 'FACULTY'].flatMap((role) =>
      operations.map((op) => ({ role, op })),
    ),
  )('allows authorized $role activity $op', async ({ role, op }) => {
    await perform(op, role).expect(op === 'create' ? 201 : 200);
  });
  it.each(operations)(
    'blocks faculty %s of another organiser activity',
    async (op) => {
      activities.getFacultyAccess.mockResolvedValue({
        userId: 'other-user',
        departmentId: 'department-a',
      });
      await perform(op, 'FACULTY').expect(403);
      noWrites();
    },
  );
  it.each(operations)(
    'blocks admin cross-department activity %s',
    async (op) => {
      activities.getFacultyAccess.mockResolvedValue({
        userId: 'other-user',
        departmentId: 'department-b',
      });
      await perform(op, 'ADMIN').expect(403);
      noWrites();
    },
  );
  it.each(operations)('blocks unassigned admin activity %s', async (op) => {
    activities.getAdminDepartmentId.mockResolvedValue(null);
    await perform(op, 'ADMIN').expect(403);
    noWrites();
  });
  it.each(['ADMIN', 'FACULTY'])(
    'blocks unauthorised organiser reassignment by %s',
    async (role) => {
      activities.getFacultyAccess.mockImplementation(async (id) => ({
        userId: id === facultyId ? 'actor' : 'other-user',
        departmentId: id === facultyId ? 'department-a' : 'department-b',
      }));
      await perform('update', role, false, { facultyId: otherId }).expect(403);
      noWrites();
    },
  );
  it('allows admin reassignment within department', async () => {
    await perform('update', 'ADMIN', false, { facultyId: otherId }).expect(200);
    expect(activities.getFacultyAccess).toHaveBeenCalledWith(facultyId);
    expect(activities.getFacultyAccess).toHaveBeenCalledWith(otherId);
  });
  it.each(operations)('rejects missing organiser for %s', async (op) => {
    activities.getFacultyAccess.mockResolvedValue(null);
    await perform(op, 'FACULTY').expect(404);
    noWrites();
  });
  it.each(['update', 'delete'] as const)(
    'returns 404 for missing activity %s',
    async (op) => {
      activities.findById.mockResolvedValue(null);
      await perform(op, 'ADMIN').expect(404);
      noWrites();
    },
  );
  it('preserves activity type linked-activity deletion protection', async () => {
    types.findById.mockResolvedValue({ activities: [{ id: 'activity' }] });
    await perform('delete', 'ADMIN', true).expect(409);
    noWrites();
  });
  it('rejects client-supplied authority', async () => {
    await perform('create', 'FACULTY', false, {
      ...body,
      role: 'ADMIN',
    }).expect(400);
    noWrites();
  });
  it.each([
    '/activities',
    '/activities/item',
    '/activities/upcoming',
    '/activities/faculty/owner',
    '/activities/types',
    '/activities/types/item',
  ])('preserves authenticated read %s', async (path) => {
    await request(app.getHttpServer())
      .get(path)
      .set('x-test-role', 'STUDENT')
      .expect(200);
  });
  it.each(['STUDENT', 'COORDINATOR', 'HOD', 'SUPER_ADMIN'])(
    'enforces service-level denial for %s',
    async (role) => {
      const actor = { id: 'actor', role };
      for (const invoke of [
        () => service.createActivity(body, actor),
        () => service.updateActivity('item', {}, actor),
        () => service.removeActivity('item', actor),
        () => service.createActivityType({ name: 'Type' }, actor),
        () => service.updateActivityType('item', {}, actor),
        () => service.removeActivityType('item', actor),
      ])
        await expect(invoke()).rejects.toMatchObject({ status: 403 });
      noWrites();
    },
  );
  it('rejects missing authenticated identity', async () => {
    await expect(
      service.createActivity(body, { id: '', role: 'ADMIN' }),
    ).rejects.toMatchObject({ status: 403 });
    noWrites();
  });
  describe('Activity time-range updates', () => {
    it.each([
      { startTime: '2026-11-01T10:00:00Z' },
      { startTime: '2026-11-01T11:00:00Z' },
      { endTime: '2026-11-01T09:00:00Z' },
      { endTime: '2026-11-01T08:00:00Z' },
      { startTime: '2026-11-01T11:00:00Z', endTime: '2026-11-01T10:00:00Z' },
      { startTime: '2026-11-01T09:00:00Z', endTime: '2026-11-01T09:00:00Z' },
      { startTime: '2026-11-01T15:30:00+05:30' },
      { startTime: 'not-a-date' },
    ])('rejects an invalid resulting window: %j', async (payload) => {
      activities.findById.mockResolvedValue({
        ...body,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
      });
      await perform('update', 'FACULTY', false, payload).expect(400);
      noWrites();
    });
    it.each([
      { startTime: '2026-11-01T08:00:00Z' },
      { endTime: '2026-11-01T11:00:00Z' },
      { startTime: '2026-11-02T09:00:00Z', endTime: '2026-11-02T10:00:00Z' },
      { startTime: '2026-11-01T14:30:00+05:30' },
    ])('accepts a valid resulting window: %j', async (payload) => {
      activities.findById.mockResolvedValue({
        ...body,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
      });
      await perform('update', 'FACULTY', false, payload).expect(200);
      expect(activities.update).toHaveBeenCalledWith('item', payload);
    });
    it('rejects invalid dates in direct service calls', async () => {
      await expect(
        service.updateActivity(
          'item',
          { endTime: 'invalid' },
          { id: 'actor', role: 'FACULTY' },
        ),
      ).rejects.toMatchObject({ status: 400 });
      noWrites();
    });
  });
  describe('Replacement activity type validation', () => {
    const replacementId = '33333333-3333-4333-8333-333333333333';
    it.each(['ADMIN', 'FACULTY'])(
      'rejects a nonexistent replacement type for %s',
      async (role) => {
        types.findById.mockResolvedValue(null);
        const response = await perform('update', role, false, {
          activityTypeId: replacementId,
        }).expect(404);
        expect(response.body.message).toContain(replacementId);
        expect(types.findById).toHaveBeenCalledWith(replacementId);
        noWrites();
      },
    );
    it.each(['ADMIN', 'FACULTY'])(
      'allows an existing replacement type for %s',
      async (role) => {
        types.findById.mockResolvedValue({ id: replacementId, activities: [] });
        await perform('update', role, false, {
          activityTypeId: replacementId,
        }).expect(200);
        expect(types.findById).toHaveBeenCalledWith(replacementId);
        expect(activities.update).toHaveBeenCalledWith('item', {
          activityTypeId: replacementId,
        });
      },
    );
    it('leaves type unchanged when omitted without looking it up', async () => {
      await perform('update', 'FACULTY', false, { title: 'New title' }).expect(
        200,
      );
      expect(types.findById).not.toHaveBeenCalled();
      expect(activities.update).toHaveBeenCalledWith('item', {
        title: 'New title',
      });
    });
    it.each([null, 'invalid-uuid'])(
      'rejects invalid type value %j before writing',
      async (activityTypeId) => {
        await perform('update', 'FACULTY', false, { activityTypeId }).expect(
          400,
        );
        noWrites();
      },
    );
    it('checks ownership before looking up replacement types', async () => {
      activities.getFacultyAccess.mockResolvedValue({
        userId: 'other-user',
        departmentId: 'department-a',
      });
      await perform('update', 'FACULTY', false, {
        activityTypeId: replacementId,
      }).expect(403);
      expect(types.findById).not.toHaveBeenCalled();
      noWrites();
    });
    it('validates replacement types in direct service calls', async () => {
      types.findById.mockResolvedValue(null);
      await expect(
        service.updateActivity(
          'item',
          { activityTypeId: replacementId },
          { id: 'actor', role: 'FACULTY' },
        ),
      ).rejects.toMatchObject({ status: 404 });
      noWrites();
    });
  });
  describe('Activity room validation', () => {
    const roomId = '44444444-4444-4444-8444-444444444444';
    const cases = ['ADMIN', 'FACULTY'].flatMap((role) =>
      (['create', 'update'] as const).map((op) => ({ role, op })),
    );
    it.each(cases)(
      'rejects missing room for $role $op',
      async ({ role, op }) => {
        activities.roomExists.mockResolvedValue(false);
        const payload = op === 'create' ? { ...body, roomId } : { roomId };
        const response = await perform(op, role, false, payload).expect(404);
        expect(response.body.message).toContain(roomId);
        noWrites();
      },
    );
    it.each(cases)(
      'accepts existing room for $role $op',
      async ({ role, op }) => {
        const payload = op === 'create' ? { ...body, roomId } : { roomId };
        await perform(op, role, false, payload).expect(
          op === 'create' ? 201 : 200,
        );
        expect(activities.roomExists).toHaveBeenCalledWith(roomId);
        expect(activities[op]).toHaveBeenCalledWith(
          ...(op === 'create' ? [payload] : ['item', payload]),
        );
      },
    );
    it.each(['create', 'update'] as const)(
      'allows omitted room for %s without a lookup',
      async (op) => {
        const payload = op === 'create' ? body : { title: 'Updated' };
        await perform(op, 'FACULTY', false, payload).expect(
          op === 'create' ? 201 : 200,
        );
        expect(activities.roomExists).not.toHaveBeenCalled();
        expect(activities[op]).toHaveBeenCalledWith(
          ...(op === 'create' ? [payload] : ['item', payload]),
        );
      },
    );
    it.each(['create', 'update'] as const)(
      'allows null room for %s without a lookup',
      async (op) => {
        const payload =
          op === 'create' ? { ...body, roomId: null } : { roomId: null };
        await perform(op, 'FACULTY', false, payload).expect(
          op === 'create' ? 201 : 200,
        );
        expect(activities.roomExists).not.toHaveBeenCalled();
        expect(activities[op]).toHaveBeenCalledWith(
          ...(op === 'create' ? [payload] : ['item', payload]),
        );
      },
    );
    it.each(['create', 'update'] as const)(
      'rejects malformed room ID for %s',
      async (op) => {
        const payload =
          op === 'create'
            ? { ...body, roomId: 'invalid' }
            : { roomId: 'invalid' };
        await perform(op, 'FACULTY', false, payload).expect(400);
        expect(activities.roomExists).not.toHaveBeenCalled();
        noWrites();
      },
    );
    it.each(['create', 'update'] as const)(
      'checks authority before room lookup on %s',
      async (op) => {
        activities.getFacultyAccess.mockResolvedValue({
          userId: 'other-user',
          departmentId: 'department-a',
        });
        const payload = op === 'create' ? { ...body, roomId } : { roomId };
        await perform(op, 'FACULTY', false, payload).expect(403);
        expect(activities.roomExists).not.toHaveBeenCalled();
        noWrites();
      },
    );
    it('validates rooms for direct service calls', async () => {
      activities.roomExists.mockResolvedValue(false);
      const actor = { id: 'actor', role: 'FACULTY' };
      await expect(
        service.createActivity({ ...body, roomId }, actor),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.updateActivity('item', { roomId }, actor),
      ).rejects.toMatchObject({ status: 404 });
      noWrites();
    });
  });
  describe('Activity attendance-history deletion protection', () => {
    it.each(['ADMIN', 'FACULTY'])(
      'returns a conflict to %s when the repository protects attendance',
      async (role) => {
        activities.remove.mockRejectedValue(
          new ConflictException(
            'Cannot delete an activity with attendance sessions.',
          ),
        );
        await perform('delete', role).expect(409);
        expect(activities.remove).toHaveBeenCalledWith('item', facultyId);
      },
    );
    it.each(['ADMIN', 'FACULTY'])(
      'passes the authorized organiser when %s deletes an activity',
      async (role) => {
        await perform('delete', role).expect(200);
        expect(activities.remove).toHaveBeenCalledWith('item', facultyId);
      },
    );
  });
});
