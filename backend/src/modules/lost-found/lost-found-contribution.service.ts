import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { USER_SAFE_SELECT, formatUserName } from './lost-found.service';

export interface UserBadgeInfo {
  badge: 'Helper' | 'Top Contributor' | 'Campus Guardian' | 'Newcomer';
  points: number;
  nextTierPoints: number;
  progressPercent: number;
}

@Injectable()
export class LostFoundContributionService {
  private readonly logger = new Logger(LostFoundContributionService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Determine user badge based on total points.
   */
  getBadgeForPoints(points: number): UserBadgeInfo {
    if (points >= 100) {
      return {
        badge: 'Campus Guardian',
        points,
        nextTierPoints: 100,
        progressPercent: 100,
      };
    } else if (points >= 50) {
      return {
        badge: 'Top Contributor',
        points,
        nextTierPoints: 100,
        progressPercent: Math.min(100, Math.round(((points - 50) / 50) * 100)),
      };
    } else if (points >= 10) {
      return {
        badge: 'Helper',
        points,
        nextTierPoints: 50,
        progressPercent: Math.min(100, Math.round(((points - 10) / 40) * 100)),
      };
    }
    return {
      badge: 'Newcomer',
      points,
      nextTierPoints: 10,
      progressPercent: Math.min(100, Math.round((points / 10) * 100)),
    };
  }

  /**
   * Safely award contribution points (idempotent per user, report, and actionType).
   */
  async awardPoints(userId: string, actionType: string, points: number, reportId?: string) {
    try {
      // Find current total before adding
      const existing = reportId
        ? await this.prisma.lostFoundContribution.findUnique({
          where: {
            userId_reportId_actionType: {
              userId,
              reportId,
              actionType,
            },
          },
        })
        : null;

      if (existing) {
        return existing;
      }

      // Calculate new total points to set current badge
      const totalPointsAgg = await this.prisma.lostFoundContribution.aggregate({
        where: { userId },
        _sum: { points: true },
      });
      const newTotal = (totalPointsAgg._sum.points || 0) + points;
      const badgeInfo = this.getBadgeForPoints(newTotal);

      return await this.prisma.lostFoundContribution.create({
        data: {
          userId,
          reportId: reportId || null,
          actionType,
          points,
          badge: badgeInfo.badge,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Could not award contribution points to user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Get user contribution summary and history.
   */
  async getUserContributions(userId: string) {
    const [contributions, aggregate, userReports, verifiedHandovers] = await Promise.all([
      this.prisma.lostFoundContribution.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.lostFoundContribution.aggregate({
        where: { userId },
        _sum: { points: true },
      }),
      this.prisma.lostFoundReport.count({
        where: { reporterId: userId, type: 'FOUND' },
      }),
      this.prisma.lostFoundClaim.count({
        where: { verifiedById: userId, status: 'VERIFIED_HANDOVER' },
      }),
    ]);

    const totalPoints = aggregate._sum.points || 0;
    const badgeInfo = this.getBadgeForPoints(totalPoints);

    return {
      totalPoints,
      badge: badgeInfo.badge,
      badgeInfo,
      itemsReported: userReports,
      itemsReturned: verifiedHandovers,
      history: contributions,
    };
  }

  /**
   * Campus Leaderboard of Top Contributors.
   */
  async getLeaderboard(limit = 10) {
    const topContributors = await this.prisma.lostFoundContribution.groupBy({
      by: ['userId'],
      _sum: {
        points: true,
      },
      orderBy: {
        _sum: {
          points: 'desc',
        },
      },
      take: limit,
    });

    if (topContributors.length === 0) {
      return [];
    }

    const userIds = topContributors.map((c) => c.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: USER_SAFE_SELECT,
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return topContributors.map((entry, index) => {
      const user = userMap.get(entry.userId) as any;
      const points = entry._sum.points || 0;
      const badgeInfo = this.getBadgeForPoints(points);

      return {
        rank: index + 1,
        userId: entry.userId,
        name: formatUserName(user),
        email: user?.email,
        role: user?.role?.code || 'STUDENT',
        department:
          user?.student?.program?.code ||
          user?.faculty?.department?.code ||
          user?.student?.program?.name ||
          'Campus Community',
        points,
        badge: badgeInfo.badge,
      };
    });
  }
}