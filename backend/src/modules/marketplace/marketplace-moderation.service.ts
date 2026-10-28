import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReportStatus, ListingStatus } from '@prisma/client';

@Injectable()
export class MarketplaceModerationService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  private isHodOrAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  async createReport(reporterId: string, dto: CreateReportDto) {
    if (!dto.listingId && !dto.reportedUserId && !dto.transactionId) {
      throw new BadRequestException('At least one target (listing, user, or transaction) must be specified');
    }

    let departmentId: string | null = null;

    if (dto.listingId) {
      const listing = await this.prisma.marketplaceListing.findUnique({
        where: { id: dto.listingId },
        include: {
          seller: {
            include: {
              student: true,
              faculty: true,
            },
          },
        },
      });
      if (listing) {
        departmentId =
          listing.seller.student?.departmentId ||
          listing.seller.faculty?.departmentId ||
          null;
      }
    } else if (dto.reportedUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.reportedUserId },
        include: {
          student: true,
          faculty: true,
        },
      });
      if (user) {
        departmentId =
          user.student?.departmentId ||
          user.faculty?.departmentId ||
          null;
      }
    }

    const report = await this.prisma.marketplaceReport.create({
      data: {
        reporterId,
        listingId: dto.listingId,
        transactionId: dto.transactionId,
        reportedUserId: dto.reportedUserId,
        departmentId,
        reason: dto.reason,
        description: dto.description.trim(),
        status: ReportStatus.OPEN,
      },
    });

    return report;
  }

  async getReportsForModerator(userId: string, userRole: string, status?: ReportStatus) {
    if (!this.isHodOrAdmin(userRole)) {
      throw new ForbiddenException('Only HODs and administrators can access moderation reports');
    }

    const where: any = {};
    if (status) {
      where.status = status;
    }

    if (!this.isAdmin(userRole)) {
      const faculty = await this.prisma.faculty.findUnique({
        where: { userId },
      });
      if (faculty && faculty.departmentId) {
        where.departmentId = faculty.departmentId;
      }
    }

    const reports = await this.prisma.marketplaceReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
          },
        },
        listing: {
          include: {
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
            seller: {
              select: {
                id: true,
                email: true,
                student: { select: { firstName: true, lastName: true } },
                faculty: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        reportedUser: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
          },
        },
        transaction: {
          select: {
            id: true,
            agreedPrice: true,
            status: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return reports;
  }

  async resolveReport(
    userId: string,
    userRole: string,
    reportId: string,
    dto: ResolveReportDto,
  ) {
    if (!this.isHodOrAdmin(userRole)) {
      throw new ForbiddenException('Only HODs and administrators can resolve reports');
    }

    const report = await this.prisma.marketplaceReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (!this.isAdmin(userRole)) {
      const faculty = await this.prisma.faculty.findUnique({
        where: { userId },
      });
      if (report.departmentId && faculty?.departmentId !== report.departmentId) {
        throw new ForbiddenException('You can only moderate reports for your own department');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const resolved = await tx.marketplaceReport.update({
        where: { id: reportId },
        data: {
          status: dto.status,
          resolutionNote: dto.resolutionNote?.trim() || null,
          resolvedById: userId,
          resolvedAt: new Date(),
        },
      });

      if (dto.removeListing && report.listingId) {
        await tx.marketplaceListing.update({
          where: { id: report.listingId },
          data: { status: ListingStatus.REMOVED },
        });
      }

      return resolved;
    });

    return updated;
  }
}
