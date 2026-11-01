import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NoticesService } from './notices.service';

export const NOTICE_PUBLICATION_INTERVAL_MS = 30000;

@Injectable()
export class NoticePublicationService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NoticePublicationService.name);
  private timer?: ReturnType<typeof setInterval>;
  private inFlight: Promise<void> | null = null;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notices: NoticesService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      void this.runOnce();
    }, NOTICE_PUBLICATION_INTERVAL_MS);
    this.timer.unref();
    void this.runOnce();
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }

  runOnce(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.publishDueNotices()
      .catch(() => {
        this.logger.error(
          'Scheduled notice check failed; it will retry on the next interval.',
        );
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  private async publishDueNotices() {
    const due = await this.prisma.notices.findMany({
      where: {
        status: 'SCHEDULED',
        isArchived: false,
        publishAt: { lte: new Date() },
      },
      select: { id: true },
      orderBy: { publishAt: 'asc' },
      take: 100,
    });
    for (const { id } of due) {
      if (this.stopped) break;
      try {
        await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          // Conditional UPDATE acquires a row lock. Other instances re-check the
          // status after waiting and cannot publish/notify the same notice twice.
          const claimed = await tx.notices.updateMany({
            where: {
              id,
              status: 'SCHEDULED',
              isArchived: false,
              publishAt: { lte: now },
            },
            data: { status: 'PUBLISHED', updatedAt: now },
          });
          if (claimed.count !== 1) return;
          const notice = await tx.notices.findUnique({
            where: { id },
            include: {users_notices_authorIdTousers: {select: {role: {select: {code: true}}}}},
          });
          if (!notice) throw new Error('Claimed notice no longer exists.');
          const expired = notice.expiresAt !== null && notice.expiresAt <= now;
          const authorRole = notice.users_notices_authorIdTousers?.role?.code;
          const approved = !!notice.approvedById && !!notice.approvedAt && notice.approvedById !== notice.authorId;
          if (!expired && !approved && !['ADMIN', 'SUPER_ADMIN'].includes(authorRole || '')) {
            await tx.notices.update({where: {id}, data: {status: 'PENDING_REVIEW', approvedById: null, approvedAt: null, updatedAt: now}});
            await tx.notice_audit_logs.create({data: {noticeId: id, userId: notice.authorId, action: 'SUBMITTED_FOR_REVIEW', details: 'Unapproved scheduled notice held for review.'}});
            return;
          }
          if (expired) {
            await tx.notices.update({
              where: { id },
              data: { status: 'EXPIRED', updatedAt: now },
            });
          }
          await tx.notice_audit_logs.create({
            data: {
              noticeId: id,
              userId: notice.authorId,
              action: expired ? 'EXPIRED' : 'PUBLISHED',
              details: expired
                ? 'Scheduled notice expired before publication.'
                : 'Automatically published at the scheduled time.',
            },
          });
          if (!expired) await this.notices.notifyAudience(notice, tx);
        });
      } catch {
        this.logger.error(
          `Scheduled publication failed for notice ${id}; it remains eligible for retry.`,
        );
      }
    }
  }
}
