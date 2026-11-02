import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitClaimDto } from './dto/submit-claim.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';
import { VerifyClaimHandoverDto } from './dto/verify-claim-handover.dto';
import { ClaimStatus, LostFoundStatus, Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { LostFoundNotificationService } from './lost-found-notification.service';
import { LostFoundContributionService } from './lost-found-contribution.service';
import { USER_SAFE_SELECT, formatUserName } from './lost-found.service';

export const HANDOVER_CODE_TTL_MS = 15 * 60 * 1000;
export const HANDOVER_CODE_MAX_ATTEMPTS = 5;

@Injectable()
export class LostFoundClaimService {
  private readonly logger = new Logger(LostFoundClaimService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: LostFoundNotificationService,
    private readonly contributionService: LostFoundContributionService,
  ) {}

  private issueCode() {
    return {
      verificationCode: randomInt(0, 1000000).toString().padStart(6, '0'),
      verificationCodeExpiresAt: new Date(Date.now() + HANDOVER_CODE_TTL_MS),
      verificationCodeAttempts: 0,
    };
  }

  private async withLockedClaim<T>(
    claimId: string,
    action: (tx: Prisma.TransactionClient, claim: any) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "lost_found_claims" WHERE "id" = ${claimId} FOR UPDATE`;
      const claim = await tx.lostFoundClaim.findUnique({
        where: { id: claimId },
        include: { report: true, claimant: { select: USER_SAFE_SELECT } },
      });
      if (!claim) throw new NotFoundException('Claim not found');
      // Serialize handovers for different claims on the same physical item too.
      await tx.$queryRaw`SELECT "id" FROM "lost_found_reports" WHERE "id" = ${claim.reportId} FOR UPDATE`;
      const report = await tx.lostFoundReport.findUnique({ where: { id: claim.reportId } });
      if (!report) throw new NotFoundException('Report not found');
      claim.report = report;
      return action(tx, claim);
    });
  }

  /**
   * Submit an ownership claim for a found item with private distinguishing details.
   */
  async submitClaim(
    userId: string,
    reportId: string,
    dto: SubmitClaimDto,
    proofImageUrl?: string,
  ) {
    const report = await this.prisma.lostFoundReport.findUnique({
      where: { id: reportId },
      include: { reporter: { select: USER_SAFE_SELECT } },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.reporterId === userId) {
      throw new BadRequestException(
        'You cannot claim an item that you reported yourself',
      );
    }

    if (
      report.status === LostFoundStatus.RESOLVED ||
      report.status === LostFoundStatus.HANDED_OVER ||
      report.status === LostFoundStatus.CANCELLED
    ) {
      throw new BadRequestException('This report is no longer open for claims');
    }

    // Check if user already has an active pending or approved claim
    const existingClaim = await this.prisma.lostFoundClaim.findFirst({
      where: {
        reportId,
        claimantId: userId,
        status: { in: [ClaimStatus.PENDING, ClaimStatus.APPROVED] },
      },
    });

    if (existingClaim) {
      throw new BadRequestException(
        'You already have an active claim under review for this item',
      );
    }

    const claim = await this.prisma.lostFoundClaim.create({
      data: {
        reportId,
        claimantId: userId,
        claimDetails: dto.claimDetails,
        proofImageUrl: proofImageUrl || dto.proofImageUrl || null,
        verificationCode: null,
        status: ClaimStatus.PENDING,
      },
      include: {
        claimant: {
          select: USER_SAFE_SELECT,
        },
      },
    });

    // Update report status to indicate an active claim is pending
    if (report.status === LostFoundStatus.OPEN) {
      await this.prisma.lostFoundReport.update({
        where: { id: reportId },
        data: { status: LostFoundStatus.CLAIM_PENDING },
      });
    }

    // Notify finder that someone filed a claim
    await this.notificationService.createNotification(
      report.reporterId,
      'New Claim Submitted',
      `A campus member submitted an ownership claim for "${report.title}". Review their distinguishing features and approve/reject the claim.`,
      { reportId, claimId: claim.id, type: 'CLAIM_SUBMITTED' },
    );

    return {
      ...claim,
      claimantName: formatUserName(claim.claimant),
    };
  }

  /**
   * Finder or Admin reviews an ownership claim.
   */
  async reviewClaim(
    userId: string,
    userRoles: string[],
    claimId: string,
    dto: ReviewClaimDto,
  ) {
    const { claim, updatedClaim } = await this.withLockedClaim(
      claimId,
      async (tx, claim) => {
        const isReportOwner = claim.report.reporterId === userId;
        const isStaff =
          userRoles.includes('ADMIN') ||
          userRoles.includes('SUPER_ADMIN') ||
          userRoles.includes('FACULTY');

        if (!isReportOwner && !isStaff) {
          throw new ForbiddenException(
            'Only the report finder or campus staff can review this claim',
          );
        }

        if (
          dto.status !== ClaimStatus.APPROVED &&
          dto.status !== ClaimStatus.REJECTED
        ) {
          throw new BadRequestException(
            'Claims can only be approved or rejected through review.',
          );
        }
        if (
          claim.status !== ClaimStatus.PENDING &&
          !(
            claim.status === ClaimStatus.APPROVED &&
            dto.status === ClaimStatus.REJECTED
          )
        ) {
          throw new BadRequestException(
            'This claim is no longer awaiting review.',
          );
        }

        const updatedClaim = await tx.lostFoundClaim.update({
          where: { id: claimId },
          data: {
            status: dto.status,
            staffNote: dto.staffNote || null,
            verifiedById: userId,
            verifiedAt: new Date(),
            ...(dto.status === ClaimStatus.APPROVED
              ? this.issueCode()
              : {
                  verificationCode: null,
                  verificationCodeExpiresAt: null,
                  verificationCodeAttempts: 0,
                }),
          },
          include: {
            claimant: { select: USER_SAFE_SELECT },
            report: true,
          },
        });
        return { claim, updatedClaim };
      },
    );

    if (dto.status === ClaimStatus.APPROVED) {
      // Notify claimant with OTP instructions
      await this.notificationService.createNotification(
        claim.claimantId,
        'Claim Approved!',
        `Your claim for "${claim.report.title}" was approved! Open My Items & Claims for your handover code. Codes expire after 15 minutes; request a fresh code when meeting the finder.`,
        { reportId: claim.reportId, claimId: claim.id, type: 'CLAIM_APPROVED' },
      );
    } else if (dto.status === ClaimStatus.REJECTED) {
      // If rejected, check if there are other pending claims; if not, return report to OPEN
      const otherClaims = await this.prisma.lostFoundClaim.count({
        where: {
          reportId: claim.reportId,
          status: { in: [ClaimStatus.PENDING, ClaimStatus.APPROVED] },
          id: { not: claimId },
        },
      });

      if (otherClaims === 0) {
        await this.prisma.lostFoundReport.update({
          where: { id: claim.reportId },
          data: { status: LostFoundStatus.OPEN },
        });
      }

      await this.notificationService.createNotification(
        claim.claimantId,
        'Claim Update',
        `Your claim for "${claim.report.title}" was not approved.${dto.staffNote ? ` Note: ${dto.staffNote}` : ''}`,
        { reportId: claim.reportId, claimId: claim.id, type: 'CLAIM_REJECTED' },
      );
    }

    return {
      ...updatedClaim,
      verificationCode:
        updatedClaim.claimantId === userId
          ? updatedClaim.verificationCode
          : undefined,
      claimantName: formatUserName(updatedClaim.claimant),
    };
  }

  /**
   * Physical Handover Verification using the claimant's 6-digit OTP code.
   */
  async verifyClaimHandover(
    userId: string,
    userRoles: string[],
    claimId: string,
    dto: VerifyClaimHandoverDto,
  ) {
    const result = await this.withLockedClaim(claimId, async (tx, claim) => {
      const isStaff = userRoles.some((role) =>
        ['ADMIN', 'SUPER_ADMIN', 'FACULTY'].includes(role),
      );
      if (claim.report.reporterId !== userId && !isStaff) {
        throw new ForbiddenException(
          'Only the item finder or campus staff can verify the handover',
        );
      }
      if (claim.status !== ClaimStatus.APPROVED) {
        throw new BadRequestException(
          'Only an approved claim can be handed over.',
        );
      }
      if (
        [
          LostFoundStatus.RESOLVED,
          LostFoundStatus.HANDED_OVER,
          LostFoundStatus.CANCELLED,
        ].includes(claim.report.status)
      ) {
        throw new BadRequestException(
          'This report is no longer open for handover.',
        );
      }
      if ((claim.verificationCodeAttempts ?? 0) >= HANDOVER_CODE_MAX_ATTEMPTS) {
        throw new BadRequestException(
          'Too many failed attempts. Ask the claimant to generate a new code.',
        );
      }
      if (
        !claim.verificationCode ||
        !claim.verificationCodeExpiresAt ||
        new Date(claim.verificationCodeExpiresAt).getTime() <= Date.now()
      ) {
        throw new BadRequestException(
          'Handover code expired. Ask the claimant to generate a new code.',
        );
      }
      if (claim.verificationCode !== dto.verificationCode.trim()) {
        await tx.lostFoundClaim.update({
          where: { id: claimId },
          data: { verificationCodeAttempts: { increment: 1 } },
        });
        // Return the error until after commit so the failed attempt is retained.
        return {
          error:
            'Invalid handover code. After five failed attempts, the claimant must generate a new code.',
        };
      }

      const verifiedClaim = await tx.lostFoundClaim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.VERIFIED_HANDOVER,
          verifiedById: userId,
          verifiedAt: new Date(),
          verificationCode: null,
          verificationCodeExpiresAt: null,
          verificationCodeAttempts: 0,
        },
        include: { claimant: { select: USER_SAFE_SELECT }, report: true },
      });
      await tx.lostFoundReport.update({
        where: { id: claim.reportId },
        data: { status: LostFoundStatus.HANDED_OVER, resolvedAt: new Date() },
      });
      await tx.lostFoundMatch.updateMany({
        where: {
          OR: [
            { lostReportId: claim.reportId },
            { foundReportId: claim.reportId },
          ],
        },
        data: { status: 'RESOLVED' },
      });
      return { claim, verifiedClaim };
    });
    if ('error' in result) throw new BadRequestException(result.error);
    const { claim, verifiedClaim } = result;

    // 4. Award 20 contribution points to the finder for verified handover
    await this.contributionService.awardPoints(
      claim.report.reporterId,
      'VERIFIED_HANDOVER',
      20,
      claim.reportId,
    );

    // 5. Notify both parties
    await this.notificationService.createNotification(
      claim.claimantId,
      'Item Handover Confirmed!',
      `The handover for "${claim.report.title}" was verified successfully. Thank you for using INCA Lost & Found!`,
      {
        reportId: claim.reportId,
        claimId: claim.id,
        type: 'HANDOVER_COMPLETED',
      },
    );

    await this.notificationService.createNotification(
      claim.report.reporterId,
      'Handover Complete (+20 Points)',
      `Handover verified for "${claim.report.title}". You earned 20 contribution points toward your campus badge!`,
      { reportId: claim.reportId, claimId: claim.id, type: 'POINTS_AWARDED' },
    );

    return {
      ...verifiedClaim,
      claimantName: formatUserName(verifiedClaim.claimant),
    };
  }

  async regenerateHandoverCode(userId: string, claimId: string) {
    return this.withLockedClaim(claimId, async (tx, claim) => {
      if (claim.claimantId !== userId)
        throw new ForbiddenException(
          'Only the claimant can generate a handover code.',
        );
      if (
        claim.status !== ClaimStatus.APPROVED ||
        [
          LostFoundStatus.RESOLVED,
          LostFoundStatus.HANDED_OVER,
          LostFoundStatus.CANCELLED,
        ].includes(claim.report.status)
      ) {
        throw new BadRequestException(
          'A new code requires an approved, open claim.',
        );
      }
      const fresh = this.issueCode();
      // Ensure regeneration invalidates the previous code even if random generation repeats it.
      if (fresh.verificationCode === claim.verificationCode) {
        fresh.verificationCode = (
          (Number(fresh.verificationCode) + 1) %
          1000000
        )
          .toString()
          .padStart(6, '0');
      }
      const updated = await tx.lostFoundClaim.update({
        where: { id: claimId },
        data: fresh,
      });
      return { id: updated.id, ...fresh };
    });
  }

  /**
   * Get claims for a report. Sensitive verification codes are only visible to the claimant or authorized staff.
   */
  async getClaimsForReport(
    reportId: string,
    currentUserId: string,
    userRoles: string[],
  ) {
    const report = await this.prisma.lostFoundReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const isReportOwner = report.reporterId === currentUserId;
    const isStaff =
      userRoles.includes('ADMIN') ||
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('FACULTY');

    const claims = await this.prisma.lostFoundClaim.findMany({
      where: {
        reportId,
        ...(isReportOwner || isStaff ? {} : { claimantId: currentUserId }),
      },
      include: {
        claimant: {
          select: USER_SAFE_SELECT,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return claims.map((c) => ({
      ...c,
      claimantName: formatUserName(c.claimant),
      verificationCode:
        c.claimantId === currentUserId ? c.verificationCode : undefined,
    }));
  }

  /**
   * Get all claims submitted by the current user.
   */
  async getMyClaims(userId: string) {
    const claims = await this.prisma.lostFoundClaim.findMany({
      where: { claimantId: userId },
      include: {
        report: {
          include: {
            images: true,
            reporter: {
              select: USER_SAFE_SELECT,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return claims.map((c) => ({
      ...c,
      report: {
        ...c.report,
        reporterName: formatUserName(c.report.reporter),
      },
    }));
  }
}
