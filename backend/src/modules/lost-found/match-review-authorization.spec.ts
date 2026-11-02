import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MatchStatus } from '@prisma/client';
import request from 'supertest';
import { LostFoundController } from './lost-found.controller';
import { LostFoundMatchingService } from './lost-found-matching.service';
import { LostFoundService } from './lost-found.service';
import { LostFoundClaimService } from './lost-found-claim.service';
import { LostFoundContributionService } from './lost-found-contribution.service';
import { LostFoundNotificationService } from './lost-found-notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesGuard } from '../../common/guards/roles.guard';

describe('Lost-and-found match review authorization', () => {
  let app: INestApplication;
  let service: LostFoundMatchingService;
  const match = {
    lostReport: { reporterId: 'lost-owner' },
    foundReport: { reporterId: 'found-owner' },
  };
  const prisma = {
    lostFoundMatch: { findUnique: jest.fn(), update: jest.fn() },
  };
  const endpoint = '/api/v1/lost-found/matches/match-id/review';
  const actions = [MatchStatus.VERIFIED_MATCH, MatchStatus.REJECTED];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LostFoundController],
      providers: [
        LostFoundMatchingService,
        RolesGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: LostFoundService, useValue: {} },
        { provide: LostFoundClaimService, useValue: {} },
        { provide: LostFoundContributionService, useValue: {} },
        { provide: LostFoundNotificationService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          const id = req.headers['x-test-user'];
          if (!id) throw new UnauthorizedException();
          req.user = { id, role: req.headers['x-test-role'] || 'STUDENT' };
          return true;
        },
      })
      .compile();
    service = module.get(LostFoundMatchingService);
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
    prisma.lostFoundMatch.findUnique.mockResolvedValue(match);
    prisma.lostFoundMatch.update.mockImplementation(async ({ data }) => ({
      id: 'match-id',
      ...data,
    }));
  });
  afterAll(async () => {
    await app?.close();
  });

  it('requires authentication before reading or updating a match', async () => {
    await request(app.getHttpServer())
      .put(endpoint)
      .send({ status: MatchStatus.VERIFIED_MATCH })
      .expect(401);
    expect(prisma.lostFoundMatch.findUnique).not.toHaveBeenCalled();
    expect(prisma.lostFoundMatch.update).not.toHaveBeenCalled();
  });

  it.each(
    ['lost-owner', 'found-owner'].flatMap((userId) =>
      actions.map((status) => ({ userId, status })),
    ),
  )(
    'allows $userId to submit $status with authenticated attribution',
    async ({ userId, status }) => {
      const response = await request(app.getHttpServer())
        .put(endpoint)
        .set('x-test-user', userId)
        .send({ status })
        .expect(200);
      expect(response.body.reviewedById).toBe(userId);
      expect(prisma.lostFoundMatch.update).toHaveBeenCalledWith({
        where: { id: 'match-id' },
        data: { status, reviewedById: userId, reviewedAt: expect.any(Date) },
        include: { lostReport: true, foundReport: true },
      });
    },
  );

  it.each(
    ['ADMIN', 'SUPER_ADMIN', 'FACULTY'].flatMap((role) =>
      actions.map((status) => ({ role, status })),
    ),
  )(
    'allows authorized $role staff to submit $status',
    async ({ role, status }) => {
      await request(app.getHttpServer())
        .put(endpoint)
        .set('x-test-user', 'staff')
        .set('x-test-role', role)
        .send({ status })
        .expect(200);
      expect(prisma.lostFoundMatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reviewedById: 'staff', status }),
        }),
      );
    },
  );

  it.each(
    ['STUDENT', 'COORDINATOR', 'HOD', 'UNKNOWN', 'SUPERADMIN'].flatMap((role) =>
      actions.map((status) => ({ role, status })),
    ),
  )(
    'blocks unrelated $role callers from submitting $status',
    async ({ role, status }) => {
      await request(app.getHttpServer())
        .put(endpoint)
        .set('x-test-user', 'unrelated')
        .set('x-test-role', role)
        .send({ status })
        .expect(403);
      expect(prisma.lostFoundMatch.update).not.toHaveBeenCalled();
    },
  );

  it('returns 404 for a missing match without attempting an update', async () => {
    prisma.lostFoundMatch.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .put(endpoint)
      .set('x-test-user', 'lost-owner')
      .send({ status: MatchStatus.REJECTED })
      .expect(404);
    expect(prisma.lostFoundMatch.update).not.toHaveBeenCalled();
  });

  it.each([
    { roles: ['ADMIN'] },
    { userRoles: ['ADMIN'] },
    { reviewedById: 'lost-owner' },
    { userId: 'lost-owner' },
  ])('rejects spoofed identity or role fields: %j', async (extra) => {
    await request(app.getHttpServer())
      .put(endpoint)
      .set('x-test-user', 'unrelated')
      .send({ status: MatchStatus.REJECTED, ...extra })
      .expect(400);
    expect(prisma.lostFoundMatch.update).not.toHaveBeenCalled();
  });

  it('rejects invalid statuses without touching the match', async () => {
    await request(app.getHttpServer())
      .put(endpoint)
      .set('x-test-user', 'lost-owner')
      .send({ status: 'INVALID' })
      .expect(400);
    expect(prisma.lostFoundMatch.findUnique).not.toHaveBeenCalled();
    expect(prisma.lostFoundMatch.update).not.toHaveBeenCalled();
  });

  it('also checks authorization when called directly by another service', async () => {
    await expect(
      service.reviewMatch('match-id', 'unrelated', MatchStatus.REJECTED, [
        'STUDENT',
      ]),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.lostFoundMatch.update).not.toHaveBeenCalled();
  });

  it('does not treat a missing actor as authorized staff', async () => {
    await expect(
      service.reviewMatch('match-id', '', MatchStatus.REJECTED, ['ADMIN']),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.lostFoundMatch.findUnique).not.toHaveBeenCalled();
    expect(prisma.lostFoundMatch.update).not.toHaveBeenCalled();
  });
});
