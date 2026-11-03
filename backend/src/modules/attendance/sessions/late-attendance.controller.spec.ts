import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LateAttendanceController } from './late-attendance.controller';
import { LateAttendanceService } from './late-attendance.service';

describe('Late attendance HTTP roles and DTO boundaries', () => {
  let app: any;
  const service = Object.fromEntries(['create', 'mine', 'queue', 'review', 'cancel'].map(method => [method, jest.fn(async () => ({ ok: true }))]));
  const scheduleId = '11111111-1111-4111-8111-111111111111';
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [LateAttendanceController], providers: [{ provide: LateAttendanceService, useValue: service }] }).overrideGuard(JwtAuthGuard).useValue({ canActivate(context) { const req = context.switchToHttp().getRequest(); const role = req.headers['x-test-role']; if (!role) throw new UnauthorizedException(); req.user = { id: 'authenticated-user', role }; return true; } }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => app?.close());
  beforeEach(() => jest.clearAllMocks());
  const paths = [
    { method: 'post', path: '', body: { scheduleId, reason: 'Network outage.' }, allowed: ['FACULTY'], handler: 'create' },
    { method: 'get', path: '/mine', allowed: ['FACULTY'], handler: 'mine' },
    { method: 'get', path: '/queue', allowed: ['ADMIN', 'HOD'], handler: 'queue' },
    { method: 'post', path: '/request-id/review', body: { decision: 'APPROVED' }, allowed: ['ADMIN', 'HOD'], handler: 'review' },
    { method: 'post', path: '/request-id/cancel', allowed: ['FACULTY'], handler: 'cancel' },
  ];
  it.each(['FACULTY', 'ADMIN', 'HOD', 'STUDENT', 'COORDINATOR', 'SUPER_ADMIN'])('enforces every late-approval route for %s', async role => {
    for (const route of paths) {
      let req = request(app.getHttpServer())[route.method]('/attendance/late-requests' + route.path).set('x-test-role', role);
      if (route.body) req = req.send(route.body);
      const allowed = route.allowed.includes(role);
      await req.expect(allowed ? route.method === 'post' ? 201 : 200 : 403);
    }
  });
  it('requires authentication on every route', async () => {
    for (const route of paths) await request(app.getHttpServer())[route.method]('/attendance/late-requests' + route.path).send(route.body || {}).expect(401);
  });
  it.each([{ requesterId: 'forged' }, { reviewerId: 'forged' }, { status: 'APPROVED' }, { scheduleId: 'invalid' }, { reason: 'x' }, { reason: 'a'.repeat(2001) }])('rejects privileged or malformed create fields %p', async fields => {
    await request(app.getHttpServer()).post('/attendance/late-requests').set('x-test-role', 'FACULTY').send({ scheduleId, reason: 'Network outage.', ...fields }).expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('uses the authenticated actor instead of a supplied identity', async () => {
    await request(app.getHttpServer()).post('/attendance/late-requests').set('x-test-role', 'FACULTY').send({ scheduleId, reason: 'Network outage.' }).expect(201);
    expect(service.create).toHaveBeenCalledWith('authenticated-user', scheduleId, 'Network outage.');
  });
  it('validates review decisions and optional remarks', async () => {
    await request(app.getHttpServer()).post('/attendance/late-requests/id/review').set('x-test-role', 'ADMIN').send({ decision: 'PENDING' }).expect(400);
    await request(app.getHttpServer()).post('/attendance/late-requests/id/review').set('x-test-role', 'ADMIN').send({ decision: 'REJECTED', remark: 'a'.repeat(2001) }).expect(400);
    await request(app.getHttpServer()).post('/attendance/late-requests/id/review').set('x-test-role', 'ADMIN').send({ decision: 'REJECTED' }).expect(201);
  });
});
