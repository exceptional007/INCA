import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { LostFoundMatchingService } from './lost-found-matching.service';
import { LostFoundContributionService } from './lost-found-contribution.service';
import { Prisma } from '@prisma/client';

export const USER_SAFE_SELECT = {
  id: true,
  email: true,
  student: {
    select: {
      firstName: true,
      lastName: true,
      rollNumber: true,
      program: { select: { code: true, name: true } },
    },
  },
  faculty: {
    select: {
      firstName: true,
      lastName: true,
      department: { select: { code: true, name: true } },
    },
  },
  role: {
    select: {
      code: true,
      name: true,
    },
  },
};

export function formatUserName(user: any): string {
  if (!user) return 'Campus Member';
  if (user.student) {
    return `${user.student.firstName} ${user.student.lastName}`.trim();
  }
  if (user.faculty) {
    return `${user.faculty.firstName} ${user.faculty.lastName}`.trim();
  }
  return user.email?.split('@')[0] || 'Campus Member';
}

@Injectable()
export class LostFoundService {
  private readonly logger = new Logger(LostFoundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StrictR2StorageService,
    private readonly matchingService: LostFoundMatchingService,
    private readonly contributionService: LostFoundContributionService,
  ) { }

  /**
   * Create a new Lost or Found item report with optional photos.
   */
  async createReport(
    userId: string,
    dto: CreateReportDto,
    files?: Express.Multer.File[],
  ) {
    const report = await this.prisma.lostFoundReport.create({
      data: {
        reporterId: userId,
        type: dto.type,
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: dto.category,
        location: dto.location.trim(),
        approximateDate: new Date(dto.approximateDate),
        approximateTime: dto.approximateTime || null,
        distinguishingFeatures: dto.distinguishingFeatures?.trim() || null,
        contactPreference: dto.contactPreference?.trim() || null,
      },
    });

    // Handle photo uploads to Cloudflare R2 if present
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const fileKey = await this.storageService.uploadLostFoundPhoto(
            file.buffer,
            file.originalname,
            file.mimetype,
          );

          await this.prisma.lostFoundImage.create({
            data: {
              reportId: report.id,
              storageKey: fileKey,
              url: fileKey,
              sortOrder: i,
            },
          });
        } catch (uploadErr) {
          this.logger.error(`Failed to upload photo for report ${report.id}:`, uploadErr);
        }
      }
    }

    // Award 10 contribution points if user reported a FOUND item
    if (dto.type === 'FOUND') {
      try {
        await this.contributionService.awardPoints(
          userId,
          'REPORT_FOUND',
          10,
          report.id,
        );
      } catch (err) {
        this.logger.warn(`Could not award initial found points for report ${report.id}:`, err);
      }
    }

    // Trigger AI & Heuristic candidate matching asynchronously
    this.matchingService
      .findAndCreateMatchesForReport(report.id)
      .then((matchCount) => {
        if (matchCount > 0) {
          this.logger.log(`Created ${matchCount} potential matches for report ${report.id}`);
        }
      })
      .catch((matchErr) => {
        this.logger.error(`Error matching report ${report.id}:`, matchErr);
      });

    return this.getReportById(report.id, userId);
  }

  /**
   * Search and filter Lost & Found reports with pagination.
   */
  async getReports(query: QueryReportsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const where: Prisma.LostFoundReportWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { not: 'CANCELLED' };
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } },
      ];
    }

    const fromDate = query.dateFrom || query.startDate;
    const toDate = query.dateTo || query.endDate;

    if (fromDate || toDate) {
      where.approximateDate = {};
      if (fromDate) {
        where.approximateDate.gte = new Date(fromDate);
      }
      if (toDate) {
        where.approximateDate.lte = new Date(toDate);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.lostFoundReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
          reporter: {
            select: USER_SAFE_SELECT,
          },
          _count: {
            select: {
              claims: true,
              lostMatches: true,
              foundMatches: true,
            },
          },
        },
      }),
      this.prisma.lostFoundReport.count({ where }),
    ]);

    const formattedItems = items.map((item) => ({
      ...item,
      reporterName: formatUserName(item.reporter),
    }));

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single report details by ID.
   */
  async getReportById(id: string, currentUserId?: string) {
    const report = await this.prisma.lostFoundReport.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        reporter: {
          select: USER_SAFE_SELECT,
        },
        lostMatches: {
          include: {
            foundReport: {
              include: { images: true },
            },
          },
        },
        foundMatches: {
          include: {
            lostReport: {
              include: { images: true },
            },
          },
        },
        _count: {
          select: {
            claims: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const isOwner = currentUserId && report.reporterId === currentUserId;
    const result: any = {
      ...report,
      reporterName: formatUserName(report.reporter),
    };

    if (report.type === 'FOUND' && !isOwner && report.distinguishingFeatures) {
      result.distinguishingFeatures = '[Private - Available for verification during claim]';
    }

    return result;
  }

  /**
   * Update report details.
   */
  async updateReport(
    id: string,
    userId: string,
    userRoles: string[],
    dto: UpdateReportDto,
  ) {
    const report = await this.prisma.lostFoundReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const isOwner = report.reporterId === userId;
    const isStaff =
      userRoles.includes('ADMIN') ||
      userRoles.includes('SUPERADMIN') ||
      userRoles.includes('FACULTY');

    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You do not have permission to edit this report');
    }

    const updated = await this.prisma.lostFoundReport.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.description ? { description: dto.description.trim() } : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.location ? { location: dto.location.trim() } : {}),
        ...(dto.approximateDate ? { approximateDate: new Date(dto.approximateDate) } : {}),
        ...(dto.approximateTime !== undefined ? { approximateTime: dto.approximateTime } : {}),
        ...(dto.distinguishingFeatures !== undefined
          ? { distinguishingFeatures: dto.distinguishingFeatures }
          : {}),
        ...(dto.contactPreference !== undefined
          ? { contactPreference: dto.contactPreference }
          : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        images: true,
        reporter: {
          select: USER_SAFE_SELECT,
        },
      },
    });

    // Re-run matching if core details changed
    if (dto.title || dto.category || dto.location) {
      this.matchingService.findAndCreateMatchesForReport(id).catch(() => { });
    }

    return {
      ...updated,
      reporterName: formatUserName(updated.reporter),
    };
  }

  /**
   * Delete report.
   */
  async deleteReport(id: string, userId: string, userRoles: string[]) {
    const report = await this.prisma.lostFoundReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const isOwner = report.reporterId === userId;
    const isStaff =
      userRoles.includes('ADMIN') ||
      userRoles.includes('SUPERADMIN') ||
      userRoles.includes('FACULTY');

    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You do not have permission to delete this report');
    }

    await this.prisma.lostFoundReport.delete({
      where: { id },
    });

    return { message: 'Report deleted successfully' };
  }

  /**
   * Get reports created by the current user.
   */
  async getMyReports(userId: string) {
    const reports = await this.prisma.lostFoundReport.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        images: true,
        claims: {
          include: {
            claimant: {
              select: USER_SAFE_SELECT,
            },
          },
        },
        lostMatches: {
          include: {
            foundReport: {
              include: { images: true },
            },
          },
        },
        foundMatches: {
          include: {
            lostReport: {
              include: { images: true },
            },
          },
        },
      },
    });

    return reports.map((r) => ({
      ...r,
      claims: r.claims.map((c) => ({
        ...c,
        claimantName: formatUserName(c.claimant),
      })),
    }));
  }
}