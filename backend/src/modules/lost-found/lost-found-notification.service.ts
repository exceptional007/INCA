import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LostFoundNotificationService {
  private readonly logger = new Logger(LostFoundNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    userId: string,
    title: string,
    message: string,
    metadata?: {
      reportId?: string;
      matchId?: string;
      claimId?: string;
      type?: string;
    },
  ) {
    try {
      return await this.prisma.lostFoundNotification.create({
        data: {
          userId,
          title,
          message,
          reportId: metadata?.reportId,
          matchId: metadata?.matchId,
          claimId: metadata?.claimId,
          type: metadata?.type || 'MATCH_FOUND',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create lost/found notification for user ${userId}:`, error);
      return null;
    }
  }

  async getUserNotifications(userId: string, unreadOnly = false) {
    return this.prisma.lostFoundNotification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.lostFoundNotification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.lostFoundNotification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.lostFoundNotification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }
}

