import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import {
  CreateNoticeDto,
  NoticePriority,
  NoticeStatus,
  NoticeTargetScope,
} from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { QueryNoticesDto } from './dto/query-notices.dto';
import { Prisma } from '@prisma/client';
import { NoticeEnrichmentService } from './notice-enrichment.service';
import type { NoticeEnrichment } from './notice-enrichment.service';

const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: StrictR2StorageService,
    private readonly enrichment: NoticeEnrichmentService,
  ) {}

  private enrichmentData(value: NoticeEnrichment | null) {
    return {
      aiSummary: value?.summary ?? null,
      aiDeadlines: value
        ? value.deadlines.map(({ label, when, sourceQuote }) => ({
            label,
            when,
            sourceQuote,
          }))
        : Prisma.DbNull,
      aiActionItems: value?.actionItems ?? Prisma.DbNull,
      aiKeyHighlights: value?.keyHighlights ?? Prisma.DbNull,
      aiTags: value?.tags ?? Prisma.DbNull,
    };
  }

  private enrichmentResponse(notice: any) {
    return {
      aiSummary: notice.aiSummary ?? null,
      aiDeadlines: notice.aiDeadlines ?? null,
      aiActionItems: notice.aiActionItems ?? null,
      aiKeyHighlights: notice.aiKeyHighlights ?? null,
      aiTags: notice.aiTags ?? null,
    };
  }

  private nextRevision(notice: any, now = new Date()): Date {
    const previous = notice.updatedAt
      ? new Date(notice.updatedAt).getTime()
      : 0;
    return new Date(Math.max(now.getTime(), previous + 1));
  }

  private requiresApproval(role: string): boolean {
    return !['ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  private assertWriteStatus(status?: string) {
    if (
      status !== undefined &&
      !['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SCHEDULED'].includes(status)
    ) {
      throw new BadRequestException(
        'Use the dedicated review, withdrawal, or archive action to change this state.',
      );
    }
  }

  private canReview(ctx: any, notice: any): boolean {
    return (
      notice.authorId !== ctx.userId &&
      (ctx.role === 'SUPER_ADMIN' ||
        (ctx.role === 'ADMIN' &&
          !!ctx.departmentId &&
          notice.departmentId === ctx.departmentId))
    );
  }

  private canManage(ctx: any, notice: any): boolean {
    if (!this.isFacultyOrAdmin(ctx.role)) return false;
    return (
      notice.authorId === ctx.userId ||
      ctx.role === 'SUPER_ADMIN' ||
      (ctx.role === 'ADMIN' &&
        !!ctx.departmentId &&
        notice.departmentId === ctx.departmentId)
    );
  }

  private permissions(ctx: any, notice: any) {
    return {
      approvalRequired: this.requiresApproval(
        notice.users_notices_authorIdTousers?.role?.code ||
          (notice.authorId === ctx.userId ? ctx.role : 'FACULTY'),
      ),
      canDelete:
        notice.status === 'DRAFT' &&
        !notice.isArchived &&
        this.canManage(ctx, notice) &&
        notice._count?.notice_audit_logs === 0,
      canEdit: !notice.isArchived && this.canManage(ctx, notice),
      canSubmit:
        !notice.isArchived &&
        notice.authorId === ctx.userId &&
        ['DRAFT', 'REJECTED', 'WITHDRAWN'].includes(notice.status),
      canReview:
        !notice.isArchived &&
        notice.status === 'PENDING_REVIEW' &&
        this.canReview(ctx, notice),
    };
  }

  private async withLockedNotice<T>(
    noticeId: string,
    expectedUpdatedAt: string | undefined,
    work: (tx: Prisma.TransactionClient, notice: any) => Promise<T>,
  ): Promise<T> {
    if (
      expectedUpdatedAt !== undefined &&
      !Number.isFinite(new Date(expectedUpdatedAt).getTime())
    )
      throw new BadRequestException('A valid notice revision is required.');
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM notices WHERE id = ${noticeId} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Notice not found');
      const notice = await tx.notices.findUnique({ where: { id: noticeId } });
      if (!notice) throw new NotFoundException('Notice not found');
      if (
        expectedUpdatedAt !== undefined &&
        new Date(notice.updatedAt).getTime() !==
          new Date(expectedUpdatedAt).getTime()
      ) {
        throw new ConflictException(
          'The notice changed. Reload and review the current revision before trying again.',
        );
      }
      return work(tx, notice);
    });
  }

  private async reviewContext(
    userId: string,
    userRole: string,
    reviewer = false,
  ) {
    const allowed = reviewer
      ? ['ADMIN', 'SUPER_ADMIN']
      : ['FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN'];
    if (!userId || !allowed.includes(userRole))
      throw new ForbiddenException('You cannot perform this notice action.');
    const ctx = await this.getUserAcademicContext(userId);
    if (ctx.userId !== userId || ctx.role !== userRole)
      throw new ForbiddenException(
        'Current account role does not allow this action.',
      );
    return ctx;
  }

  async submitForReview(
    userId: string,
    userRole: string,
    noticeId: string,
    expectedUpdatedAt: string,
  ) {
    const ctx = await this.reviewContext(userId, userRole);
    if (!expectedUpdatedAt)
      throw new BadRequestException('A notice revision is required.');
    return this.withLockedNotice(
      noticeId,
      expectedUpdatedAt,
      async (tx, notice) => {
        if (notice.authorId !== userId)
          throw new ForbiddenException(
            'Only the author can submit a notice for review.',
          );
        if (
          notice.isArchived ||
          !['DRAFT', 'REJECTED', 'WITHDRAWN'].includes(notice.status)
        )
          throw new ConflictException(
            'Only a draft, rejected, or withdrawn notice can be submitted.',
          );
        if (
          this.requiresApproval(userRole) &&
          (!ctx.departmentId || notice.departmentId !== ctx.departmentId)
        )
          throw new ForbiddenException(
            'An assigned department matching the notice is required.',
          );
        if (!notice.title?.trim() || !notice.content?.trim())
          throw new BadRequestException(
            'A title and body are required before review.',
          );
        if (notice.expiresAt && notice.expiresAt <= new Date())
          throw new BadRequestException(
            'Update the expired schedule before submitting.',
          );
        const updated = await tx.notices.update({
          where: { id: noticeId },
          data: {
            status: 'PENDING_REVIEW',
            approvedById: null,
            approvedAt: null,
            rejectionReason: null,
            updatedAt: this.nextRevision(notice),
          },
        });
        await tx.notice_audit_logs.create({
          data: {
            noticeId,
            userId,
            action: 'SUBMITTED_FOR_REVIEW',
            details:
              'Author submitted the current notice revision for approval.',
          },
        });
        return updated;
      },
    );
  }

  async approveNotice(
    userId: string,
    userRole: string,
    noticeId: string,
    expectedUpdatedAt: string,
  ) {
    const ctx = await this.reviewContext(userId, userRole, true);
    if (!expectedUpdatedAt)
      throw new BadRequestException('A reviewed notice revision is required.');
    return this.withLockedNotice(
      noticeId,
      expectedUpdatedAt,
      async (tx, notice) => {
        if (!this.canReview(ctx, notice))
          throw new ForbiddenException(
            'You cannot review your own notice or another department’s notice.',
          );
        if (notice.isArchived || notice.status !== 'PENDING_REVIEW')
          throw new ConflictException('Only a pending notice can be approved.');
        const now = new Date();
        if (!notice.title?.trim() || !notice.content?.trim())
          throw new BadRequestException(
            'A title and body are required before approval.',
          );
        if (notice.expiresAt && notice.expiresAt <= now)
          throw new BadRequestException(
            'An expired notice cannot be approved.',
          );
        const status = notice.publishAt > now ? 'SCHEDULED' : 'PUBLISHED';
        const updated = await tx.notices.update({
          where: { id: noticeId },
          data: {
            status,
            approvedById: userId,
            approvedAt: now,
            rejectionReason: null,
            updatedAt: this.nextRevision(notice, now),
          },
        });
        await tx.notice_audit_logs.create({
          data: {
            noticeId,
            userId,
            action: 'APPROVED',
            details: 'Reviewed revision approved; resulting state: ' + status,
          },
        });
        await tx.notifications.createMany({
          data: [
            {
              userId: notice.authorId,
              noticeId,
              type: 'NOTICE_APPROVED',
              title: 'Notice approved: ' + notice.title,
              message:
                status === 'SCHEDULED'
                  ? 'Your notice was approved and scheduled for publication.'
                  : 'Your notice was approved and published.',
              isRead: false,
            },
          ],
        });
        if (status === 'PUBLISHED') await this.notifyAudience(updated, tx);
        return updated;
      },
    );
  }

  async rejectNotice(
    userId: string,
    userRole: string,
    noticeId: string,
    expectedUpdatedAt: string,
    reason: string,
  ) {
    const ctx = await this.reviewContext(userId, userRole, true);
    if (!expectedUpdatedAt)
      throw new BadRequestException('A reviewed notice revision is required.');
    if (
      typeof reason !== 'string' ||
      reason.trim().length < 3 ||
      reason.trim().length > 2000
    )
      throw new BadRequestException(
        'A rejection reason of 3 to 2000 characters is required.',
      );
    return this.withLockedNotice(
      noticeId,
      expectedUpdatedAt,
      async (tx, notice) => {
        if (!this.canReview(ctx, notice))
          throw new ForbiddenException(
            'You cannot review your own notice or another department’s notice.',
          );
        if (notice.isArchived || notice.status !== 'PENDING_REVIEW')
          throw new ConflictException('Only a pending notice can be rejected.');
        const updated = await tx.notices.update({
          where: { id: noticeId },
          data: {
            status: 'REJECTED',
            approvedById: null,
            approvedAt: null,
            rejectionReason: reason.trim(),
            updatedAt: this.nextRevision(notice),
          },
        });
        await tx.notice_audit_logs.create({
          data: {
            noticeId,
            userId,
            action: 'REJECTED',
            details: reason.trim(),
          },
        });
        await tx.notifications.createMany({
          data: [
            {
              userId: notice.authorId,
              noticeId,
              type: 'NOTICE_REJECTED',
              title: 'Notice needs revision: ' + notice.title,
              message: reason.trim(),
              isRead: false,
            },
          ],
        });
        return updated;
      },
    );
  }

  private isFacultyOrAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  private isHodOrAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  private isAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  /**
   * Helper to fetch user's academic and departmental profile
   */
  async getUserAcademicContext(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        adminProfile: { select: { departmentId: true } },
        student: {
          include: {
            department: true,
            section: {
              include: {
                semester: {
                  include: {
                    program: true,
                  },
                },
              },
            },
          },
        },
        faculty: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return this.audienceContext(user);
  }

  private audienceContext(user: any) {
    const roleCode = user.role?.code?.toUpperCase() || 'STUDENT';
    const departmentId =
      roleCode === 'ADMIN'
        ? user.adminProfile?.departmentId || null
        : roleCode === 'STUDENT'
          ? user.student?.departmentId || null
          : user.faculty?.departmentId || null;
    const programId = user.student?.section?.semester?.programId || null;
    const semesterNumber = user.student?.section?.semester?.number || null;
    const sectionId = user.student?.sectionId || null;

    return {
      userId: user.id,
      role: roleCode,
      departmentId,
      programId,
      semesterNumber,
      sectionId,
      student: user.student,
      faculty: user.faculty,
    };
  }

  /**
   * Check whether a specific notice matches the recipient's audience criteria
   */
  matchesAudience(notice: any, ctx: any, allowAdminOverride = true): boolean {
    // Admins and Super Admins can see all official notices
    if (allowAdminOverride && this.isAdmin(ctx.role)) {
      return true;
    }

    const targetScope = (notice.targetScope || 'ALL').toUpperCase();

    // 1. Basic target scope checks
    if (targetScope === 'ALL') {
      // Intended for everyone
    } else if (targetScope === 'STUDENTS') {
      if (ctx.role !== 'STUDENT') return false;
    } else if (targetScope === 'FACULTY') {
      if (!['FACULTY', 'HOD'].includes(ctx.role)) return false;
    } else if (targetScope === 'DEPARTMENT') {
      if (!notice.departmentId || notice.departmentId !== ctx.departmentId) {
        return false;
      }
    } else if (targetScope === 'PROGRAM') {
      if (
        ctx.role !== 'STUDENT' ||
        !notice.programId ||
        notice.programId !== ctx.programId
      ) {
        return false;
      }
    }

    if (
      notice.targetYear &&
      ctx.role === 'STUDENT' &&
      (!ctx.semesterNumber ||
        Math.ceil(ctx.semesterNumber / 2) !== notice.targetYear)
    )
      return false;
    // 2. Specific Target Year & Semester checks on notice columns
    if (notice.targetSemester && ctx.role === 'STUDENT') {
      if (ctx.semesterNumber !== notice.targetSemester) return false;
    }

    // 3. Advanced JSON targetAudience criteria
    if (notice.targetAudience && typeof notice.targetAudience === 'object') {
      const aud = notice.targetAudience as any;

      // Roles filter
      if (Array.isArray(aud.roles) && aud.roles.length > 0) {
        const matchesRole = aud.roles.some(
          (r: string) => r.toUpperCase() === ctx.role,
        );
        if (!matchesRole) return false;
      }

      // Department filter
      if (Array.isArray(aud.departmentIds) && aud.departmentIds.length > 0) {
        if (
          !ctx.departmentId ||
          !aud.departmentIds.includes(ctx.departmentId)
        ) {
          return false;
        }
      }

      // Program filter
      if (Array.isArray(aud.programIds) && aud.programIds.length > 0) {
        if (!ctx.programId || !aud.programIds.includes(ctx.programId)) {
          return false;
        }
      }

      // Semesters filter
      if (
        Array.isArray(aud.targetSemesters) &&
        aud.targetSemesters.length > 0
      ) {
        if (
          !ctx.semesterNumber ||
          !aud.targetSemesters.includes(ctx.semesterNumber)
        ) {
          return false;
        }
      }

      // Sections filter
      if (Array.isArray(aud.sectionIds) && aud.sectionIds.length > 0) {
        if (!ctx.sectionId || !aud.sectionIds.includes(ctx.sectionId)) {
          return false;
        }
      }

      // User IDs filter
      if (Array.isArray(aud.userIds) && aud.userIds.length > 0) {
        if (!aud.userIds.includes(ctx.userId)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * RECIPIENT FEED: Retrieve official notices relevant to the authenticated user
   */
  private assertRecipientAccess(notice: any, ctx: any) {
    const now = Date.now();
    if (
      notice.status !== 'PUBLISHED' ||
      !notice.publishAt ||
      new Date(notice.publishAt).getTime() > now ||
      notice.isArchived ||
      (notice.expiresAt && new Date(notice.expiresAt).getTime() <= now)
    )
      throw new ForbiddenException(
        'This notice is not currently published and available.',
      );
    if (!this.matchesAudience(notice, ctx))
      throw new ForbiddenException(
        'You are not in the authorized audience for this notice.',
      );
  }

  async getRecipientNotices(userId: string, query: QueryNoticesDto) {
    const ctx = await this.getUserAcademicContext(userId);
    const now = new Date();

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 10));

    // Base active filter: published, published on or before now, not expired
    const where: any = {
      status: 'PUBLISHED',
      publishAt: { lte: now },
      isArchived: query.isArchived === true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }

    if (query.priority) {
      const p = query.priority.toUpperCase();
      if (p === 'CRITICAL' || p === 'URGENT') {
        where.priority = { in: ['CRITICAL', 'URGENT'] };
      } else if (p === 'NORMAL' || p === 'MEDIUM') {
        where.priority = { in: ['NORMAL', 'MEDIUM'] };
      } else {
        where.priority = p;
      }
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.hasAttachment) {
      where.notice_attachments = { some: {} };
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: s, mode: 'insensitive' } },
            { content: { contains: s, mode: 'insensitive' } },
            { aiSummary: { contains: s, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Fetch candidate notices
    const candidateNotices = await this.prisma.notices.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
      include: {
        departments: { select: { id: true, name: true, code: true } },
        programs: { select: { id: true, name: true, code: true } },
        users_notices_authorIdTousers: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: {
              select: {
                firstName: true,
                lastName: true,
                designation: true,
                department: { select: { name: true, code: true } },
              },
            },
          },
        },
        notice_attachments: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
          },
        },
        notice_reads: {
          where: { userId },
          select: { id: true, readAt: true, acknowledgedAt: true },
        },
        _count: {
          select: {
            notice_reads: true,
            notice_attachments: true,
          },
        },
      },
    });

    // Filter candidate notices according to audience targeting rules
    const authorizedNotices = candidateNotices.filter((n) =>
      this.matchesAudience(n, ctx),
    );

    // Filter by unreadOnly if requested
    let filtered = authorizedNotices;
    if (query.unreadOnly) {
      filtered = filtered.filter((n) => n.notice_reads.length === 0);
    }

    // Sort by priority rank (CRITICAL/URGENT > HIGH > NORMAL/MEDIUM > LOW), then isPinned, then publishAt
    const priorityWeight: Record<string, number> = {
      CRITICAL: 4,
      URGENT: 4,
      HIGH: 3,
      NORMAL: 2,
      MEDIUM: 2,
      LOW: 1,
    };

    filtered.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      const weightA = priorityWeight[a.priority.toUpperCase()] || 2;
      const weightB = priorityWeight[b.priority.toUpperCase()] || 2;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedItems = filtered.slice((page - 1) * limit, page * limit);

    // Format formatted items with read state
    const items = paginatedItems.map((n) => {
      const readEntry = n.notice_reads[0] || null;
      return {
        id: n.id,
        title: n.title,
        content: n.content,
        ...this.enrichmentResponse(n),
        category: n.category,
        priority: n.priority,
        status: n.status,
        targetScope: n.targetScope,
        department: n.departments,
        program: n.programs,
        targetYear: n.targetYear,
        targetSemester: n.targetSemester,
        requiresAcknowledgement: n.requiresAcknowledgement,
        isPinned: n.isPinned,
        publishAt: n.publishAt,
        expiresAt: n.expiresAt,
        createdAt: n.createdAt,
        author: {
          id: n.users_notices_authorIdTousers.id,
          name: n.users_notices_authorIdTousers.faculty
            ? `${n.users_notices_authorIdTousers.faculty.firstName} ${n.users_notices_authorIdTousers.faculty.lastName || ''}`.trim()
            : n.users_notices_authorIdTousers.student
              ? `${n.users_notices_authorIdTousers.student.firstName} ${n.users_notices_authorIdTousers.student.lastName || ''}`.trim()
              : n.users_notices_authorIdTousers.email,
          designation:
            n.users_notices_authorIdTousers.faculty?.designation || null,
          department:
            n.users_notices_authorIdTousers.faculty?.department?.name || null,
        },
        attachments: n.notice_attachments,
        isRead: !!readEntry,
        readAt: readEntry?.readAt || null,
        isAcknowledged: !!readEntry?.acknowledgedAt,
        acknowledgedAt: readEntry?.acknowledgedAt || null,
        totalReads: n._count.notice_reads,
      };
    });

    // Extract active High and Critical announcements for banner highlight
    const criticalAlerts = filtered
      .filter((n) => ['CRITICAL', 'URGENT'].includes(n.priority.toUpperCase()))
      .slice(0, 3)
      .map((n) => ({
        id: n.id,
        title: n.title,
        priority: n.priority,
        publishAt: n.publishAt,
        expiresAt: n.expiresAt,
        requiresAcknowledgement: n.requiresAcknowledgement,
        isRead: n.notice_reads.length > 0,
        isAcknowledged: !!n.notice_reads[0]?.acknowledgedAt,
      }));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      criticalAlerts,
    };
  }

  /**
   * GET NOTICE BY ID: Retrieve single notice with permission check and auto-read
   */
  async getNoticeById(userId: string, noticeId: string) {
    const ctx = await this.getUserAcademicContext(userId);

    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
      include: {
        departments: { select: { id: true, name: true, code: true } },
        programs: { select: { id: true, name: true, code: true } },
        users_notices_authorIdTousers: {
          select: {
            id: true,
            email: true,
            role: { select: { code: true } },
            faculty: {
              select: {
                firstName: true,
                lastName: true,
                designation: true,
                department: { select: { name: true, code: true } },
              },
            },
          },
        },
        notice_attachments: true,
        notice_reads: {
          where: { userId },
          select: { id: true, readAt: true, acknowledgedAt: true },
        },
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    // Permission check
    const isAuthor = notice.authorId === userId;
    const isMod = this.canManage(ctx, notice);

    if (!isAuthor && !isMod) this.assertRecipientAccess(notice, ctx);

    // Auto mark as read if not already recorded
    let readEntry = notice.notice_reads[0] || null;
    if (
      !readEntry &&
      notice.status === 'PUBLISHED' &&
      !notice.isArchived &&
      new Date(notice.publishAt) <= new Date() &&
      (!notice.expiresAt || notice.expiresAt > new Date())
    ) {
      try {
        readEntry = await this.prisma.notice_reads.create({
          data: {
            noticeId,
            userId,
            readAt: new Date(),
          },
        });
      } catch {
        // Safe concurrency ignore
      }
    }

    return {
      id: notice.id,
      title: notice.title,
      content: notice.content,
      ...this.enrichmentResponse(notice),
      category: notice.category,
      priority: notice.priority,
      status: notice.status,
      targetScope: notice.targetScope,
      department: notice.departments,
      program: notice.programs,
      targetYear: notice.targetYear,
      targetSemester: notice.targetSemester,
      targetAudience: notice.targetAudience,
      requiresAcknowledgement: notice.requiresAcknowledgement,
      isPinned: notice.isPinned,
      publishAt: notice.publishAt,
      expiresAt: notice.expiresAt,
      isArchived: notice.isArchived,
      createdAt: notice.createdAt,
      updatedAt: notice.updatedAt,
      authorId: notice.authorId,
      approvedById: notice.approvedById,
      approvedAt: notice.approvedAt,
      rejectionReason: notice.rejectionReason,
      ...this.permissions(ctx, notice),
      author: {
        id: notice.users_notices_authorIdTousers.id,
        name: notice.users_notices_authorIdTousers.faculty
          ? `${notice.users_notices_authorIdTousers.faculty.firstName} ${notice.users_notices_authorIdTousers.faculty.lastName || ''}`.trim()
          : notice.users_notices_authorIdTousers.email,
        designation:
          notice.users_notices_authorIdTousers.faculty?.designation || null,
        department:
          notice.users_notices_authorIdTousers.faculty?.department?.name ||
          null,
      },
      attachments: notice.notice_attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: att.fileSize,
        createdAt: att.createdAt,
        streamUrl: `/api/v1/notices/${notice.id}/attachments/${att.id}/stream`,
      })),
      isRead: !!readEntry,
      readAt: readEntry?.readAt || null,
      isAcknowledged: !!readEntry?.acknowledgedAt,
      acknowledgedAt: readEntry?.acknowledgedAt || null,
    };
  }

  /**
   * READ TRACKING: Explicitly mark a notice as read
   */
  async markAsRead(userId: string, noticeId: string) {
    const ctx = await this.getUserAcademicContext(userId);
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
    });
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    this.assertRecipientAccess(notice, ctx);

    const read = await this.prisma.notice_reads.upsert({
      where: { noticeId_userId: { noticeId, userId } },
      create: {
        noticeId,
        userId,
        readAt: new Date(),
      },
      update: {},
    });

    return { success: true, readAt: read.readAt };
  }

  /**
   * ACKNOWLEDGEMENT: Officially acknowledge having read an important notice
   */
  async acknowledgeNotice(userId: string, noticeId: string) {
    const ctx = await this.getUserAcademicContext(userId);
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    this.assertRecipientAccess(notice, ctx);

    if (!notice.requiresAcknowledgement) {
      throw new BadRequestException(
        'This notice does not require formal acknowledgement',
      );
    }

    if (!this.matchesAudience(notice, ctx)) {
      throw new ForbiddenException(
        'You are not in the authorized target audience for this notice',
      );
    }

    const now = new Date();
    const read = await this.prisma.notice_reads.upsert({
      where: { noticeId_userId: { noticeId, userId } },
      create: {
        noticeId,
        userId,
        readAt: now,
        acknowledgedAt: now,
      },
      update: {
        acknowledgedAt: now,
      },
    });

    // Record audit log
    await this.prisma.notice_audit_logs.create({
      data: {
        noticeId,
        userId,
        action: 'ACKNOWLEDGED',
        details: `User acknowledged notice at ${now.toISOString()}`,
      },
    });

    return {
      success: true,
      acknowledgedAt: read.acknowledgedAt,
    };
  }

  /**
   * PUBLISHER MANAGEMENT: Get notices authored by user or in authorized department
   */
  async getManagedNotices(
    userId: string,
    userRole: string,
    query: QueryNoticesDto,
    reviewOnly = false,
  ) {
    if (!this.isFacultyOrAdmin(userRole)) {
      throw new ForbiddenException(
        'Only faculty and administrators can manage notices',
      );
    }

    const ctx = await this.getUserAcademicContext(userId);
    if (ctx.userId !== userId || ctx.role !== userRole)
      throw new ForbiddenException(
        'Current account role does not allow notice management.',
      );
    const where: any = {};

    if (reviewOnly && !this.isAdmin(userRole))
      throw new ForbiddenException('Only admins can review notices.');
    if (userRole === 'SUPER_ADMIN') {
      // Institution-wide review and management.
    } else if (userRole === 'ADMIN' && ctx.departmentId) {
      where.OR = [{ authorId: userId }, { departmentId: ctx.departmentId }];
    } else {
      if (reviewOnly)
        throw new ForbiddenException(
          'An assigned department is required to review notices.',
        );
      where.authorId = userId;
    }
    if (reviewOnly) {
      where.authorId = { not: userId };
      where.status = 'PENDING_REVIEW';
      where.isArchived = false;
    }

    if (query.status && !reviewOnly) {
      where.status = query.status.toUpperCase();
    }

    if (query.search?.trim()) {
      where.title = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 15));

    const [items, total] = await Promise.all([
      this.prisma.notices.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          users_notices_authorIdTousers: {
            select: {
              id: true,
              email: true,
              role: { select: { code: true } },
              faculty: { select: { firstName: true, lastName: true } },
            },
          },
          departments: { select: { id: true, name: true, code: true } },
          programs: { select: { id: true, name: true, code: true } },
          notice_attachments: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              fileType: true,
            },
          },
          _count: {
            select: {
              notice_reads: true,
              notice_audit_logs: {
                where: {
                  action: {
                    in: ['SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED'],
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.notices.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        author: {
          id: item.authorId,
          name: item.users_notices_authorIdTousers.faculty
            ? [
                item.users_notices_authorIdTousers.faculty.firstName,
                item.users_notices_authorIdTousers.faculty.lastName,
              ]
                .filter(Boolean)
                .join(' ')
            : item.users_notices_authorIdTousers.email,
        },
        attachments: item.notice_attachments,
        ...this.permissions(ctx, item),
        readCount: item._count.notice_reads,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * CREATE NOTICE: Publish, Schedule, or Save as Draft
   */
  async createNotice(userId: string, userRole: string, dto: CreateNoticeDto) {
    if (
      typeof dto.title !== 'string' ||
      !dto.title.trim() ||
      typeof dto.content !== 'string' ||
      !dto.content.trim()
    )
      throw new BadRequestException('A notice title and body are required.');
    if (!this.isFacultyOrAdmin(userRole)) {
      throw new ForbiddenException(
        'Only faculty and administrators can create notices',
      );
    }

    this.assertWriteStatus(dto.status);
    const ctx = await this.getUserAcademicContext(userId);
    if (ctx.userId !== userId || ctx.role !== userRole)
      throw new ForbiddenException(
        'Current account role does not allow publishing.',
      );
    if (this.requiresApproval(userRole) && !ctx.departmentId)
      throw new ForbiddenException(
        'An assigned department is required to submit notices.',
      );

    // Faculty department scoping
    let departmentId = dto.departmentId || null;
    if (userRole === 'FACULTY' || userRole === 'HOD') {
      if (ctx.departmentId) {
        departmentId = ctx.departmentId; // enforce faculty's own department
      }
    }

    // Determine lifecycle state
    const now = new Date();
    const publishAt = dto.publishAt ? new Date(dto.publishAt) : now;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt <= publishAt) {
      throw new BadRequestException(
        'Expiration time must be after the publication time',
      );
    }

    const status =
      dto.status === NoticeStatus.DRAFT
        ? NoticeStatus.DRAFT
        : this.requiresApproval(userRole) ||
            dto.status === NoticeStatus.PENDING_REVIEW
          ? NoticeStatus.PENDING_REVIEW
          : publishAt > now
            ? NoticeStatus.SCHEDULED
            : NoticeStatus.PUBLISHED;

    const generated = await this.enrichment.enrich(
      dto.title.trim(),
      dto.content.trim(),
    );
    const notice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.notices.create({
        data: {
          title: dto.title.trim(),
          content: dto.content.trim(),
          ...this.enrichmentData(generated),
          ...(dto.aiSummary !== undefined
            ? { aiSummary: dto.aiSummary?.trim() || null }
            : {}),
          category: dto.category || 'GENERAL',
          priority: dto.priority || 'NORMAL',
          targetScope: dto.targetScope || 'ALL',
          departmentId,
          programId: dto.programId || null,
          targetYear: dto.targetYear || null,
          targetSemester: dto.targetSemester || null,
          targetAudience: (dto.targetAudience as any) || null,
          requiresAcknowledgement: Boolean(dto.requiresAcknowledgement),
          isPinned: Boolean(dto.isPinned),
          publishAt,
          expiresAt,
          status,
          authorId: userId,
          approvedById: null,
          approvedAt: null,
          rejectionReason: null,
        },
        include: {
          departments: true,
          programs: true,
        },
      });

      // Record audit log
      await tx.notice_audit_logs.create({
        data: {
          noticeId: created.id,
          userId,
          action:
            status === 'PENDING_REVIEW' ? 'SUBMITTED_FOR_REVIEW' : 'CREATED',
          details: `Notice created with status: ${status}, priority: ${created.priority}`,
        },
      });

      return created;
    });

    // Dispatch in-app notifications if published immediately
    if (status === NoticeStatus.PUBLISHED) {
      this.notifyAudience(notice).catch((e) =>
        this.logger.error(
          `Error notifying recipients for notice ${notice.id}`,
          e,
        ),
      );
    }

    return notice;
  }

  /**
   * UPDATE NOTICE: Edit content, targeting, or schedule
   */
  async updateNotice(
    userId: string,
    userRole: string,
    noticeId: string,
    dto: UpdateNoticeDto,
  ) {
    this.assertWriteStatus(dto.status);
    if (
      (dto.title !== undefined &&
        (typeof dto.title !== 'string' || !dto.title.trim())) ||
      (dto.content !== undefined &&
        (typeof dto.content !== 'string' || !dto.content.trim()))
    )
      throw new BadRequestException('Notice title and body cannot be empty.');
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
      include: {
        users_notices_authorIdTousers: {
          select: { role: { select: { code: true } } },
        },
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }
    if (
      dto.expectedUpdatedAt &&
      new Date(dto.expectedUpdatedAt).getTime() !== notice.updatedAt.getTime()
    ) {
      throw new ConflictException(
        'The notice changed. Reload it before editing.',
      );
    }

    const ctx = await this.getUserAcademicContext(userId);
    if (
      ctx.userId !== userId ||
      ctx.role !== userRole ||
      !this.canManage(ctx, notice)
    )
      throw new ForbiddenException('Not authorized to edit this notice');
    if (notice.isArchived)
      throw new ConflictException('Archived notices cannot be edited.');
    if (['FACULTY', 'HOD'].includes(userRole) && !ctx.departmentId)
      throw new ForbiddenException('An assigned department is required.');
    if (
      dto.departmentId !== undefined &&
      userRole !== 'SUPER_ADMIN' &&
      dto.departmentId !==
        (['FACULTY', 'HOD'].includes(userRole)
          ? ctx.departmentId
          : notice.departmentId)
    )
      throw new ForbiddenException(
        'You cannot move this notice outside its department.',
      );

    const now = new Date();
    const publishAt = dto.publishAt
      ? new Date(dto.publishAt)
      : notice.publishAt;
    const expiresAt =
      dto.expiresAt !== undefined
        ? dto.expiresAt
          ? new Date(dto.expiresAt)
          : null
        : notice.expiresAt;

    if (expiresAt && expiresAt <= publishAt) {
      throw new BadRequestException(
        'Expiration time must be after publication time',
      );
    }

    const authorRole =
      notice.users_notices_authorIdTousers?.role?.code ||
      (notice.authorId === userId ? userRole : 'FACULTY');
    const approvalRequired = this.requiresApproval(authorRole);
    const changes = [
      'title',
      'content',
      'aiSummary',
      'category',
      'priority',
      'targetScope',
      'departmentId',
      'programId',
      'targetYear',
      'targetSemester',
      'targetAudience',
      'requiresAcknowledgement',
      'isPinned',
      'publishAt',
      'expiresAt',
    ] as const;
    const materialChanged = changes.some(
      (key) =>
        dto[key] !== undefined &&
        JSON.stringify(dto[key]) !== JSON.stringify(notice[key]),
    );
    const publishRequested = ['PUBLISHED', 'SCHEDULED'].includes(
      dto.status || '',
    );
    if (
      publishRequested &&
      ['PENDING_REVIEW', 'REJECTED'].includes(notice.status)
    )
      throw new ConflictException(
        'Use the approval workflow; pending or rejected notices cannot be published through an edit.',
      );
    let status = notice.status as NoticeStatus;
    if (dto.status === NoticeStatus.DRAFT) status = NoticeStatus.DRAFT;
    else if (dto.status === NoticeStatus.PENDING_REVIEW)
      status = NoticeStatus.PENDING_REVIEW;
    else if (approvalRequired && (materialChanged || publishRequested)) {
      status =
        ['DRAFT', 'REJECTED', 'WITHDRAWN'].includes(notice.status) &&
        !publishRequested
          ? NoticeStatus.DRAFT
          : NoticeStatus.PENDING_REVIEW;
    } else if (
      !approvalRequired &&
      (publishRequested || ['PUBLISHED', 'SCHEDULED'].includes(notice.status))
    ) {
      status =
        publishAt > now
          ? NoticeStatus.SCHEDULED
          : expiresAt && expiresAt <= now
            ? NoticeStatus.EXPIRED
            : NoticeStatus.PUBLISHED;
    }
    const invalidateApproval =
      materialChanged || ['DRAFT', 'PENDING_REVIEW'].includes(status);

    const textChanged =
      (dto.title !== undefined && dto.title.trim() !== notice.title) ||
      (dto.content !== undefined && dto.content.trim() !== notice.content);
    const generated = textChanged
      ? await this.enrichment.enrich(
          dto.title !== undefined ? dto.title.trim() : notice.title,
          dto.content !== undefined ? dto.content.trim() : notice.content,
        )
      : null;
    const updated = await this.prisma
      .$transaction(async (tx) => {
        const saved = await tx.notices.update({
          // Do not attach AI results to a different revision if another edit won
          // while the external request was in flight.
          where: { id: noticeId, updatedAt: notice.updatedAt },
          data: {
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            ...(dto.content !== undefined
              ? { content: dto.content.trim() }
              : {}),
            ...(textChanged ? this.enrichmentData(generated) : {}),
            ...(dto.aiSummary !== undefined
              ? { aiSummary: dto.aiSummary?.trim() || null }
              : {}),
            ...(dto.category !== undefined ? { category: dto.category } : {}),
            ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
            ...(dto.targetScope !== undefined
              ? { targetScope: dto.targetScope }
              : {}),
            ...(dto.departmentId !== undefined
              ? { departmentId: dto.departmentId || null }
              : {}),
            ...(dto.programId !== undefined
              ? { programId: dto.programId || null }
              : {}),
            ...(dto.targetYear !== undefined
              ? { targetYear: dto.targetYear || null }
              : {}),
            ...(dto.targetSemester !== undefined
              ? { targetSemester: dto.targetSemester || null }
              : {}),
            ...(dto.targetAudience !== undefined
              ? { targetAudience: dto.targetAudience as any }
              : {}),
            ...(dto.requiresAcknowledgement !== undefined
              ? { requiresAcknowledgement: dto.requiresAcknowledgement }
              : {}),
            ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
            ...(invalidateApproval
              ? { approvedById: null, approvedAt: null }
              : {}),
            ...(status === NoticeStatus.PENDING_REVIEW
              ? { rejectionReason: null }
              : {}),
            publishAt,
            expiresAt,
            status,
            updatedAt: this.nextRevision(notice),
          },
        });

        await tx.notice_audit_logs.create({
          data: {
            noticeId,
            userId,
            action:
              status === NoticeStatus.PENDING_REVIEW && notice.status !== status
                ? 'SUBMITTED_FOR_REVIEW'
                : 'UPDATED',
            details: `Updated notice details`,
          },
        });

        if (saved.status === 'PUBLISHED' && notice.status !== 'PUBLISHED')
          await this.notifyAudience(saved, tx);
        return saved;
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        )
          throw new ConflictException(
            'The notice changed. Reload it before saving again.',
          );
        throw error;
      });
    return updated;
  }

  /**
   * WITHDRAW NOTICE: Remove from active publication with withdrawal reason
   */
  async withdrawNotice(
    userId: string,
    userRole: string,
    noticeId: string,
    reason?: string,
  ) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const ctx = await this.getUserAcademicContext(userId);
    if (
      ctx.userId !== userId ||
      ctx.role !== userRole ||
      !this.canManage(ctx, notice)
    )
      throw new ForbiddenException('Not authorized to manage this notice.');

    const withdrawn = await this.prisma.notices.update({
      where: { id: noticeId, updatedAt: notice.updatedAt },
      data: {
        status: NoticeStatus.WITHDRAWN,
        approvedById: null,
        approvedAt: null,
        updatedAt: this.nextRevision(notice),
      },
    });

    await this.prisma.notice_audit_logs.create({
      data: {
        noticeId,
        userId,
        action: 'WITHDRAWN',
        details: reason || 'Withdrawn by publisher',
      },
    });

    return withdrawn;
  }

  /**
   * ARCHIVE NOTICE: Archive historical notice
   */
  async archiveNotice(userId: string, userRole: string, noticeId: string) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const ctx = await this.getUserAcademicContext(userId);
    if (
      ctx.userId !== userId ||
      ctx.role !== userRole ||
      !this.canManage(ctx, notice)
    )
      throw new ForbiddenException('Not authorized to manage this notice.');

    return this.prisma.notices.update({
      where: { id: noticeId, updatedAt: notice.updatedAt },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: this.nextRevision(notice),
        status: NoticeStatus.ARCHIVED,
      },
    });
  }

  /**
   * DELETE NOTICE: Delete only unsubmitted drafts; retain review history through archival.
   */
  async deleteNotice(userId: string, userRole: string, noticeId: string) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
      include: { notice_attachments: true },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const ctx = await this.getUserAcademicContext(userId);
    if (
      ctx.userId !== userId ||
      ctx.role !== userRole ||
      !this.canManage(ctx, notice)
    )
      throw new ForbiddenException('Not authorized to manage this notice.');

    await this.withLockedNotice(
      noticeId,
      notice.updatedAt?.toISOString(),
      async (tx, current) => {
        if (current.status !== 'DRAFT' || current.isArchived)
          throw new ConflictException(
            'Use archive to retain the history of submitted or published notices.',
          );
        const history = await tx.notice_audit_logs.findFirst({
          where: {
            noticeId,
            action: { in: ['SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED'] },
          },
          select: { id: true },
        });
        if (history)
          throw new ConflictException(
            'This notice has review history and must be archived instead of deleted.',
          );
        await tx.notices.delete({ where: { id: noticeId } });
      },
    );
    for (const attachment of notice.notice_attachments) {
      if (attachment.fileKey)
        await this.r2Storage.deleteObject(attachment.fileKey).catch(() => {});
    }

    return { success: true };
  }

  /**
   * PUBLISHER ANALYTICS: Read & Acknowledgement metrics
   */
  async getNoticeAnalytics(userId: string, userRole: string, noticeId: string) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
      include: {
        departments: true,
        programs: true,
        notice_reads: {
          take: 50,
          orderBy: { readAt: 'desc' },
          include: {
            users: {
              select: {
                id: true,
                email: true,
                role: { select: { code: true } },
                student: {
                  select: {
                    firstName: true,
                    lastName: true,
                    rollNumber: true,
                    department: { select: { code: true } },
                  },
                },
                faculty: {
                  select: {
                    firstName: true,
                    lastName: true,
                    department: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const isAuthor = notice.authorId === userId;
    const isSuperOrAdmin = this.isAdmin(userRole);
    if (!isAuthor && !isSuperOrAdmin) {
      throw new ForbiddenException(
        'Not authorized to view analytics for this notice',
      );
    }

    // Aggregate counts
    const [readCount, acknowledgementCount] = await Promise.all([
      this.prisma.notice_reads.count({ where: { noticeId } }),
      this.prisma.notice_reads.count({
        where: { noticeId, acknowledgedAt: { not: null } },
      }),
    ]);

    // Estimate intended recipient audience
    let intendedCount = 0;
    const scope = (notice.targetScope || 'ALL').toUpperCase();
    if (scope === 'ALL') {
      intendedCount = await this.prisma.user.count({
        where: { isActive: true },
      });
    } else if (scope === 'STUDENTS') {
      intendedCount = await this.prisma.student.count({
        where: { isActive: true },
      });
    } else if (scope === 'FACULTY') {
      intendedCount = await this.prisma.faculty.count({
        where: { isActive: true },
      });
    } else if (scope === 'DEPARTMENT' && notice.departmentId) {
      const [sCount, fCount] = await Promise.all([
        this.prisma.student.count({
          where: { departmentId: notice.departmentId, isActive: true },
        }),
        this.prisma.faculty.count({
          where: { departmentId: notice.departmentId, isActive: true },
        }),
      ]);
      intendedCount = sCount + fCount;
    } else if (scope === 'PROGRAM' && notice.programId) {
      intendedCount = await this.prisma.student.count({
        where: {
          isActive: true,
          section: { semester: { programId: notice.programId } },
        },
      });
    } else {
      intendedCount = Math.max(readCount, 1);
    }

    const readPercentage =
      intendedCount > 0
        ? Math.min(100, Math.round((readCount / intendedCount) * 100))
        : 0;
    const acknowledgementPercentage =
      intendedCount > 0
        ? Math.min(
            100,
            Math.round((acknowledgementCount / intendedCount) * 100),
          )
        : 0;

    const recentReaders = notice.notice_reads.map((r) => {
      const u = r.users;
      const name = u.student
        ? `${u.student.firstName} ${u.student.lastName || ''}`.trim()
        : u.faculty
          ? `${u.faculty.firstName} ${u.faculty.lastName || ''}`.trim()
          : u.email;

      return {
        userId: u.id,
        name,
        role: u.role?.code || 'STUDENT',
        rollNumber: u.student?.rollNumber || null,
        department:
          u.student?.department?.code || u.faculty?.department?.code || null,
        readAt: r.readAt,
        acknowledgedAt: r.acknowledgedAt,
      };
    });

    return {
      noticeId: notice.id,
      title: notice.title,
      status: notice.status,
      priority: notice.priority,
      publishAt: notice.publishAt,
      expiresAt: notice.expiresAt,
      requiresAcknowledgement: notice.requiresAcknowledgement,
      totalIntendedRecipients: intendedCount,
      readCount,
      unreadCount: Math.max(0, intendedCount - readCount),
      readPercentage,
      acknowledgementCount,
      acknowledgementPercentage,
      recentReaders,
    };
  }

  /**
   * ATTACHMENTS: Upload PDF document to Cloudflare R2
   */
  async uploadAttachment(
    userId: string,
    userRole: string,
    noticeId: string,
    file: Express.Multer.File,
  ) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
      include: {
        notice_attachments: true,
        users_notices_authorIdTousers: {
          select: { role: { select: { code: true } } },
        },
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const ctx = await this.getUserAcademicContext(userId);
    if (
      ctx.userId !== userId ||
      ctx.role !== userRole ||
      !this.canManage(ctx, notice)
    )
      throw new ForbiddenException(
        'Not authorized to add attachments to this notice',
      );
    if (notice.isArchived)
      throw new ConflictException('Archived notices cannot be edited.');

    if (!file) {
      throw new BadRequestException('No PDF file provided');
    }

    // Validate MIME type
    const mime = (file.mimetype || '').toLowerCase();
    if (
      mime !== 'application/pdf' &&
      !file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      throw new BadRequestException(
        'Only PDF documents are supported for official notice attachments',
      );
    }

    // Validate file size (max 25MB)
    const fileSize = file.size || (file.buffer ? file.buffer.length : 0);
    if (fileSize > MAX_PDF_SIZE) {
      throw new BadRequestException(
        'PDF file exceeds the 25MB maximum upload size limit',
      );
    }

    // Validate PDF magic bytes: %PDF
    if (file.buffer && file.buffer.length >= 4) {
      const header = file.buffer.subarray(0, 4).toString();
      if (!header.startsWith('%PDF')) {
        throw new BadRequestException(
          'Invalid PDF file content. The file is corrupted or not a valid PDF.',
        );
      }
    }

    // Upload to Cloudflare R2
    const fileKey = await this.r2Storage.uploadNoticeAttachment(
      file.buffer,
      file.originalname,
      'application/pdf',
    );

    try {
      return await this.withLockedNotice(
        noticeId,
        notice.updatedAt?.toISOString(),
        async (tx, current) => {
          if (current.isArchived)
            throw new ConflictException('Archived notices cannot be edited.');
          const authorRole =
            notice.users_notices_authorIdTousers?.role?.code ||
            (notice.authorId === userId ? userRole : 'FACULTY');
          const status = this.requiresApproval(authorRole)
            ? ['PUBLISHED', 'SCHEDULED', 'PENDING_REVIEW'].includes(
                current.status,
              )
              ? 'PENDING_REVIEW'
              : 'DRAFT'
            : current.status === 'REJECTED'
              ? 'DRAFT'
              : current.status;
          const revised = await tx.notices.update({
            where: { id: noticeId },
            data: {
              status,
              approvedById: null,
              approvedAt: null,
              updatedAt: this.nextRevision(current),
            },
          });
          const attachment = await tx.notice_attachments.create({
            data: {
              noticeId,
              fileName: file.originalname,
              fileKey,
              fileUrl: `/api/v1/notices/${noticeId}/attachments/${fileKey}/stream`,
              fileType: 'application/pdf',
              fileSize,
            },
          });

          await tx.notice_audit_logs.create({
            data: {
              noticeId,
              userId,
              action: 'ATTACHMENT_ADDED',
              details: 'Attachment changed; prior approval invalidated.',
            },
          });
          return { ...attachment, noticeUpdatedAt: revised.updatedAt };
        },
      );
    } catch (error) {
      await this.r2Storage.deleteObject(fileKey).catch(() => {});
      throw error;
    }
  }

  /**
   * ATTACHMENTS: Delete attachment
   */
  async deleteAttachment(
    userId: string,
    userRole: string,
    noticeId: string,
    attachmentId: string,
  ) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
      include: {
        users_notices_authorIdTousers: {
          select: { role: { select: { code: true } } },
        },
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const ctx = await this.getUserAcademicContext(userId);
    if (
      ctx.userId !== userId ||
      ctx.role !== userRole ||
      !this.canManage(ctx, notice)
    )
      throw new ForbiddenException(
        'Not authorized to delete attachments from this notice',
      );
    if (notice.isArchived)
      throw new ConflictException('Archived notices cannot be edited.');

    const attachment = await this.prisma.notice_attachments.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.noticeId !== noticeId) {
      throw new NotFoundException('Attachment not found');
    }

    await this.withLockedNotice(
      noticeId,
      notice.updatedAt?.toISOString(),
      async (tx, current) => {
        if (current.isArchived)
          throw new ConflictException('Archived notices cannot be edited.');
        const authorRole =
          notice.users_notices_authorIdTousers?.role?.code ||
          (notice.authorId === userId ? userRole : 'FACULTY');
        const status = this.requiresApproval(authorRole)
          ? ['PUBLISHED', 'SCHEDULED', 'PENDING_REVIEW'].includes(
              current.status,
            )
            ? 'PENDING_REVIEW'
            : 'DRAFT'
          : current.status === 'REJECTED'
            ? 'DRAFT'
            : current.status;
        await tx.notices.update({
          where: { id: noticeId },
          data: {
            status,
            approvedById: null,
            approvedAt: null,
            updatedAt: this.nextRevision(current),
          },
        });
        await tx.notice_attachments.delete({ where: { id: attachmentId } });
        await tx.notice_audit_logs.create({
          data: {
            noticeId,
            userId,
            action: 'ATTACHMENT_REMOVED',
            details: 'Attachment changed; prior approval invalidated.',
          },
        });
      },
    );
    if (attachment.fileKey)
      await this.r2Storage.deleteObject(attachment.fileKey).catch(() => {});

    return { success: true };
  }

  /**
   * ATTACHMENTS: Stream PDF for authorized in-app preview or download
   */
  async streamAttachment(
    userId: string,
    noticeId: string,
    attachmentId: string,
  ) {
    const ctx = await this.getUserAcademicContext(userId);

    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const isAuthor = notice.authorId === userId;
    const isMod = this.canManage(ctx, notice);
    if (!isAuthor && !isMod) this.assertRecipientAccess(notice, ctx);

    const attachment = await this.prisma.notice_attachments.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.noticeId !== noticeId) {
      throw new NotFoundException('Attachment not found');
    }

    const streamObj = await this.r2Storage.getObjectStream(attachment.fileKey);

    return {
      stream: streamObj.stream,
      contentType: streamObj.contentType || 'application/pdf',
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
    };
  }

  /**
   * AUDIENCE SCOPES: Lookup available departments, programs, and academic structures
   */
  async getAcademicScopes() {
    const [departments, programs, sessions] = await Promise.all([
      this.prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, shortName: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.program.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          departmentId: true,
          durationYears: true,
          semesters: {
            where: { isActive: true },
            select: { id: true, number: true, name: true },
            orderBy: { number: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.academicSession.findMany({
        select: { id: true, name: true, isActive: true },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    return {
      departments,
      programs,
      academicSessions: sessions,
    };
  }

  /**
   * NOTIFICATION TRIGGER: Send notifications to targeted recipients
   */
  async notifyAudience(
    notice: any,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    try {
      let cursor: string | undefined;
      let total = 0;
      while (true) {
        const users =
          (await db.user.findMany({
            where: { isActive: true, role: { isActive: true } },
            orderBy: { id: 'asc' },
            take: 500,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
              id: true,
              role: { select: { code: true } },
              student: {
                select: {
                  departmentId: true,
                  sectionId: true,
                  section: {
                    select: {
                      semester: { select: { number: true, programId: true } },
                    },
                  },
                },
              },
              faculty: { select: { departmentId: true } },
            },
          })) || [];
        const recipientIds = users
          .filter(
            (user) =>
              user.id !== notice.authorId &&
              this.matchesAudience(notice, this.audienceContext(user), false),
          )
          .map((user) => user.id);
        const priorityLabel = ['CRITICAL', 'URGENT'].includes(
          notice.priority.toUpperCase(),
        )
          ? '[CRITICAL] '
          : '';
        if (recipientIds.length)
          await db.notifications.createMany({
            data: recipientIds.map((userId) => ({
              userId,
              title: priorityLabel + 'Official Notice: ' + notice.title,
              message: notice.aiSummary || notice.content.substring(0, 160),
              type: 'NOTICE_NEW',
              noticeId: notice.id,
              isRead: false,
            })),
            skipDuplicates: true,
          });
        total += recipientIds.length;
        if (users.length < 500) break;
        cursor = users[users.length - 1].id;
      }
      this.logger.log(
        'Created in-app notifications for notice ' +
          notice.id +
          ' to ' +
          total +
          ' recipients',
      );
    } catch (err) {
      this.logger.error('Failed to dispatch notice notifications', err);
      throw err;
    }
  }
}
