import { ClaimStatus, LostFoundStatus } from '@prisma/client';
import {
  LostFoundClaimService,
  HANDOVER_CODE_MAX_ATTEMPTS,
  HANDOVER_CODE_TTL_MS,
} from './lost-found-claim.service';
import { validate } from 'class-validator';
import { VerifyClaimHandoverDto } from './dto/verify-claim-handover.dto';
import { LostFoundService } from './lost-found.service';

describe('Lost-and-found handover code limits', () => {
  let service: LostFoundClaimService;
  let db: any;
  let notifications: any;
  let contributions: any;
  let state: any;
  let failReportWrite: boolean;
  beforeEach(() => {
    state = {
      id: 'claim',
      reportId: 'report',
      claimantId: 'claimant',
      status: ClaimStatus.APPROVED,
      verificationCode: '012345',
      verificationCodeExpiresAt: new Date(Date.now() + HANDOVER_CODE_TTL_MS),
      verificationCodeAttempts: 0,
      report: {
        id: 'report',
        reporterId: 'finder',
        title: 'Keys',
        status: LostFoundStatus.CLAIM_PENDING,
      },
      claimant: { email: 'claimant@example.com' },
    };
    failReportWrite = false;
    notifications = { createNotification: jest.fn().mockResolvedValue({}) };
    contributions = { awardPoints: jest.fn().mockResolvedValue({}) };
    db = {
      $transaction: jest.fn(),
      lostFoundClaim: { count: jest.fn().mockResolvedValue(0) },
      lostFoundReport: { update: jest.fn() },
    };
    let tail = Promise.resolve();
    db.$transaction.mockImplementation(async (callback) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const draft = { ...state, report: { ...state.report } };
      let locked = false;
      const tx = {
        $queryRaw: jest.fn(async () => {
          locked = true;
          return [{ id: 'claim' }];
        }),
        lostFoundClaim: {
          findUnique: jest.fn(async () => {
            if (!locked) throw new Error('Claim read without row lock');
            return draft;
          }),
          update: jest.fn(async ({ data }) => {
            for (const [key, value] of Object.entries(data)) {
              if (
                key === 'verificationCodeAttempts' &&
                typeof value === 'object' &&
                value !== null
              )
                draft[key] += (value as any).increment;
              else draft[key] = value;
            }
            return { ...draft };
          }),
        },
        lostFoundReport: {
          findUnique: jest.fn(async () => draft.report),
          update: jest.fn(async ({ data }) => {
            if (failReportWrite) throw new Error('Report update failed');
            Object.assign(draft.report, data);
          }),
        },
        lostFoundMatch: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      try {
        const result = await callback(tx);
        state = draft;
        return result;
      } finally {
        release();
      }
    });
    service = new LostFoundClaimService(db, notifications, contributions);
  });

  const verify = (code = '012345') =>
    service.verifyClaimHandover('finder', ['STUDENT'], 'claim', {
      verificationCode: code,
    });

  it('completes an approved handover with a leading-zero code and consumes it', async () => {
    await verify();
    expect(state.status).toBe(ClaimStatus.VERIFIED_HANDOVER);
    expect(state.verificationCode).toBeNull();
    expect(state.verificationCodeExpiresAt).toBeNull();
    expect(state.report.status).toBe(LostFoundStatus.HANDED_OVER);
    expect(contributions.awardPoints).toHaveBeenCalledTimes(1);
  });
  it('persists a failed attempt even though the request returns an error', async () => {
    await expect(verify('999999')).rejects.toMatchObject({ status: 400 });
    expect(state.verificationCodeAttempts).toBe(1);
    expect(state.status).toBe(ClaimStatus.APPROVED);
    expect(contributions.awardPoints).not.toHaveBeenCalled();
  });
  it('blocks the correct code after five wrong guesses', async () => {
    for (let index = 0; index < HANDOVER_CODE_MAX_ATTEMPTS; index++)
      await expect(verify('999999')).rejects.toMatchObject({ status: 400 });
    await expect(verify()).rejects.toThrow('Too many failed attempts');
    expect(state.verificationCodeAttempts).toBe(5);
    expect(state.status).toBe(ClaimStatus.APPROVED);
  });
  it('does not let parallel guesses exceed the five-attempt budget', async () => {
    await Promise.allSettled(
      Array.from({ length: 10 }, () => verify('999999')),
    );
    expect(state.verificationCodeAttempts).toBe(5);
    await expect(verify()).rejects.toThrow('Too many failed attempts');
  });
  it.each([null, new Date(0)])(
    'rejects expired or legacy codes with expiry %s',
    async (expiresAt) => {
      state.verificationCodeExpiresAt = expiresAt;
      await expect(verify()).rejects.toThrow('expired');
      expect(contributions.awardPoints).not.toHaveBeenCalled();
    },
  );
  it.each([
    ClaimStatus.PENDING,
    ClaimStatus.REJECTED,
    ClaimStatus.CANCELLED,
    ClaimStatus.VERIFIED_HANDOVER,
  ])('rejects verification of %s claims', async (status) => {
    state.status = status;
    await expect(verify()).rejects.toMatchObject({ status: 400 });
    expect(contributions.awardPoints).not.toHaveBeenCalled();
  });
  it.each([
    LostFoundStatus.RESOLVED,
    LostFoundStatus.HANDED_OVER,
    LostFoundStatus.CANCELLED,
  ])('rejects %s reports', async (status) => {
    state.report.status = status;
    await expect(verify()).rejects.toMatchObject({ status: 400 });
  });
  it('denies unauthorized callers without consuming attempts', async () => {
    await expect(
      service.verifyClaimHandover('unrelated', ['STUDENT'], 'claim', {
        verificationCode: '999999',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(state.verificationCodeAttempts).toBe(0);
  });
  it('atomically rolls back claim completion if the report update fails', async () => {
    failReportWrite = true;
    await expect(verify()).rejects.toThrow('Report update failed');
    expect(state.status).toBe(ClaimStatus.APPROVED);
    expect(state.verificationCode).toBe('012345');
    expect(contributions.awardPoints).not.toHaveBeenCalled();
  });
  it('does not complete or reward the same handover twice concurrently', async () => {
    const results = await Promise.allSettled([verify(), verify()]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(contributions.awardPoints).toHaveBeenCalledTimes(1);
  });
  it('lets the claimant regenerate a locked code with a new expiry and reset budget', async () => {
    state.verificationCodeAttempts = 5;
    state.verificationCodeExpiresAt = null;
    const before = Date.now();
    const fresh = await service.regenerateHandoverCode('claimant', 'claim');
    expect(fresh.verificationCode).toMatch(/^\d{6}$/);
    expect(fresh.verificationCode).not.toBe('012345');
    expect(state.verificationCodeAttempts).toBe(0);
    expect(
      new Date(fresh.verificationCodeExpiresAt).getTime(),
    ).toBeGreaterThanOrEqual(before + HANDOVER_CODE_TTL_MS);
    await expect(verify('012345')).rejects.toMatchObject({ status: 400 });
    await verify(fresh.verificationCode);
  });
  it.each(['finder', 'admin', 'unrelated'])(
    "does not let %s regenerate someone else's code",
    async (userId) => {
      await expect(
        service.regenerateHandoverCode(userId, 'claim'),
      ).rejects.toMatchObject({ status: 403 });
      expect(state.verificationCode).toBe('012345');
    },
  );
  it.each([
    ClaimStatus.PENDING,
    ClaimStatus.REJECTED,
    ClaimStatus.VERIFIED_HANDOVER,
  ])('does not regenerate codes for %s claims', async (status) => {
    state.status = status;
    await expect(
      service.regenerateHandoverCode('claimant', 'claim'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('issues expiring codes only when a pending claim is approved', async () => {
    state.status = ClaimStatus.PENDING;
    state.verificationCode = null;
    const result = await service.reviewClaim('finder', ['STUDENT'], 'claim', {
      status: ClaimStatus.APPROVED,
    });
    expect(state.verificationCode).toMatch(/^\d{6}$/);
    expect(state.verificationCodeExpiresAt).toBeInstanceOf(Date);
    expect(result.verificationCode).toBeUndefined();
    expect(notifications.createNotification.mock.calls[0][2]).not.toContain(
      state.verificationCode,
    );
  });

  it('does not expose claimant codes through the finder\'s My Reports response', async () => {
    const reportService = new LostFoundService({
      lostFoundReport: { findMany: jest.fn().mockResolvedValue([{
        id: 'report', claims: [{ claimantId: 'claimant', verificationCode: '012345' }],
      }]) },
    } as any, {} as any, {} as any, {} as any);
    const reports = await reportService.getMyReports('finder');
    expect(reports[0].claims[0].verificationCode).toBeUndefined();
  });
  it('cannot bypass verification by setting handover status through claim review', async () => {
    state.status = ClaimStatus.PENDING;
    await expect(
      service.reviewClaim('finder', ['STUDENT'], 'claim', {
        status: ClaimStatus.VERIFIED_HANDOVER,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(state.status).toBe(ClaimStatus.PENDING);
  });
  it('cannot reset a locked approved claim by re-approving it', async () => {
    state.verificationCodeAttempts = 5;
    await expect(
      service.reviewClaim('finder', ['STUDENT'], 'claim', {
        status: ClaimStatus.APPROVED,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(state.verificationCodeAttempts).toBe(5);
  });
  it.each(['abcdef', '12345', '1234567', '12 345'])(
    'rejects malformed code %s at DTO validation',
    async (verificationCode) => {
      const dto = Object.assign(new VerifyClaimHandoverDto(), {
        verificationCode,
      });
      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});
