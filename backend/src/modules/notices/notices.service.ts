import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
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

const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: StrictR2StorageService,
  ) {}

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

    const roleCode = user.role?.code?.toUpperCase() || 'STUDENT';
    const departmentId =
      user.student?.departmentId || user.faculty?.departmentId || null;
    const programId =
      user.student?.section?.semester?.programId || null;
    const semesterNumber =
      user.student?.section?.semester?.number || null;
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
  matchesAudience(notice: any, ctx: any): boolean {
    // Admins and Super Admins can see all official notices
    if (this.isAdmin(ctx.role)) {
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
      if (ctx.role !== 'STUDENT' || !notice.programId || notice.programId !== ctx.programId) {
        return false;
      }
    }

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
        if (!ctx.departmentId || !aud.departmentIds.includes(ctx.departmentId)) {
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
      if (Array.isArray(aud.targetSemesters) && aud.targetSemesters.length > 0) {
        if (!ctx.semesterNumber || !aud.targetSemesters.includes(ctx.semesterNumber)) {
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
      orderBy: [
        { isPinned: 'desc' },
        { publishAt: 'desc' },
      ],
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
          designation: n.users_notices_authorIdTousers.faculty?.designation || null,
          department: n.users_notices_authorIdTousers.faculty?.department?.name || null,
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
    const isMod = this.isHodOrAdmin(ctx.role);

    if (!isAuthor && !isMod) {
      // Must match audience and must be active/published
      const now = new Date();
      if (notice.status !== 'PUBLISHED' || new Date(notice.publishAt) > now) {
        throw new ForbiddenException('This notice is not yet published');
      }
      if (!this.matchesAudience(notice, ctx)) {
        throw new ForbiddenException('You do not have access to view this announcement');
      }
    }

    // Auto mark as read if not already recorded
    let readEntry = notice.notice_reads[0] || null;
    if (!readEntry) {
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
      author: {
        id: notice.users_notices_authorIdTousers.id,
        name: notice.users_notices_authorIdTousers.faculty
          ? `${notice.users_notices_authorIdTousers.faculty.firstName} ${notice.users_notices_authorIdTousers.faculty.lastName || ''}`.trim()
          : notice.users_notices_authorIdTousers.email,
        designation: notice.users_notices_authorIdTousers.faculty?.designation || null,
        department: notice.users_notices_authorIdTousers.faculty?.department?.name || null,
      },
      attachments: notice.notice_attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: att.fileSize,
        createdAt: att.createdAt,
        streamUrl: `/api/v1/notices/${notice.id}/attachments/${att.id}/stream`,
      })),
      isRead: true,
      readAt: readEntry?.readAt || new Date(),
      isAcknowledged: !!readEntry?.acknowledgedAt,
      acknowledgedAt: readEntry?.acknowledgedAt || null,
    };
  }

  /**
   * READ TRACKING: Explicitly mark a notice as read
   */
  async markAsRead(userId: string, noticeId: string) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
    });
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

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

    if (!notice.requiresAcknowledgement) {
      throw new BadRequestException('This notice does not require formal acknowledgement');
    }

    if (!this.matchesAudience(notice, ctx)) {
      throw new ForbiddenException('You are not in the authorized target audience for this notice');
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
  async getManagedNotices(userId: string, userRole: string, query: QueryNoticesDto) {
    if (!this.isFacultyOrAdmin(userRole)) {
      throw new ForbiddenException('Only faculty and administrators can manage notices');
    }

    const ctx = await this.getUserAcademicContext(userId);
    const where: any = {};

    // Scope:
    // SUPER_ADMIN / ADMIN: can see all
    // HOD: can see own notices + department notices
    // FACULTY: can see own notices
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      // unrestricted
    } else if (userRole === 'HOD' && ctx.departmentId) {
      where.OR = [
        { authorId: userId },
        { departmentId: ctx.departmentId },
      ];
    } else {
      where.authorId = userId;
    }

    if (query.status) {
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
          departments: { select: { id: true, name: true, code: true } },
          programs: { select: { id: true, name: true, code: true } },
          notice_attachments: {
            select: { id: true, fileName: true, fileSize: true, fileType: true },
          },
          _count: {
            select: {
              notice_reads: true,
            },
          },
        },
      }),
      this.prisma.notices.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
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
    if (!this.isFacultyOrAdmin(userRole)) {
      throw new ForbiddenException('Only faculty and administrators can create notices');
    }

    const ctx = await this.getUserAcademicContext(userId);

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
      throw new BadRequestException('Expiration time must be after the publication time');
    }

    let status = dto.status || NoticeStatus.PUBLISHED;
    if (status !== NoticeStatus.DRAFT) {
      if (publishAt > now) {
        status = NoticeStatus.SCHEDULED;
      } else {
        status = NoticeStatus.PUBLISHED;
      }
    }

    const notice = await this.prisma.notices.create({
      data: {
        title: dto.title.trim(),
        content: dto.content.trim(),
        aiSummary: dto.aiSummary?.trim() || null,
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
      },
      include: {
        departments: true,
        programs: true,
      },
    });

    // Record audit log
    await this.prisma.notice_audit_logs.create({
      data: {
        noticeId: notice.id,
        userId,
        action: 'CREATED',
        details: `Notice created with status: ${status}, priority: ${notice.priority}`,
      },
    });

    // Dispatch in-app notifications if published immediately
    if (status === NoticeStatus.PUBLISHED) {
      this.notifyAudience(notice).catch((e) =>
        this.logger.error(`Error notifying recipients for notice ${notice.id}`, e),
      );
    }

    return notice;
  }

  /**
   * UPDATE NOTICE: Edit content, targeting, or schedule
   */
  async updateNotice(userId: string, userRole: string, noticeId: string, dto: UpdateNoticeDto) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const isAuthor = notice.authorId === userId;
    const isSuperOrAdmin = this.isAdmin(userRole);
    const ctx = await this.getUserAcademicContext(userId);
    const isDeptHod =
      userRole === 'HOD' && ctx.departmentId && notice.departmentId === ctx.departmentId;

    if (!isAuthor && !isSuperOrAdmin && !isDeptHod) {
      throw new ForbiddenException('Not authorized to edit this notice');
    }

    const now = new Date();
    const publishAt = dto.publishAt ? new Date(dto.publishAt) : notice.publishAt;
    const expiresAt = dto.expiresAt !== undefined
      ? (dto.expiresAt ? new Date(dto.expiresAt) : null)
      : notice.expiresAt;

    if (expiresAt && expiresAt <= publishAt) {
      throw new BadRequestException('Expiration time must be after publication time');
    }

    let status = dto.status || (notice.status as any);
    if (status !== NoticeStatus.DRAFT && status !== NoticeStatus.WITHDRAWN) {
      if (publishAt > now) {
        status = NoticeStatus.SCHEDULED;
      } else if (expiresAt && expiresAt <= now) {
        status = NoticeStatus.EXPIRED;
      } else {
        status = NoticeStatus.PUBLISHED;
      }
    }

    const updated = await this.prisma.notices.update({
      where: { id: noticeId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.aiSummary !== undefined ? { aiSummary: dto.aiSummary?.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.targetScope !== undefined ? { targetScope: dto.targetScope } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId || null } : {}),
        ...(dto.programId !== undefined ? { programId: dto.programId || null } : {}),
        ...(dto.targetYear !== undefined ? { targetYear: dto.targetYear || null } : {}),
        ...(dto.targetSemester !== undefined ? { targetSemester: dto.targetSemester || null } : {}),
        ...(dto.targetAudience !== undefined ? { targetAudience: dto.targetAudience as any } : {}),
        ...(dto.requiresAcknowledgement !== undefined
          ? { requiresAcknowledgement: dto.requiresAcknowledgement }
          : {}),
        ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
        ...(dto.rejectionReason !== undefined ? { rejectionReason: dto.rejectionReason } : {}),
        publishAt,
        expiresAt,
        status,
        updatedAt: now,
      },
    });

    await this.prisma.notice_audit_logs.create({
      data: {
        noticeId,
        userId,
        action: 'UPDATED',
        details: `Updated notice details`,
      },
    });

    return updated;
  }

  /**
   * WITHDRAW NOTICE: Remove from active publication with withdrawal reason
   */
  async withdrawNotice(userId: string, userRole: string, noticeId: string, reason?: string) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const isAuthor = notice.authorId === userId;
    const isSuperOrAdmin = this.isAdmin(userRole);
    const ctx = await this.getUserAcademicContext(userId);
    const isDeptHod =
      userRole === 'HOD' && ctx.departmentId && notice.departmentId === ctx.departmentId;

    if (!isAuthor && !isSuperOrAdmin && !isDeptHod) {
      throw new ForbiddenException('Not authorized to withdraw this notice');
    }

    const withdrawn = await this.prisma.notices.update({
      where: { id: noticeId },
      data: {
        status: NoticeStatus.WITHDRAWN,
        rejectionReason: reason || 'Withdrawn by publisher',
        updatedAt: new Date(),
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

    const isAuthor = notice.authorId === userId;
    const isSuperOrAdmin = this.isAdmin(userRole);

    if (!isAuthor && !isSuperOrAdmin) {
      throw new ForbiddenException('Not authorized to archive this notice');
    }

    return this.prisma.notices.update({
      where: { id: noticeId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        status: NoticeStatus.ARCHIVED,
      },
    });
  }

  /**
   * DELETE NOTICE: Hard delete draft or obsolete notice (and clean up attachments)
   */
  async deleteNotice(userId: string, userRole: string, noticeId: string) {
    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
      include: { notice_attachments: true },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const isAuthor = notice.authorId === userId;
    const isSuperOrAdmin = this.isAdmin(userRole);

    if (!isAuthor && !isSuperOrAdmin) {
      throw new ForbiddenException('Not authorized to delete this notice');
    }

    // Clean up attachments in R2
    for (const att of notice.notice_attachments) {
      if (att.fileKey) {
        await this.r2Storage.deleteObject(att.fileKey).catch(() => {});
      }
    }

    await this.prisma.notices.delete({
      where: { id: noticeId },
    });

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
      throw new ForbiddenException('Not authorized to view analytics for this notice');
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
      intendedCount = await this.prisma.user.count({ where: { isActive: true } });
    } else if (scope === 'STUDENTS') {
      intendedCount = await this.prisma.student.count({ where: { isActive: true } });
    } else if (scope === 'FACULTY') {
      intendedCount = await this.prisma.faculty.count({ where: { isActive: true } });
    } else if (scope === 'DEPARTMENT' && notice.departmentId) {
      const [sCount, fCount] = await Promise.all([
        this.prisma.student.count({ where: { departmentId: notice.departmentId, isActive: true } }),
        this.prisma.faculty.count({ where: { departmentId: notice.departmentId, isActive: true } }),
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
      intendedCount > 0 ? Math.min(100, Math.round((readCount / intendedCount) * 100)) : 0;
    const acknowledgementPercentage =
      intendedCount > 0 ? Math.min(100, Math.round((acknowledgementCount / intendedCount) * 100)) : 0;

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
        department: u.student?.department?.code || u.faculty?.department?.code || null,
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
      include: { notice_attachments: true },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const isAuthor = notice.authorId === userId;
    const isSuperOrAdmin = this.isAdmin(userRole);
    if (!isAuthor && !isSuperOrAdmin) {
      throw new ForbiddenException('Not authorized to add attachments to this notice');
    }

    if (!file) {
      throw new BadRequestException('No PDF file provided');
    }

    // Validate MIME type
    const mime = (file.mimetype || '').toLowerCase();
    if (mime !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Only PDF documents are supported for official notice attachments');
    }

    // Validate file size (max 25MB)
    const fileSize = file.size || (file.buffer ? file.buffer.length : 0);
    if (fileSize > MAX_PDF_SIZE) {
      throw new BadRequestException('PDF file exceeds the 25MB maximum upload size limit');
    }

    // Validate PDF magic bytes: %PDF
    if (file.buffer && file.buffer.length >= 4) {
      const header = file.buffer.subarray(0, 4).toString();
      if (!header.startsWith('%PDF')) {
        throw new BadRequestException('Invalid PDF file content. The file is corrupted or not a valid PDF.');
      }
    }

    // Upload to Cloudflare R2
    const fileKey = await this.r2Storage.uploadNoticeAttachment(
      file.buffer,
      file.originalname,
      'application/pdf',
    );

    const attachment = await this.prisma.notice_attachments.create({
      data: {
        noticeId,
        fileName: file.originalname,
        fileKey,
        fileUrl: `/api/v1/notices/${noticeId}/attachments/${fileKey}/stream`,
        fileType: 'application/pdf',
        fileSize,
      },
    });

    return attachment;
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
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const isAuthor = notice.authorId === userId;
    const isSuperOrAdmin = this.isAdmin(userRole);
    if (!isAuthor && !isSuperOrAdmin) {
      throw new ForbiddenException('Not authorized to delete attachments from this notice');
    }

    const attachment = await this.prisma.notice_attachments.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.noticeId !== noticeId) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.fileKey) {
      await this.r2Storage.deleteObject(attachment.fileKey).catch(() => {});
    }

    await this.prisma.notice_attachments.delete({
      where: { id: attachmentId },
    });

    return { success: true };
  }

  /**
   * ATTACHMENTS: Stream PDF for authorized in-app preview or download
   */
  async streamAttachment(userId: string, noticeId: string, attachmentId: string) {
    const ctx = await this.getUserAcademicContext(userId);

    const notice = await this.prisma.notices.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const isAuthor = notice.authorId === userId;
    const isMod = this.isHodOrAdmin(ctx.role);
    if (!isAuthor && !isMod && !this.matchesAudience(notice, ctx)) {
      throw new ForbiddenException('Not authorized to view this document');
    }

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
  private async notifyAudience(notice: any) {
    try {
      const scope = (notice.targetScope || 'ALL').toUpperCase();
      let targetUserIds: string[] = [];

      if (scope === 'ALL') {
        const users =
          (await this.prisma.user.findMany({
            where: { isActive: true },
            select: { id: true },
            take: 500, // safety cap
          })) || [];
        targetUserIds = users.map((u) => u.id);
      } else if (scope === 'DEPARTMENT' && notice.departmentId) {
        const [students = [], faculty = []] = await Promise.all([
          this.prisma.student.findMany({
            where: { departmentId: notice.departmentId, isActive: true },
            select: { userId: true },
            take: 300,
          }),
          this.prisma.faculty.findMany({
            where: { departmentId: notice.departmentId, isActive: true },
            select: { userId: true },
            take: 100,
          }),
        ]);
        targetUserIds = [
          ...(students || []).map((s) => s.userId),
          ...(faculty || []).map((f) => f.userId),
        ];
      }

      // Filter out author
      const recipientIds = targetUserIds.filter((id) => id !== notice.authorId);
      if (recipientIds.length === 0) return;

      const priorityLabel =
        ['CRITICAL', 'URGENT'].includes(notice.priority.toUpperCase())
          ? '[CRITICAL] '
          : '';

      const title = `${priorityLabel}Official Notice: ${notice.title}`;
      const message = notice.aiSummary || notice.content.substring(0, 160);

      // Batch create notifications
      await this.prisma.notifications.createMany({
        data: recipientIds.map((uId) => ({
          userId: uId,
          title,
          message,
          type: 'NOTICE_NEW',
          noticeId: notice.id,
          isRead: false,
        })),
        skipDuplicates: true,
      });

      this.logger.log(`Created in-app notifications for notice ${notice.id} to ${recipientIds.length} recipients`);
    } catch (err) {
      this.logger.error('Failed to dispatch notice notifications', err);
    }
  }
}
