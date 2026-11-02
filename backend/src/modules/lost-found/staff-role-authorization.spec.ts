import { ForbiddenException } from '@nestjs/common';
import { ClaimStatus } from '@prisma/client';
import { LostFoundService } from './lost-found.service';
import { LostFoundClaimService } from './lost-found-claim.service';

describe('Lost-and-found canonical staff roles', () => {
  let reports: LostFoundService;
  let claims: LostFoundClaimService;
  let prisma: any;
  const report = { id: 'report', reporterId: 'owner', title: 'Found item' };
  const claim = {
    id: 'claim',
    reportId: 'report',
    claimantId: 'claimant',
    report,
    claimant: { email: 'claimant@example.com' },
    status: ClaimStatus.APPROVED,
    verificationCode: '123456',
    verificationCodeExpiresAt: new Date(Date.now() + 60000),
    verificationCodeAttempts: 0,
  };
  const operations = [
    {
      operation: 'edit a report',
      invoke: (roles: string[], userId = 'staff') =>
        reports.updateReport('report', userId, roles, {
          description: 'Updated details',
        }),
    },
    {
      operation: 'delete a report',
      invoke: (roles: string[], userId = 'staff') =>
        reports.deleteReport('report', userId, roles),
    },
    {
      operation: 'review a claim',
      invoke: (roles: string[], userId = 'staff') =>
        claims.reviewClaim(userId, roles, 'claim', {
          status: ClaimStatus.APPROVED,
        }),
    },
    {
      operation: 'verify a handover',
      invoke: (roles: string[], userId = 'staff') =>
        claims.verifyClaimHandover(userId, roles, 'claim', {
          verificationCode: '123456',
        }),
    },
  ];

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (callback) => callback(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([]),
      lostFoundReport: {
        findUnique: jest.fn().mockResolvedValue(report),
        update: jest.fn().mockResolvedValue({
          ...report,
          reporter: { email: 'owner@example.com' },
        }),
        delete: jest.fn().mockResolvedValue(report),
      },
      lostFoundClaim: {
        findUnique: jest.fn().mockResolvedValue(claim),
        findMany: jest.fn().mockResolvedValue([claim]),
        update: jest
          .fn()
          .mockImplementation(async ({ data }) => ({ ...claim, ...data })),
      },
      lostFoundMatch: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const notifications = {
      createNotification: jest.fn().mockResolvedValue({}),
    };
    const contributions = { awardPoints: jest.fn().mockResolvedValue({}) };
    reports = new LostFoundService(
      prisma,
      {} as any,
      {} as any,
      contributions as any,
    );
    claims = new LostFoundClaimService(
      prisma,
      notifications as any,
      contributions as any,
    );
  });

  it.each(
    ['SUPER_ADMIN', 'ADMIN', 'FACULTY'].flatMap((role) =>
      operations.map((operation) => ({ role, ...operation })),
    ),
  )(
    'allows $role to $operation for another user',
    async ({ role, invoke, operation }) => {
      if (operation === 'review a claim')
        prisma.lostFoundClaim.findUnique.mockResolvedValue({
          ...claim,
          status: ClaimStatus.PENDING,
        });
      await expect(invoke([role])).resolves.toBeDefined();
    },
  );

  it.each(
    ['STUDENT', 'COORDINATOR', 'HOD', 'SUPERADMIN'].flatMap((role) =>
      operations.map((operation) => ({ role, ...operation })),
    ),
  )(
    'does not grant unrelated $role callers permission to $operation',
    async ({ role, invoke, operation }) => {
      if (operation === 'review a claim')
        prisma.lostFoundClaim.findUnique.mockResolvedValue({
          ...claim,
          status: ClaimStatus.PENDING,
        });
      await expect(invoke([role])).rejects.toThrow(ForbiddenException);
      expect(prisma.lostFoundReport.update).not.toHaveBeenCalled();
      expect(prisma.lostFoundReport.delete).not.toHaveBeenCalled();
      expect(prisma.lostFoundClaim.update).not.toHaveBeenCalled();
      expect(prisma.lostFoundMatch.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each(operations)(
    "preserves the report owner's permission to $operation",
    async ({ invoke, operation }) => {
      if (operation === 'review a claim')
        prisma.lostFoundClaim.findUnique.mockResolvedValue({
          ...claim,
          status: ClaimStatus.PENDING,
        });
      await expect(invoke(['STUDENT'], 'owner')).resolves.toBeDefined();
    },
  );

  it.each(['SUPER_ADMIN', 'ADMIN', 'FACULTY'])(
    "allows %s to list all report claims without exposing other claimants' OTPs",
    async (role) => {
      const result = await claims.getClaimsForReport('report', 'staff', [role]);
      expect(prisma.lostFoundClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { reportId: 'report' } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].verificationCode).toBeUndefined();
    },
  );

  it.each(['STUDENT', 'COORDINATOR', 'HOD', 'SUPERADMIN'])(
    'keeps %s claim listings scoped to the caller',
    async (role) => {
      await claims.getClaimsForReport('report', 'claimant', [role]);
      expect(prisma.lostFoundClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reportId: 'report', claimantId: 'claimant' },
        }),
      );
    },
  );

  it('still requires a valid OTP for a super-admin handover', async () => {
    await expect(
      claims.verifyClaimHandover('staff', ['SUPER_ADMIN'], 'claim', {
        verificationCode: '999999',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.lostFoundClaim.update).toHaveBeenCalledWith({
      where: { id: 'claim' }, data: { verificationCodeAttempts: { increment: 1 } },
    });
    expect(prisma.lostFoundReport.update).not.toHaveBeenCalled();
    expect(prisma.lostFoundMatch.updateMany).not.toHaveBeenCalled();
  });
});
