import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Readable } from 'node:stream';
import { authProfileStore } from '../../../test/support/auth-profile-store';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './repositories/auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { PasswordMailService } from './password-mail.service';
import { ProfileService } from '../profile/profile.service';
import { ProfileController } from '../profile/profile.controller';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';

describe('Password, session and approved profile lifecycle', () => {
  let app: INestApplication,
    store: ReturnType<typeof authProfileStore>,
    session: SessionService;
  const jwt = new JwtService({
    secret: 'test-only-session-secret-at-least-32-characters',
  });
  const mail = { assertConfigured: jest.fn(), send: jest.fn() };
  const storage = {
    uploadPendingProfilePhoto: jest.fn(),
    promoteProfilePhoto: jest.fn(),
    deleteObject: jest.fn(),
    getObjectStream: jest.fn(),
  };
  const initial = 'InitialPassword123',
    next = 'ReplacementPassword456';
  let password: string;
  const user = (id: string, role: string) => ({
    id,
    email: id + '@bit.ac.in',
    password,
    authVersion: 0,
    isActive: true,
    mustChangePassword: false,
    roleId: role,
    role: { id: role, code: role, name: role, isActive: true },
    createdAt: new Date('2026-01-01'),
  });
  beforeAll(async () => {
    password = await bcrypt.hash(initial, 4);
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    store = authProfileStore();
    store.state.user.push(
      user('student', 'STUDENT'),
      user('faculty', 'FACULTY'),
      user('hod', 'HOD'),
      user('admin', 'ADMIN'),
      user('otherAdmin', 'ADMIN'),
      user('super', 'SUPER_ADMIN'),
      user('coordinator', 'COORDINATOR'),
    );
    store.state.student.push({
      id: 'student-profile',
      userId: 'student',
      firstName: 'Student',
      lastName: 'Example',
      phone: '1234567890',
      gender: 'OTHER',
      dateOfBirth: null,
      departmentId: 'a',
      department: { id: 'a', code: 'CS', name: 'Computer Science' },
      collegeId: 'DEMO',
      rollNumber: '1',
      enrollmentNumber: 'E1',
    });
    store.state.faculty.push(
      ...['faculty', 'hod'].map((id) => ({
        id: id + '-profile',
        userId: id,
        firstName: id,
        gender: 'OTHER',
        phone: null,
        dateOfBirth: null,
        departmentId: 'a',
        department: { id: 'a', name: 'Computer Science' },
        employeeCode: id,
        designation: 'Professor',
      })),
    );
    store.state.adminProfile.push(
      ...['admin', 'otherAdmin'].map((id) => ({
        id: id + '-profile',
        userId: id,
        name: id,
        departmentId: id === 'admin' ? 'a' : 'b',
        department: { id: id === 'admin' ? 'a' : 'b', name: id },
      })),
    );
    mail.send.mockResolvedValue(undefined);
    mail.assertConfigured.mockImplementation(() => {});
    storage.uploadPendingProfilePhoto.mockResolvedValue(
      'profile-requests/synthetic.png',
    );
    storage.promoteProfilePhoto.mockResolvedValue(
      'student-photos/approved.png',
    );
    storage.deleteObject.mockResolvedValue(undefined);
    storage.getObjectStream.mockImplementation(async () => ({
      stream: Readable.from(Buffer.from('synthetic image')),
      contentType: 'image/png',
    }));
    const config = {
      get: (k: string) =>
        ({ FRONTEND_URL: 'http://localhost:5183', NODE_ENV: 'test' })[k],
      getOrThrow: () => 'test-only-session-secret-at-least-32-characters',
    };
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AuthController, SessionController, ProfileController],
      providers: [
        AuthService,
        SessionService,
        ProfileService,
        JwtStrategy,
        { provide: PrismaService, useValue: store.db },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: PasswordMailService, useValue: mail },
        { provide: StrictR2StorageService, useValue: storage },
        {
          provide: AuthRepository,
          useValue: {
            findUserByEmail: (email: string) =>
              store.db.user.findUnique({ where: { email } }),
            findUserById: (id: string) =>
              store.db.user.findUnique({ where: { id } }),
          },
        },
      ],
    }).compile();
    session = module.get(SessionService);
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });
  const post = (path: string) =>
    request(app.getHttpServer()).post('/api/v1' + path);
  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get('/api/v1' + path)
      .auth(token, { type: 'bearer' });
  const login = async (id = 'student') => {
    const r = await post('/auth/login')
      .send({ email: id + '@bit.ac.in', password: initial })
      .expect(201);
    return {
      token: r.body.data.accessToken,
      cookie: r.headers['set-cookie'][0].split(';')[0],
      body: r.body,
      headers: r.headers,
    };
  };
  const submit = async (
    token: string,
    changes: object = { phone: '9876543210' },
    photo?: Buffer,
  ) => {
    const p = await get('/profile', token).expect(200);
    const req = post('/profile/requests')
      .auth(token, { type: 'bearer' })
      .field('revision', p.body.revision)
      .field('changes', JSON.stringify(changes));
    if (photo)
      req.attach('photo', photo, {
        filename: 'photo.png',
        contentType: 'image/png',
      });
    return req;
  };
  it('issues a safe login response and HttpOnly scoped refresh cookie', async () => {
    const r = await login();
    expect(r.body.data.refreshToken).toBeUndefined();
    expect(r.body.data.user.password).toBeUndefined();
    expect(r.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(r.headers['set-cookie'][0]).toContain('Path=/api/v1/auth');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(store.state.authSession[0].refreshHash).not.toBe(
      r.cookie.split('=')[1],
    );
  });
  it('rotates refresh, invalidates the old access token, and revokes the family on replay', async () => {
    const a = await login();
    const b = await post('/auth/refresh').set('Cookie', a.cookie).expect(201);
    await get('/profile', a.token).expect(401);
    await get('/profile', b.body.data.accessToken).expect(200);
    await post('/auth/refresh').set('Cookie', a.cookie).expect(401);
    await get('/profile', b.body.data.accessToken).expect(401);
    expect(store.state.authSession.every((s) => s.revokedAt)).toBe(true);
  });
  it('serializes concurrent refreshes and rejects reuse', async () => {
    const a = await login();
    const results = await Promise.all([
      post('/auth/refresh').set('Cookie', a.cookie),
      post('/auth/refresh').set('Cookie', a.cookie),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 401]);
    expect(store.state.authSession.every((s) => s.revokedAt)).toBe(true);
  });
  it.each(['/auth/refresh', '/auth/logout', '/auth/login'])(
    'blocks cross-origin cookie mutations on %s',
    async (path) => {
      const a = await login();
      await post(path)
        .set('Origin', 'https://hostile.example')
        .set('Cookie', a.cookie)
        .send(
          path.endsWith('login')
            ? { email: 'student@bit.ac.in', password: initial }
            : {},
        )
        .expect(403);
    },
  );
  it('enforces first-login change on the server and revokes every session after changing', async () => {
    store.state.user[0].mustChangePassword = true;
    const a = await login();
    await get('/profile', a.token).expect(403);
    await get('/auth/me', a.token).expect(200);
    await post('/auth/change-password')
      .auth(a.token, { type: 'bearer' })
      .send({ currentPassword: initial, newPassword: next })
      .expect(201);
    expect(store.state.user[0].mustChangePassword).toBe(false);
    expect(await bcrypt.compare(next, store.state.user[0].password)).toBe(true);
    await get('/auth/me', a.token).expect(401);
    await post('/auth/refresh').set('Cookie', a.cookie).expect(401);
    const old = await post('/auth/login').send({
      email: 'student@bit.ac.in',
      password: initial,
    });
    expect(old.status).toBe(401);
  });
  it('rejects wrong current passwords, reused and weak new passwords', async () => {
    const a = await login();
    await post('/auth/change-password')
      .auth(a.token, { type: 'bearer' })
      .send({ currentPassword: 'incorrect', newPassword: next })
      .expect(400);
    await post('/auth/change-password')
      .auth(a.token, { type: 'bearer' })
      .send({ currentPassword: initial, newPassword: initial })
      .expect(400);
    await post('/auth/change-password')
      .auth(a.token, { type: 'bearer' })
      .send({ currentPassword: initial, newPassword: 'weak' })
      .expect(400);
    expect(store.state.authSession[0].revokedAt).toBeNull();
  });
  it('uses non-enumerating recovery responses, hashed tokens, one-time resets, and global revocation', async () => {
    const a = await login();
    const known = await post('/auth/forgot-password')
      .send({ email: 'student@bit.ac.in' })
      .expect(201);
    const unknown = await post('/auth/forgot-password')
      .send({ email: 'missing@bit.ac.in' })
      .expect(201);
    expect(known.body).toEqual(unknown.body);
    const token = mail.send.mock.calls[0][1];
    expect(store.state.passwordReset[0].tokenHash).not.toBe(token);
    await post('/auth/reset-password')
      .send({ token, newPassword: next })
      .expect(201);
    await post('/auth/reset-password')
      .send({ token, newPassword: 'AnotherPassword789' })
      .expect(400);
    await get('/profile', a.token).expect(401);
    await post('/auth/refresh').set('Cookie', a.cookie).expect(401);
  });
  it('rejects expired recovery and disabled accounts without exposing reset tokens', async () => {
    await session.forgot('student@bit.ac.in');
    const token = mail.send.mock.calls[0][1];
    store.state.passwordReset[0].expiresAt = new Date(0);
    await post('/auth/reset-password')
      .send({ token, newPassword: next })
      .expect(400);
    store.state.user[0].isActive = false;
    await post('/auth/login')
      .send({ email: 'student@bit.ac.in', password: initial })
      .expect(401);
  });
  it('does not leak delivery failures or create usable reset records on failure', async () => {
    mail.send.mockRejectedValueOnce(new Error('provider secret'));
    const r = await post('/auth/forgot-password')
      .send({ email: 'student@bit.ac.in' })
      .expect(201);
    expect(JSON.stringify(r.body)).not.toContain('provider secret');
    expect(store.state.passwordReset).toHaveLength(0);
  });
  it('reports unconfigured recovery consistently', async () => {
    mail.assertConfigured.mockImplementation(() => {
      throw new (require('@nestjs/common').ServiceUnavailableException)(
        'Not configured',
      );
    });
    await post('/auth/forgot-password')
      .send({ email: 'missing@bit.ac.in' })
      .expect(503);
  });
  it('rate-limits password recovery by email', async () => {
    for (let i = 0; i < 3; i++)
      await post('/auth/forgot-password')
        .send({ email: 'missing@bit.ac.in' })
        .expect(201);
    await post('/auth/forgot-password')
      .send({ email: 'missing@bit.ac.in' })
      .expect(429);
  });
  it('logout revokes its family without revoking another device', async () => {
    const a = await login(),
      b = await login();
    await post('/auth/logout').set('Cookie', a.cookie).expect(201);
    await get('/profile', a.token).expect(401);
    await get('/profile', b.token).expect(200);
  });
  it('allows only owners to revoke sessions and supports global revocation', async () => {
    const a = await login(),
      b = await login('faculty');
    const id = store.state.authSession[0].id;
    await request(app.getHttpServer())
      .delete('/api/v1/auth/sessions/' + id)
      .auth(b.token, { type: 'bearer' })
      .expect(200);
    await get('/profile', a.token).expect(200);
    await post('/auth/logout-all')
      .auth(a.token, { type: 'bearer' })
      .expect(201);
    await get('/profile', a.token).expect(401);
    await get('/profile', b.token).expect(200);
  });
  it('rejects legacy JWTs and sessions with changed account security versions', async () => {
    const legacy = await jwt.signAsync({ sub: 'student', role: 'STUDENT' });
    await get('/profile', legacy).expect(401);
    const a = await login();
    store.state.user[0].authVersion++;
    await get('/profile', a.token).expect(401);
    await post('/auth/refresh').set('Cookie', a.cookie).expect(401);
  });
  it.each(['student', 'faculty', 'hod', 'admin', 'super', 'coordinator'])(
    'provides safe profile details for %s',
    async (id) => {
      const a = await login(id);
      const r = await get('/profile', a.token).expect(200);
      expect(r.body.email).toBe(id + '@bit.ac.in');
      expect(r.body.revision).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(r.body)).not.toContain(password);
    },
  );
  it('stages detail changes and atomically applies them only after department approval', async () => {
    const a = await login(),
      b = await login('admin');
    const r = await submit(a.token);
    expect(r.status).toBe(201);
    expect(store.state.student[0].phone).toBe('1234567890');
    await post('/profile/requests/' + r.body.id + '/approve')
      .auth(b.token, { type: 'bearer' })
      .send({})
      .expect(201);
    expect(store.state.student[0].phone).toBe('9876543210');
    expect(store.state.profileChangeRequest[0]).toMatchObject({
      status: 'APPROVED',
      reviewerId: 'admin',
    });
    expect(store.state.notifications).toHaveLength(1);
  });
  it.each(['student', 'faculty', 'otherAdmin', 'coordinator'])(
    'blocks unauthorized/self/cross-department reviewer %s',
    async (id) => {
      const a = await login(),
        b = await login(id);
      const r = await submit(a.token);
      await post('/profile/requests/' + r.body.id + '/approve')
        .auth(b.token, { type: 'bearer' })
        .send({})
        .expect(403);
      expect(store.state.student[0].phone).toBe('1234567890');
    },
  );
  it('lets HOD review faculty/student requests but requires super admin for admin requests', async () => {
    const a = await login(),
      h = await login('hod');
    const r = await submit(a.token);
    await post('/profile/requests/' + r.body.id + '/approve')
      .auth(h.token, { type: 'bearer' })
      .send({})
      .expect(201);
    const admin = await login('admin'),
      s = await login('super');
    const ar = await submit(admin.token, { name: 'Updated Admin' });
    await post('/profile/requests/' + ar.body.id + '/approve')
      .auth(h.token, { type: 'bearer' })
      .send({})
      .expect(403);
    await post('/profile/requests/' + ar.body.id + '/approve')
      .auth(s.token, { type: 'bearer' })
      .send({})
      .expect(201);
    expect(store.state.adminProfile[0].name).toBe('Updated Admin');
  });
  it('requires feedback on rejection and allows a corrected new request', async () => {
    const a = await login(),
      b = await login('admin');
    const r = await submit(a.token);
    await post('/profile/requests/' + r.body.id + '/reject')
      .auth(b.token, { type: 'bearer' })
      .send({})
      .expect(400);
    await post('/profile/requests/' + r.body.id + '/reject')
      .auth(b.token, { type: 'bearer' })
      .send({ reason: 'Please correct this number.' })
      .expect(201);
    expect(store.state.student[0].phone).toBe('1234567890');
    expect((await get('/profile/requests', a.token)).body[0].reason).toBe(
      'Please correct this number.',
    );
    expect((await submit(a.token)).status).toBe(201);
  });
  it('prevents duplicate pending requests, stale approvals, and duplicate decisions', async () => {
    const a = await login(),
      b = await login('admin');
    const r = await submit(a.token);
    expect((await submit(a.token)).status).toBe(409);
    store.state.student[0].firstName = 'Administrative correction';
    await post('/profile/requests/' + r.body.id + '/approve')
      .auth(b.token, { type: 'bearer' })
      .send({})
      .expect(409);
    store.state.student[0].firstName = 'Student';
    const decisions = await Promise.all([
      post('/profile/requests/' + r.body.id + '/approve')
        .auth(b.token, { type: 'bearer' })
        .send({}),
      post('/profile/requests/' + r.body.id + '/approve')
        .auth(b.token, { type: 'bearer' })
        .send({}),
    ]);
    expect(decisions.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(store.state.notifications).toHaveLength(1);
  });
  it('rolls back applied details if notification persistence fails', async () => {
    const a = await login(),
      b = await login('admin');
    const r = await submit(a.token);
    store.failNotifications(true);
    await post('/profile/requests/' + r.body.id + '/approve')
      .auth(b.token, { type: 'bearer' })
      .send({})
      .expect(500);
    expect(store.state.student[0].phone).toBe('1234567890');
    expect(store.state.profileChangeRequest[0].status).toBe('PENDING');
  });
  it('requires owner cancellation and excludes cancelled requests from decisions', async () => {
    const a = await login(),
      b = await login('admin');
    const r = await submit(a.token);
    await post('/profile/requests/' + r.body.id + '/cancel')
      .auth(b.token, { type: 'bearer' })
      .expect(409);
    await post('/profile/requests/' + r.body.id + '/cancel')
      .auth(a.token, { type: 'bearer' })
      .expect(201);
    await post('/profile/requests/' + r.body.id + '/approve')
      .auth(b.token, { type: 'bearer' })
      .send({})
      .expect(409);
  });
  it.each([
    { role: 'ADMIN' },
    { email: 'new@bit.ac.in' },
    { departmentId: 'b' },
    { photoKey: 'foreign.png' },
    { firstName: null },
    { gender: 'invalid' },
    { dateOfBirth: '2026-02-30' },
  ])('rejects invalid or privileged profile changes %p', async (changes) => {
    const a = await login();
    expect((await submit(a.token, changes)).status).toBe(400);
  });
  it('keeps proposed photos private and only promotes after authorized approval', async () => {
    const a = await login(),
      b = await login('admin'),
      c = await login('otherAdmin');
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
    const r = await submit(a.token, {}, png);
    expect(r.status).toBe(201);
    expect(store.state.student[0].photoKey).toBeUndefined();
    await get('/profile/requests/' + r.body.id + '/photo', c.token).expect(403);
    await get('/profile/requests/' + r.body.id + '/photo', a.token).expect(200);
    await post('/profile/requests/' + r.body.id + '/approve')
      .auth(b.token, { type: 'bearer' })
      .send({})
      .expect(201);
    expect(store.state.student[0].photoKey).toBe('student-photos/approved.png');
  });
  it('rejects spoofed images and cleans uploaded photos after submission conflicts', async () => {
    const a = await login();
    expect((await submit(a.token, {}, Buffer.from('<svg/>'))).status).toBe(400);
    await submit(a.token);
    expect(
      (
        await submit(
          a.token,
          {},
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        )
      ).status,
    ).toBe(409);
    expect(storage.deleteObject).toHaveBeenCalledWith(
      'profile-requests/synthetic.png',
    );
  });
  it('scopes review queues and prevents non-reviewers from browsing', async () => {
    const a = await login(),
      b = await login('admin'),
      c = await login('otherAdmin');
    await submit(a.token);
    expect(
      (await get('/profile/review-queue', b.token).expect(200)).body,
    ).toHaveLength(1);
    expect(
      (await get('/profile/review-queue', c.token).expect(200)).body,
    ).toHaveLength(0);
    await get('/profile/review-queue', a.token).expect(403);
  });
});
