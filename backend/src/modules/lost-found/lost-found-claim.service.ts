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
import { ClaimStatus, LostFoundStatus } from '@prisma/client';
import { LostFoundNotificationService } from './lost-found-notification.service';
import { LostFoundContributionService } from './lost-found-contribution.service';
import { USER_SAFE_SELECT, formatUserName } from './lost-found.service';

@Injectable()
export class LostFoundClaimService {
  private readonly logger = new Logger(LostFoundClaimService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: LostFoundNotificationService,
    private readonly contributionService: LostFoundContributionService,
  ) {}

  /**
   * Submit an ownership claim for a found item with private distinguishing details.
   */
  async submitClaim(userId: string, reportId: string, dto: SubmitClaimDto, proofImageUrl?: string) {
    const report = await this.prisma.lostFoundReport.findUnique({
      where: { id: reportId },
      include: { reporter: { select: USER_SAFE_SELECT } },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.reporterId === userId) {
      throw new BadRequestException('You cannot claim an item that you reported yourself');
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
      throw new BadRequestException('You already have an active claim under review for this item');
    }

    // Generate secure 6-digit verification OTP
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const claim = await this.prisma.lostFoundClaim.create({
      data: {
        reportId,
        claimantId: userId,
        claimDetails: dto.claimDetails,
        proofImageUrl: proofImageUrl || dto.proofImageUrl || null,
        verificationCode,
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
  async reviewClaim(userId: string, userRoles: string[], claimId: string, dto: ReviewClaimDto) {
    const claim = await this.prisma.lostFoundClaim.findUnique({
      where: { id: claimId },
      include: {
        report: true,
        claimant: {
          select: USER_SAFE_SELECT,
        },
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    const isReportOwner = claim.report.reporterId === userId;
    const isStaff = userRoles.includes('ADMIN') || userRoles.includes('SUPERADMIN') || userRoles.includes('FACULTY');

    if (!isReportOwner && !isStaff) {
      throw new ForbiddenException('Only the report finder or campus staff can review this claim');
    }

    const updatedClaim = await this.prisma.lostFoundClaim.update({
      where: { id: claimId },
      data: {
        status: dto.status,
        staffNote: dto.staffNote || null,
        verifiedById: userId,
        verifiedAt: new Date(),
      },
      include: {
        claimant: { select: USER_SAFE_SELECT },
        report: true,
      },
    });

    if (dto.status === ClaimStatus.APPROVED) {
      // Notify claimant with OTP instructions
      await this.notificationService.createNotification(
        claim.claimantId,
        'Claim Approved!',
        `Your claim for "${claim.report.title}" was approved! Meet the finder on campus and provide your 6-digit verification code (${claim.verificationCode}) during handover.`,
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
      claimantName: formatUserName(updatedClaim.claimant),
    };
  }

  /**
   * Physical Handover Verification using the claimant's 6-digit OTP code.
   */
  async verifyClaimHandover(userId: string, userRoles: string[], claimId: string, dto: VerifyClaimHandoverDto) {
    const claim = await this.prisma.lostFoundClaim.findUnique({
      where: { id: claimId },
      include: {
        report: true,
        claimant: {
          select: USER_SAFE_SELECT,
        },
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    const isReportOwner = claim.report.reporterId === userId;
    const isStaff = userRoles.includes('ADMIN') || userRoles.includes('SUPERADMIN') || userRoles.includes('FACULTY');

    if (!isReportOwner && !isStaff) {
      throw new ForbiddenException('Only the item finder or campus staff can verify the handover');
    }

    if (claim.status === ClaimStatus.VERIFIED_HANDOVER) {
      throw new BadRequestException('This handover has already been completed and verified');
    }

    if (claim.verificationCode !== dto.verificationCode.trim()) {
      throw new BadRequestException('Invalid 6-digit handover verification code. Please confirm with the owner.');
    }

    // 1. Mark claim as verified handover
    const verifiedClaim = await this.prisma.lostFoundClaim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.VERIFIED_HANDOVER,
        verifiedById: userId,
        verifiedAt: new Date(),
      },
      include: {
        claimant: { select: USER_SAFE_SELECT },
        report: true,
      },
    });

    // 2. Mark report as HANDED_OVER and resolved
    await this.prisma.lostFoundReport.update({
      where: { id: claim.reportId },
      data: {
        status: LostFoundStatus.HANDED_OVER,
        resolvedAt: new Date(),
      },
    });

    // 3. Mark all pending matches involving this report as RESOLVED
    await this.prisma.lostFoundMatch.updateMany({
      where: {
        OR: [{ lostReportId: claim.reportId }, { foundReportId: claim.reportId }],
      },
      data: {
        status: 'RESOLVED',
      },
    });

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
      { reportId: claim.reportId, claimId: claim.id, type: 'HANDOVER_COMPLETED' },
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

  /**
   * Get claims for a report. Sensitive verification codes are only visible to the claimant or authorized staff.
   */
  async getClaimsForReport(reportId: string, currentUserId: string, userRoles: string[]) {
    const report = await this.prisma.lostFoundReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const isReportOwner = report.reporterId === currentUserId;
    const isStaff = userRoles.includes('ADMIN') || userRoles.includes('SUPERADMIN') || userRoles.includes('FACULTY');

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
      verificationCode: c.claimantId === currentUserId ? c.verificationCode : undefined,
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
