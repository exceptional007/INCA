import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryCacheService } from '../../common/cache/memory-cache.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { QueryPollsDto, PollTabFilter } from './dto/query-polls.dto';
import { PollResultVisibility, PollStatus, PollVotingMode } from '@prisma/client';

export const RETENTION_DAYS = 15;

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: MemoryCacheService,
  ) {}

  private isAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  /**
   * Helper to format user display name and avatar
   */
  formatUserSummary(user: any) {
    if (!user) return { id: '', name: 'Campus Member', email: '', avatar: null };
    const studentName = user.student?.firstName
      ? `${user.student.firstName} ${user.student.lastName || ''}`.trim()
      : null;
    const facultyName = user.faculty?.firstName
      ? `${user.faculty.firstName} ${user.faculty.lastName || ''}`.trim()
      : null;
    const adminName = user.adminProfile?.name || null;

    const name =
      facultyName ||
      studentName ||
      adminName ||
      user.name ||
      user.email?.split('@')[0] ||
      'Campus Member';
    const avatar = user.faculty?.photoKey || user.student?.photoKey || user.avatar || null;

    return {
      id: user.id,
      name,
      email: user.email,
      avatar,
    };
  }

  /**
   * Helper to fetch user's role and academic targeting context
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
        adminProfile: {
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
      user.student?.departmentId ||
      user.faculty?.departmentId ||
      user.adminProfile?.departmentId ||
      null;
    const programId =
      user.student?.section?.semester?.programId || null;
    const semesterNumber =
      user.student?.section?.semester?.number || null;
    const batch = (user.student as any)?.batch || null;

    return {
      userId: user.id,
      role: roleCode,
      departmentId,
      programId,
      semesterNumber,
      batch,
      user,
    };
  }

  /**
   * Evaluates if a given poll is intended for the recipient user
   */
  matchesAudience(poll: any, ctx: any): boolean {
    // Creator and Admins can always view the poll
    if (poll.creatorId === ctx.userId || this.isAdmin(ctx.role)) {
      return true;
    }

    const targetScope = (poll.targetScope || 'ALL').toUpperCase();

    // 1. Role / Audience scope checks
    if (targetScope === 'STUDENT' || targetScope === 'STUDENTS') {
      if (ctx.role !== 'STUDENT') return false;
    } else if (targetScope === 'FACULTY') {
      if (!['FACULTY', 'HOD'].includes(ctx.role)) return false;
    } else if (targetScope === 'ADMIN') {
      if (!this.isAdmin(ctx.role)) return false;
    }

    // 2. Department check
    if (poll.departmentId && poll.departmentId !== ctx.departmentId) {
      return false;
    }

    // 3. Program check (student only)
    if (poll.programId && poll.programId !== ctx.programId) {
      return false;
    }

    // 4. Semester check
    if (poll.targetSemester != null && poll.targetSemester !== ctx.semesterNumber) {
      return false;
    }

    // 5. Batch check
    if (poll.targetBatch && ctx.batch && poll.targetBatch.trim() !== ctx.batch.trim()) {
      return false;
    }

    return true;
  }

  /**
   * Create a new community poll
   */
  async createPoll(userId: string, dto: CreatePollDto) {
    const expiresAt = new Date(dto.expiresAt);
    const now = new Date();

    if (isNaN(expiresAt.getTime()) || expiresAt <= now) {
      throw new BadRequestException('Expiry time must be set in the future');
    }

    let resultsPublishAt: Date | null = null;
    if (dto.resultsPublishAt) {
      resultsPublishAt = new Date(dto.resultsPublishAt);
      if (isNaN(resultsPublishAt.getTime()) || resultsPublishAt < expiresAt) {
        throw new BadRequestException(
          'Results publish time must be on or after poll expiry time',
        );
      }
    }

    const rawOptions = (dto.options || []).map((o) => o.trim()).filter(Boolean);
    const uniqueOptions = Array.from(new Set(rawOptions));

    if (uniqueOptions.length < 2) {
      throw new BadRequestException('Poll must have at least 2 distinct options');
    }

    if (uniqueOptions.length > 10) {
      throw new BadRequestException('Poll cannot exceed 10 options');
    }

    const poll = await this.prisma.poll.create({
      data: {
        question: dto.question.trim(),
        description: dto.description?.trim() || null,
        votingMode: dto.votingMode || PollVotingMode.SINGLE_CHOICE,
        isAnonymous: Boolean(dto.isAnonymous),
        resultVisibility:
          dto.resultVisibility || PollResultVisibility.ALWAYS_PUBLIC,
        status: PollStatus.ACTIVE,
        expiresAt,
        resultsPublishAt,
        targetScope: dto.targetScope || 'ALL',
        departmentId: dto.departmentId || null,
        programId: dto.programId || null,
        targetYear: dto.targetYear || null,
        targetSemester: dto.targetSemester || null,
        targetBatch: dto.targetBatch?.trim() || null,
        targetAudience: dto.targetAudience || null,
        creatorId: userId,
        options: {
          create: uniqueOptions.map((text, idx) => ({
            text,
            displayOrder: idx + 1,
          })),
        },
      },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        creator: {
          select: {
            id: true,
            email: true,
            faculty: { select: { firstName: true, lastName: true, photoKey: true } },
            student: { select: { firstName: true, lastName: true, photoKey: true } },
            adminProfile: { select: { name: true } },
          },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        program: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    this.logger.log(`Created poll ${poll?.id} by user ${userId}`);
    return {
      ...poll,
      creator: this.formatUserSummary(poll?.creator),
    };
  }

  /**
   * Get eligible polls with tab filter, search, and masked results
   */
  async getPolls(userId: string, query: QueryPollsDto) {
    const ctx = await this.getUserAcademicContext(userId);
    const now = new Date();
    const retentionLimit = new Date(
      now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const { tab = PollTabFilter.ALL, search, page = 1, limit = 20 } = query;

    // Fetch candidate polls not soft deleted
    const whereClause: any = {
      isDeleted: false,
    };

    if (search && search.trim()) {
      whereClause.OR = [
        { question: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Retention window: Polls must not be expired earlier than 15 days ago
    whereClause.expiresAt = { gte: retentionLimit };

    // Filter by tab if applicable at database level
    if (tab === PollTabFilter.ACTIVE) {
      whereClause.expiresAt = { gt: now };
      whereClause.status = PollStatus.ACTIVE;
    } else if (tab === PollTabFilter.CLOSED) {
      whereClause.expiresAt = { lte: now, gte: retentionLimit };
    } else if (tab === PollTabFilter.MY_POLLS) {
      whereClause.creatorId = userId;
    } else if (tab === PollTabFilter.PARTICIPATED) {
      whereClause.participations = {
        some: { userId },
      };
    }

    const polls = await this.prisma.poll.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            faculty: { select: { firstName: true, lastName: true, photoKey: true } },
            student: { select: { firstName: true, lastName: true, photoKey: true } },
            adminProfile: { select: { name: true } },
          },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        program: {
          select: { id: true, name: true, code: true },
        },
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        participations: {
          where: { userId },
          select: { userId: true, votedAt: true },
        },
        _count: {
          select: { participations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter by audience targeting eligibility
    const eligiblePolls = polls.filter((p: any) => this.matchesAudience(p, ctx));

    // Pagination in memory after audience targeting
    const totalCount = eligiblePolls.length;
    const startIndex = (page - 1) * limit;
    const paginatedPolls = eligiblePolls.slice(startIndex, startIndex + limit);

    // Format poll view models & mask results if required
    const items = await Promise.all(
      paginatedPolls.map((poll: any) => this.formatPollView(poll, ctx, now)),
    );

    return {
      items,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Get single poll by ID
   */
  async getPollById(userId: string, pollId: string) {
    const ctx = await this.getUserAcademicContext(userId);
    const now = new Date();

    const poll = await this.prisma.poll.findFirst({
      where: {
        id: pollId,
        isDeleted: false,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            faculty: { select: { firstName: true, lastName: true, photoKey: true } },
            student: { select: { firstName: true, lastName: true, photoKey: true } },
            adminProfile: { select: { name: true } },
          },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        program: {
          select: { id: true, name: true, code: true },
        },
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        participations: {
          where: { userId },
          select: { userId: true, votedAt: true },
        },
        _count: {
          select: { participations: true },
        },
      },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    if (!this.matchesAudience(poll, ctx)) {
      throw new ForbiddenException(
        'You do not have access to view this poll due to audience targeting restrictions',
      );
    }

    return this.formatPollView(poll, ctx, now);
  }

  /**
   * Format poll presentation and enforce result privacy / masking rules
   */
  private async formatPollView(poll: any, ctx: any, now: Date) {
    const isExpired = poll.expiresAt <= now;
    const hasVoted = (poll.participations?.length || 0) > 0;
    const isCreator = poll.creatorId === ctx.userId;
    const isAdmin = this.isAdmin(ctx.role);

    // Determine results publication schedule
    const publishTime = poll.resultsPublishAt || poll.expiresAt;
    const isResultsPublished = now >= publishTime;

    // Results visibility logic:
    // 1. ALWAYS_PUBLIC: Always visible
    // 2. AFTER_EXPIRY: Hidden while active OR before publication date (visible to creator/admin or after published)
    const canViewResults =
      poll.resultVisibility === PollResultVisibility.ALWAYS_PUBLIC ||
      isResultsPublished ||
      isCreator ||
      isAdmin;

    const totalVotes = poll._count?.participations || 0;

    // Fetch user's own voted options if identified poll
    let userVotedOptionIds: string[] = [];
    if (hasVoted) {
      if (!poll.isAnonymous) {
        const userAnswers =
          (await this.prisma.pollAnswer.findMany({
            where: {
              pollId: poll.id,
              voterId: ctx.userId,
            },
            select: { optionId: true },
          })) || [];
        userVotedOptionIds = userAnswers.map((a: any) => a.optionId);
      }
    }

    const options = (poll.options || []).map((opt: any) => {
      const voteCount = canViewResults ? opt.voteCount : 0;
      const percentage =
        canViewResults && totalVotes > 0
          ? Math.round((voteCount / totalVotes) * 100)
          : 0;

      return {
        id: opt.id,
        text: opt.text,
        displayOrder: opt.displayOrder,
        voteCount: canViewResults ? voteCount : undefined,
        percentage: canViewResults ? percentage : undefined,
        isSelectedByMe: userVotedOptionIds.includes(opt.id),
      };
    });

    // Check if within 15-day retention
    const retentionLimit = new Date(
      now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const isArchived = poll.expiresAt < retentionLimit;

    return {
      id: poll.id,
      question: poll.question,
      description: poll.description,
      votingMode: poll.votingMode,
      isAnonymous: poll.isAnonymous,
      resultVisibility: poll.resultVisibility,
      status: isArchived
        ? PollStatus.ARCHIVED
        : isExpired
        ? PollStatus.CLOSED
        : PollStatus.ACTIVE,
      expiresAt: poll.expiresAt,
      resultsPublishAt: poll.resultsPublishAt,
      targetScope: poll.targetScope,
      department: poll.department,
      program: poll.program,
      targetYear: poll.targetYear,
      targetSemester: poll.targetSemester,
      targetBatch: poll.targetBatch,
      creator: this.formatUserSummary(poll.creator),
      createdAt: poll.createdAt,
      totalVotes,
      hasVoted,
      canViewResults,
      isExpired,
      userVotedOptionIds,
      options,
    };
  }

  /**
   * Submit vote
   */
  async submitVote(userId: string, pollId: string, dto: SubmitVoteDto) {
    const ctx = await this.getUserAcademicContext(userId);
    const now = new Date();

    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: true,
      },
    });

    if (!poll || poll.isDeleted) {
      throw new NotFoundException('Poll not found');
    }

    if (!this.matchesAudience(poll, ctx)) {
      throw new ForbiddenException(
        'You are not eligible to vote in this poll based on targeting criteria',
      );
    }

    // Expiry check
    if (poll.expiresAt <= now) {
      throw new BadRequestException(
        'Poll has expired and is no longer accepting votes',
      );
    }

    // Duplicate check
    const existingParticipation = await this.prisma.pollParticipation.findUnique({
      where: {
        pollId_userId: {
          pollId,
          userId,
        },
      },
    });

    if (existingParticipation) {
      throw new BadRequestException('You have already voted in this poll');
    }

    // Validate options
    const validOptionIds = new Set(poll.options.map((o: any) => o.id));
    const submittedOptionIds = Array.from(new Set(dto.optionIds));

    if (submittedOptionIds.length === 0) {
      throw new BadRequestException('At least one option must be selected');
    }

    for (const optId of submittedOptionIds) {
      if (!validOptionIds.has(optId)) {
        throw new BadRequestException(`Option ${optId} does not exist in this poll`);
      }
    }

    if (poll.votingMode === PollVotingMode.SINGLE_CHOICE && submittedOptionIds.length > 1) {
      throw new BadRequestException(
        'Single choice poll allows only 1 selection',
      );
    }

    // 1. Record participation for deduplication
    await this.prisma.pollParticipation.create({
      data: {
        pollId,
        userId,
      },
    });

    // 2. Record individual answers
    // For anonymous polls, voterId is strictly NULL to guarantee privacy
    const answerRecords = submittedOptionIds.map((optId) => ({
      pollId,
      optionId: optId,
      voterId: poll.isAnonymous ? null : userId,
    }));

    await this.prisma.pollAnswer.createMany({
      data: answerRecords,
    });

    // 3. Increment voteCount on options concurrently
    await Promise.all(
      submittedOptionIds.map((optId) =>
        this.prisma.pollOption.update({
          where: { id: optId },
          data: {
            voteCount: { increment: 1 },
          },
        }),
      ),
    );

    this.logger.log(
      `User ${userId} voted in poll ${pollId} (Anonymous: ${poll.isAnonymous})`,
    );

    return this.getPollById(userId, pollId);
  }

  /**
   * Get authorized voter report for identified polls
   */
  async getVoterReport(userId: string, pollId: string) {
    const ctx = await this.getUserAcademicContext(userId);

    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: true,
      },
    });

    if (!poll || poll.isDeleted) {
      throw new NotFoundException('Poll not found');
    }

    // Only creator or admin can view report
    if (poll.creatorId !== userId && !this.isAdmin(ctx.role)) {
      throw new ForbiddenException(
        'Only the poll creator or an administrator can access the voter report',
      );
    }

    // Strict privacy guarantee: anonymous polls never have a voter report
    if (poll.isAnonymous) {
      throw new ForbiddenException(
        'Voter report is strictly disabled for anonymous polls to preserve voter privacy',
      );
    }

    // Fetch participations with user details
    const participations = await this.prisma.pollParticipation.findMany({
      where: { pollId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: { select: { code: true, name: true } },
            student: {
              select: {
                firstName: true,
                lastName: true,
                photoKey: true,
                enrollmentNumber: true,
                department: { select: { name: true, code: true } },
              },
            },
            faculty: {
              select: {
                firstName: true,
                lastName: true,
                photoKey: true,
                employeeCode: true,
                department: { select: { name: true, code: true } },
              },
            },
            adminProfile: {
              select: {
                name: true,
                department: { select: { name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: { votedAt: 'desc' },
    });

    // Fetch answer records to map which options were selected by each voter
    const answers = await this.prisma.pollAnswer.findMany({
      where: {
        pollId,
        voterId: { not: null },
      },
      include: {
        option: {
          select: { id: true, text: true },
        },
      },
    });

    // Group answers by voterId
    const answersByVoter = new Map<string, string[]>();
    for (const ans of answers) {
      if (ans.voterId) {
        const current = answersByVoter.get(ans.voterId) || [];
        current.push(ans.option.text);
        answersByVoter.set(ans.voterId, current);
      }
    }

    const voters = (participations as any[]).map((p) => {
      const u = p.user;
      const summary = this.formatUserSummary(u);
      return {
        userId: summary.id,
        name: summary.name,
        email: summary.email,
        avatar: summary.avatar,
        role: u.role?.code || 'STUDENT',
        department:
          u.student?.department?.name ||
          u.faculty?.department?.name ||
          u.adminProfile?.department?.name ||
          'Campus',
        idNumber:
          u.student?.enrollmentNumber ||
          u.faculty?.employeeCode ||
          '-',
        votedAt: p.votedAt,
        selectedOptions: answersByVoter.get(summary.id) || [],
      };
    });

    return {
      pollId: poll.id,
      question: poll.question,
      totalVoters: voters.length,
      voters,
    };
  }

  /**
   * Delete poll (soft delete)
   */
  async deletePoll(userId: string, pollId: string) {
    const ctx = await this.getUserAcademicContext(userId);

    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll || poll.isDeleted) {
      throw new NotFoundException('Poll not found');
    }

    if (poll.creatorId !== userId && !this.isAdmin(ctx.role)) {
      throw new ForbiddenException(
        'You do not have permission to delete this poll',
      );
    }

    await this.prisma.poll.update({
      where: { id: pollId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: PollStatus.ARCHIVED,
      },
    });

    this.logger.log(`Poll ${pollId} deleted by user ${userId}`);
    return { success: true, message: 'Poll deleted successfully' };
  }

  /**
   * Lifecycle cleanup: Purge or archive polls past the 15-day retention window
   */
  async purgeExpiredPolls() {
    const now = new Date();
    const cutoffDate = new Date(
      now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const result = await this.prisma.poll.updateMany({
      where: {
        expiresAt: { lt: cutoffDate },
        status: { not: PollStatus.ARCHIVED },
      },
      data: {
        status: PollStatus.ARCHIVED,
      },
    });

    this.logger.log(`Archived ${result.count} polls older than 15 days`);
    return { archivedCount: result.count };
  }

  /**
   * Get academic targeting scopes (departments, programs, semesters)
   */
  async getAcademicScopes() {
    const key = 'polls:academic-scopes';
    const loader = async () => {
      const [departments, programs] = await Promise.all([
        this.prisma.department.findMany({
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.program.findMany({
          select: { id: true, name: true, code: true, departmentId: true },
          orderBy: { name: 'asc' },
        }),
      ]);

      return {
        departments,
        programs,
        semesters: [1, 2, 3, 4, 5, 6, 7, 8],
      };
    };

    return this.cache ? this.cache.getOrSet(key, 600, loader) : loader();
  }
}
