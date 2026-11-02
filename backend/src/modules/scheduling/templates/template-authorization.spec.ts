import {
  ExecutionContext,
  ConflictException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { TemplateRepository } from './repositories/template.repository';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

describe('Schedule template authorization', () => {
  let app: INestApplication;
  let service: TemplatesService;
  const sectionId = '11111111-1111-4111-8111-111111111111';
  const otherSectionId = '22222222-2222-4222-8222-222222222222';
  const body = {
    sectionId,
    subjectId: '33333333-3333-4333-8333-333333333333',
    facultyId: '44444444-4444-4444-8444-444444444444',
    roomId: '55555555-5555-4555-8555-555555555555',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:00',
    effectiveFrom: '2026-10-31',
  };
  const template = { id: 'template-id', ...body };
  const repository = {
    subjectExists: jest.fn(),
    facultyExists: jest.fn(),
    roomExists: jest.fn(),
    getAdminDepartmentId: jest.fn(),
    getSectionDepartmentId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findBySection: jest.fn(),
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
    const base = '/api/v1/schedule-templates';
    let req: request.Test;
    if (operation === 'create') req = client.post(base).send(data || body);
    else if (operation === 'update')
      req = client
        .patch(`${base}/template-id`)
        .send(data || { startTime: '08:00' });
    else req = client.delete(`${base}/template-id`);
    return role ? req.set('x-test-role', role) : req;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        TemplatesService,
        RolesGuard,
        { provide: TemplateRepository, useValue: repository },
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
    service = module.get(TemplatesService);
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
    repository.subjectExists.mockResolvedValue(true);
    repository.facultyExists.mockResolvedValue(true);
    repository.roomExists.mockResolvedValue(true);
    repository.getAdminDepartmentId.mockResolvedValue('department-a');
    repository.getSectionDepartmentId.mockResolvedValue('department-a');
    repository.findById.mockResolvedValue(template);
    repository.findAll.mockResolvedValue([template]);
    repository.findBySection.mockResolvedValue([template]);
    repository.create.mockResolvedValue(template);
    repository.update.mockResolvedValue(template);
    repository.remove.mockResolvedValue(template);
  });
  afterAll(async () => {
    await app?.close();
  });
  function expectNoWrites() {
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
  }

  it.each(operations)(
    'requires authentication to %s templates',
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
    'blocks $role attempting to $operation templates',
    async ({ role, operation }) => {
      await perform(operation, role).expect(403);
      expect(repository.getAdminDepartmentId).not.toHaveBeenCalled();
      expectNoWrites();
    },
  );
  it.each(operations)(
    'allows ADMIN to %s templates in its own department',
    async (operation) => {
      await perform(operation, 'ADMIN').expect(
        operation === 'create' ? 201 : 200,
      );
      expect(repository.getAdminDepartmentId).toHaveBeenCalledWith('actor-id');
      expect(repository.getSectionDepartmentId).toHaveBeenCalledWith(sectionId);
      expect(
        repository[operation === 'delete' ? 'remove' : operation],
      ).toHaveBeenCalledTimes(1);
    },
  );
  it.each(operations)(
    "blocks ADMIN from attempting to %s another department's template",
    async (operation) => {
      repository.getSectionDepartmentId.mockResolvedValue('department-b');
      await perform(operation, 'ADMIN').expect(403);
      expectNoWrites();
    },
  );
  it('blocks moving an authorized template into another department', async () => {
    repository.getSectionDepartmentId.mockImplementation(async (id) =>
      id === sectionId ? 'department-a' : 'department-b',
    );
    await perform('update', 'ADMIN', { sectionId: otherSectionId }).expect(403);
    expect(repository.getSectionDepartmentId).toHaveBeenCalledWith(sectionId);
    expect(repository.getSectionDepartmentId).toHaveBeenCalledWith(
      otherSectionId,
    );
    expectNoWrites();
  });
  it('allows moving a template to another section in the same department', async () => {
    await perform('update', 'ADMIN', { sectionId: otherSectionId }).expect(200);
    expect(repository.update).toHaveBeenCalledWith('template-id', {
      sectionId: otherSectionId,
    });
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
    'returns 404 for %s of a missing template',
    async (operation) => {
      repository.findById.mockResolvedValue(null);
      await perform(operation, 'ADMIN').expect(404);
      expectNoWrites();
    },
  );
  it('returns 404 for a missing section', async () => {
    repository.getSectionDepartmentId.mockResolvedValue(null);
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
    '/api/v1/schedule-templates',
    '/api/v1/schedule-templates/template-id',
    `/api/v1/schedule-templates/section/${sectionId}`,
  ])('preserves authenticated template reads at %s', async (path) => {
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
        () => service.update('template-id', {}, actor),
        () => service.remove('template-id', actor),
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
  it('returns 409 when deletion would erase attendance history', async () => {
    repository.remove.mockRejectedValueOnce(
      new ConflictException(
        'Cannot delete a template with attendance sessions.',
      ),
    );
    await perform('delete', 'ADMIN').expect(409);
    expect(repository.remove).toHaveBeenCalledWith('template-id', sectionId);
  });
  it('passes the authorized section when deleting a template', async () => {
    await perform('delete', 'ADMIN').expect(200);
    expect(repository.remove).toHaveBeenCalledWith('template-id', sectionId);
  });
  describe('Template range validation', () => {
    it.each([
      { startTime: '10:00', endTime: '10:00' },
      { startTime: '11:00', endTime: '10:00' },
      { startTime: '23:00', endTime: '01:00' },
      { effectiveFrom: '2026-11-02', effectiveTo: '2026-11-01' },
    ])('rejects invalid creation ranges %j', async (changes) => {
      await perform('create', 'ADMIN', { ...body, ...changes }).expect(400);
      expectNoWrites();
    });
    it.each([
      { startTime: '8:00', endTime: '10:00' },
      { startTime: '00:00', endTime: '23:59' },
      { effectiveTo: '2026-10-31' },
      { effectiveTo: '2026-11-01' },
      { effectiveTo: null },
      {
        effectiveFrom: '2026-10-31T18:00:00Z',
        effectiveTo: '2026-10-31T01:00:00Z',
      },
    ])('accepts valid creation ranges %j', async (changes) => {
      await perform('create', 'ADMIN', { ...body, ...changes }).expect(201);
      expect(repository.create).toHaveBeenCalledTimes(1);
    });
    it.each([
      { startTime: '10:00' },
      { startTime: '11:00' },
      { endTime: '09:00' },
      { endTime: '08:00' },
      { startTime: '12:00', endTime: '11:00' },
      { startTime: null },
      { endTime: null },
      { effectiveTo: '2026-10-30' },
      { effectiveFrom: '2026-11-03' },
      { effectiveFrom: '2026-11-03', effectiveTo: '2026-11-02' },
    ])('rejects invalid resulting update ranges %j', async (changes) => {
      repository.findById.mockResolvedValue({
        ...template,
        effectiveFrom: new Date('2026-10-31'),
        effectiveTo: new Date('2026-11-02'),
      });
      await perform('update', 'ADMIN', changes).expect(400);
      expectNoWrites();
    });
    it.each([
      { startTime: '8:00' },
      { endTime: '11:00' },
      { startTime: '11:00', endTime: '12:00' },
      { effectiveFrom: '2026-11-02' },
      { effectiveTo: '2026-10-31' },
      { effectiveFrom: '2026-11-04', effectiveTo: '2026-11-05' },
    ])('accepts valid resulting update ranges %j', async (changes) => {
      repository.findById.mockResolvedValue({
        ...template,
        effectiveFrom: new Date('2026-10-31'),
        effectiveTo: new Date('2026-11-02'),
      });
      await perform('update', 'ADMIN', changes).expect(200);
      expect(repository.update).toHaveBeenCalledWith('template-id', changes);
    });
    it('allows a new effective start when the template has no end date', async () => {
      repository.findById.mockResolvedValue({ ...template, effectiveTo: null });
      await perform('update', 'ADMIN', { effectiveFrom: '2027-01-01' }).expect(
        200,
      );
    });
    it('preserves an unrelated update without revalidating legacy ranges', async () => {
      repository.findById.mockResolvedValue({
        ...template,
        startTime: '11:00',
        endTime: '10:00',
      });
      await perform('update', 'ADMIN', { dayOfWeek: 2 }).expect(200);
    });
    it('enforces range validation for direct service calls', async () => {
      const actor = { id: 'actor-id', role: 'ADMIN' };
      await expect(
        service.create({ ...body, endTime: '08:00' }, actor),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.update('template-id', { effectiveTo: 'invalid' }, actor),
      ).rejects.toMatchObject({ status: 400 });
      expectNoWrites();
    });
  });
  describe('Template reference validation', () => {
    const references = [
      { field: 'subjectId', lookup: 'subjectExists', label: 'Subject' },
      { field: 'facultyId', lookup: 'facultyExists', label: 'Faculty' },
      { field: 'roomId', lookup: 'roomExists', label: 'Room' },
    ] as const;
    const cases = references.flatMap((reference) =>
      (['create', 'update'] as const).map((operation) => ({
        ...reference,
        operation,
      })),
    );
    const replacementId = '66666666-6666-4666-8666-666666666666';
    it.each(cases)(
      'returns 404 for missing $field on $operation',
      async ({ field, lookup, label, operation }) => {
        repository[lookup].mockResolvedValue(false);
        const payload =
          operation === 'create'
            ? { ...body, [field]: replacementId }
            : { [field]: replacementId };
        const response = await perform(operation, 'ADMIN', payload).expect(404);
        expect(response.body.message).toContain(label);
        expect(response.body.message).toContain(replacementId);
        expect(repository[lookup]).toHaveBeenCalledWith(replacementId);
        expectNoWrites();
      },
    );
    it.each(cases)(
      'accepts existing $field on $operation',
      async ({ field, lookup, operation }) => {
        const payload =
          operation === 'create'
            ? { ...body, [field]: replacementId }
            : { [field]: replacementId };
        await perform(operation, 'ADMIN', payload).expect(
          operation === 'create' ? 201 : 200,
        );
        expect(repository[lookup]).toHaveBeenCalledWith(replacementId);
        if (operation === 'create')
          expect(repository.create).toHaveBeenCalledWith(payload);
        else
          expect(repository.update).toHaveBeenCalledWith(
            'template-id',
            payload,
          );
      },
    );
    it.each(cases)(
      'rejects null $field on $operation',
      async ({ field, operation }) => {
        const payload =
          operation === 'create'
            ? { ...body, [field]: null }
            : { [field]: null };
        await perform(operation, 'ADMIN', payload).expect(400);
        expectNoWrites();
      },
    );
    it('skips reference lookups when omitted from a partial update', async () => {
      await perform('update', 'ADMIN', { dayOfWeek: 2 }).expect(200);
      for (const { lookup } of references)
        expect(repository[lookup]).not.toHaveBeenCalled();
    });
    it('checks department authorization before looking up references', async () => {
      repository.getSectionDepartmentId.mockResolvedValue('department-b');
      await perform('create', 'ADMIN').expect(403);
      await perform('update', 'ADMIN', { subjectId: replacementId }).expect(
        403,
      );
      for (const { lookup } of references)
        expect(repository[lookup]).not.toHaveBeenCalled();
      expectNoWrites();
    });
    it.each(references)(
      'validates $field in direct service calls',
      async ({ field, lookup }) => {
        repository[lookup].mockResolvedValue(false);
        const actor = { id: 'actor-id', role: 'ADMIN' };
        await expect(
          service.create({ ...body, [field]: replacementId }, actor),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          service.update('template-id', { [field]: replacementId }, actor),
        ).rejects.toMatchObject({ status: 404 });
        expectNoWrites();
      },
    );
  });
});
