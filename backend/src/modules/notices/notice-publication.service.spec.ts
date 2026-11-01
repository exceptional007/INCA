import {
  NoticePublicationService,
  NOTICE_PUBLICATION_INTERVAL_MS,
} from './notice-publication.service';
import { NoticesService } from './notices.service';

describe('Scheduled notice publication', () => {
  let publisher: NoticePublicationService;
  let db: any;
  let state: { notices: any[]; audits: any[]; notifications: any[] };
  let failNotification: boolean;
  let failAudit: boolean;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-31T12:00:00Z') });
    failNotification = false;
    failAudit = false;
    state = {
      notices: [
        {
          id: 'notice',
          authorId: 'author',
          users_notices_authorIdTousers: {role: {code: 'ADMIN'}},
          title: 'Scheduled announcement',
          content: 'Notice content',
          targetScope: 'ALL',
          priority: 'NORMAL',
          status: 'SCHEDULED',
          isArchived: false,
          publishAt: new Date(Date.now() - 1000),
          expiresAt: null,
        },
      ],
      audits: [],
      notifications: [],
    };
    const escaped = () => {
      throw new Error('Publication write escaped its transaction');
    };
    db = {
      notices: {
        findMany: jest.fn(async ({ where, take }) =>
          state.notices
            .filter(
              (notice) =>
                notice.status === where.status &&
                notice.isArchived === where.isArchived &&
                notice.publishAt <= where.publishAt.lte,
            )
            .slice(0, take)
            .map((notice) => ({ id: notice.id })),
        ),
        update: jest.fn(escaped),
        updateMany: jest.fn(escaped),
      },
      user: { findMany: jest.fn(escaped) },
      notifications: { createMany: jest.fn(escaped) },
      $transaction: jest.fn(),
    };
    // Stage/commit adapter simulates rollback and serialized row updates. No live DB is used.
    let tail = Promise.resolve();
    db.$transaction.mockImplementation(async (callback) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const draft = {
        notices: state.notices.map((notice) => ({ ...notice })),
        audits: [...state.audits],
        notifications: [...state.notifications],
      };
      const tx = {
        notices: {
          updateMany: jest.fn(async ({ where, data }) => {
            const notice = draft.notices.find(
              (notice) =>
                notice.id === where.id &&
                notice.status === where.status &&
                notice.isArchived === where.isArchived &&
                notice.publishAt <= where.publishAt.lte,
            );
            if (!notice) return { count: 0 };
            Object.assign(notice, data);
            return { count: 1 };
          }),
          findUnique: jest.fn(async ({ where }) =>
            draft.notices.find((notice) => notice.id === where.id),
          ),
          update: jest.fn(async ({ where, data }) =>
            Object.assign(
              draft.notices.find((notice) => notice.id === where.id),
              data,
            ),
          ),
        },
        user: {
          findMany: jest
            .fn()
            .mockImplementation(async () => draft.notices[0].targetScope === 'DEPARTMENT'
              ? [{id: 'student', role: {code: 'STUDENT'}, student: {departmentId: 'department'}}, {id: 'faculty', role: {code: 'FACULTY'}, faculty: {departmentId: 'department'}}]
              : [{id: 'author'}, {id: 'recipient'}]),
        },
        student: {
          findMany: jest.fn().mockResolvedValue([{ userId: 'student' }]),
        },
        faculty: {
          findMany: jest.fn().mockResolvedValue([{ userId: 'faculty' }]),
        },
        notice_audit_logs: {
          create: jest.fn(async ({ data }) => {
            if (failAudit) throw new Error('Audit insert failed');
            draft.audits.push(data);
          }),
        },
        notifications: {
          createMany: jest.fn(async ({ data }) => {
            if (failNotification) throw new Error('Notification insert failed');
            draft.notifications.push(...data);
          }),
        },
      };
      try {
        const result = await callback(tx);
        state = draft;
        return result;
      } finally {
        release();
      }
    });
    publisher = new NoticePublicationService(
      db,
      new NoticesService(db, {} as any, {enrich: jest.fn().mockResolvedValue(null)} as any),
    );
  });
  afterEach(async () => {
    await publisher.onModuleDestroy();
    jest.useRealTimers();
  });

  it('publishes due notices with an audit and audience notifications atomically', async () => {
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('PUBLISHED');
    expect(state.audits).toEqual([
      expect.objectContaining({
        noticeId: 'notice',
        userId: 'author',
        action: 'PUBLISHED',
      }),
    ]);
    expect(state.notifications).toEqual([
      expect.objectContaining({
        userId: 'recipient',
        noticeId: 'notice',
        type: 'NOTICE_NEW',
      }),
    ]);
    expect(db.notifications.createMany).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it('waits until the scheduled time, including the exact due-time boundary', async () => {
    state.notices[0].publishAt = new Date(Date.now() + 60000);
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('SCHEDULED');
    expect(db.$transaction).not.toHaveBeenCalled();
    jest.setSystemTime(new Date(Date.now() + 60000));
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('PUBLISHED');
  });

  it.each(['DRAFT', 'WITHDRAWN', 'ARCHIVED', 'EXPIRED', 'PUBLISHED'])(
    'does not publish or notify for %s notices',
    async (status) => {
      state.notices[0].status = status;
      await publisher.runOnce();
      expect(state.notices[0].status).toBe(status);
      expect(state.notifications).toHaveLength(0);
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it('never publishes archived scheduled notices', async () => {
    state.notices[0].isArchived = true;
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('SCHEDULED');
    expect(state.notifications).toHaveLength(0);
  });
  it.each([0, -60000])(
    'marks already-expired notices EXPIRED without notifying (offset %s)',
    async (offset) => {
      state.notices[0].expiresAt = new Date(Date.now() + offset);
      await publisher.runOnce();
      expect(state.notices[0].status).toBe('EXPIRED');
      expect(state.notifications).toHaveLength(0);
      expect(state.audits[0].action).toBe('EXPIRED');
    },
  );
  it('rolls back publication if notification creation fails, then retries cleanly', async () => {
    failNotification = true;
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('SCHEDULED');
    expect(state.audits).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
    failNotification = false;
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('PUBLISHED');
    expect(state.audits).toHaveLength(1);
    expect(state.notifications).toHaveLength(1);
  });
  it('rolls back publication if auditing fails', async () => {
    failAudit = true;
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('SCHEDULED');
    expect(state.notifications).toHaveLength(0);
  });
  it('publishes only once across repeated checks', async () => {
    await publisher.runOnce();
    await publisher.runOnce();
    expect(state.audits).toHaveLength(1);
    expect(state.notifications).toHaveLength(1);
  });
  it('publishes only once across concurrent backend instances', async () => {
    const other = new NoticePublicationService(
      db,
      new NoticesService(db, {} as any, {enrich: jest.fn().mockResolvedValue(null)} as any),
    );
    await Promise.all([publisher.runOnce(), other.runOnce()]);
    expect(state.audits).toHaveLength(1);
    expect(state.notifications).toHaveLength(1);
    await other.onModuleDestroy();
  });
  it('does not overlap checks within the same backend instance', async () => {
    const first = publisher.runOnce();
    const second = publisher.runOnce();
    expect(first).toBe(second);
    await first;
    expect(db.notices.findMany).toHaveBeenCalledTimes(1);
  });
  it.each(['withdrawn', 'archived', 'rescheduled'])(
    'does not overwrite a notice %s after the candidate query',
    async (change) => {
      const select = db.notices.findMany.getMockImplementation();
      db.notices.findMany.mockImplementationOnce(async (args) => {
        const candidates = await select(args);
        if (change === 'withdrawn') state.notices[0].status = 'WITHDRAWN';
        if (change === 'archived') state.notices[0].isArchived = true;
        if (change === 'rescheduled')
          state.notices[0].publishAt = new Date(Date.now() + 60000);
        return candidates;
      });
      await publisher.runOnce();
      expect(state.notices[0].status).not.toBe('PUBLISHED');
      expect(state.notifications).toHaveLength(0);
    },
  );
  it('retains department targeting when delivering scheduled notices', async () => {
    state.notices[0].targetScope = 'DEPARTMENT';
    state.notices[0].departmentId = 'department';
    await publisher.runOnce();
    expect(
      state.notifications.map((notification) => notification.userId),
    ).toEqual(['student', 'faculty']);
  });
  it('runs at startup, repeats every 30 seconds, and stops on shutdown', async () => {
    publisher.onApplicationBootstrap();
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('PUBLISHED');
    expect(db.notices.findMany).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(NOTICE_PUBLICATION_INTERVAL_MS);
    expect(db.notices.findMany).toHaveBeenCalledTimes(2);
    await publisher.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(NOTICE_PUBLICATION_INTERVAL_MS * 2);
    expect(db.notices.findMany).toHaveBeenCalledTimes(2);
  });
  it('recovers on a later check after a database-read failure', async () => {
    db.notices.findMany.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('SCHEDULED');
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('PUBLISHED');
  });
  it('holds legacy unapproved faculty schedules for review instead of publishing', async () => {
    state.notices[0].users_notices_authorIdTousers = {role: {code: 'FACULTY'}};
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('PENDING_REVIEW');
    expect(state.notifications).toHaveLength(0);
    expect(state.audits[0].action).toBe('SUBMITTED_FOR_REVIEW');
  });
  it('publishes approved faculty schedules at their due time', async () => {
    Object.assign(state.notices[0], {users_notices_authorIdTousers: {role: {code: 'FACULTY'}}, approvedById: 'reviewer', approvedAt: new Date(Date.now() - 10000)});
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('PUBLISHED');
    expect(state.notifications).toHaveLength(1);
  });
  it('does not accept self-approval metadata for scheduled faculty notices', async () => {
    Object.assign(state.notices[0], {users_notices_authorIdTousers: {role: {code: 'FACULTY'}}, approvedById: 'author', approvedAt: new Date(Date.now() - 10000)});
    await publisher.runOnce();
    expect(state.notices[0].status).toBe('PENDING_REVIEW'); expect(state.notifications).toHaveLength(0);
  });

});
