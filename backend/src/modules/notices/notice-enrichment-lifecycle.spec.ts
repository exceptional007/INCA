import { Prisma } from '@prisma/client';
import { NoticesService } from './notices.service';
import { NoticeStatus } from './dto/create-notice.dto';

describe('Notice AI enrichment save lifecycle', () => {
  const db = {
    $transaction: jest.fn(async (callback) => callback(db)),
    $queryRaw: jest.fn().mockResolvedValue([{id: 'notice'}]),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    notices: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    notice_audit_logs: { create: jest.fn() },
    notice_reads: { create: jest.fn() },
    notifications: { createMany: jest.fn() },
  };
  const ai = { enrich: jest.fn() };
  let service: NoticesService;
  const original = {
    id: 'notice',
    title: 'Original title',
    content: 'Original body',
    authorId: 'publisher',
    departmentId: 'department',
    status: 'DRAFT',
    priority: 'NORMAL',
    publishAt: new Date(0),
    expiresAt: null,
    updatedAt: new Date('2026-01-01'),
    aiSummary: 'Old summary',
    aiDeadlines: [{ label: 'Old', when: 'old', sourceQuote: 'old' }],
    aiActionItems: ['Old action'],
    aiKeyHighlights: ['Old highlight'],
    aiTags: ['old'],
  };
  const enriched = {
    summary: 'Generated summary',
    deadlines: [
      {
        label: 'Registration',
        when: '7 November',
        sourceQuote: 'Apply by 7 November.',
      },
    ],
    actionItems: ['Apply.'],
    keyHighlights: ['Registration open.'],
    tags: ['registration'],
  };
  beforeEach(() => {
    jest.resetAllMocks();
    db.$transaction.mockImplementation(async callback => callback(db));
    db.$queryRaw.mockResolvedValue([{id: 'notice'}]);
    db.user.findUnique.mockResolvedValue({
      id: 'publisher',
      role: { code: 'FACULTY' },
      faculty: { departmentId: 'department' },
    });
    db.user.findMany.mockResolvedValue([]);
    db.notices.findUnique.mockResolvedValue({ ...original });
    db.notices.create.mockImplementation(async ({ data }) => ({
      id: 'notice',
      ...data,
    }));
    db.notices.update.mockImplementation(async ({ data }) => ({
      ...original,
      ...data,
    }));
    db.notice_audit_logs.create.mockResolvedValue({});
    ai.enrich.mockResolvedValue(enriched);
    service = new NoticesService(db as any, {} as any, ai as any);
  });
  it('automatically generates and persists all enrichment fields on creation', async () => {
    const result = await service.createNotice('publisher', 'FACULTY', {
      title: ' Registration ',
      content: ' Apply by 7 November. ',
      status: NoticeStatus.DRAFT,
    });
    expect(ai.enrich).toHaveBeenCalledWith(
      'Registration',
      'Apply by 7 November.',
    );
    expect(result).toMatchObject({
      aiSummary: enriched.summary,
      aiDeadlines: enriched.deadlines,
      aiActionItems: enriched.actionItems,
      aiKeyHighlights: enriched.keyHighlights,
      aiTags: enriched.tags,
      status: 'DRAFT',
      authorId: 'publisher',
    });
  });
  it('keeps explicit publisher summaries while generating the remaining fields', async () => {
    const result = await service.createNotice('publisher', 'FACULTY', {
      title: 'Registration',
      content: 'Apply by 7 November.',
      aiSummary: ' Publisher summary ',
      status: NoticeStatus.DRAFT,
    });
    expect(result.aiSummary).toBe('Publisher summary');
    expect(result.aiTags).toEqual(['registration']);
  });
  it('saves without enrichment if AI is unavailable', async () => {
    ai.enrich.mockResolvedValue(null);
    const result = await service.createNotice('publisher', 'FACULTY', {
      title: 'Registration',
      content: 'Apply by 7 November.',
      status: NoticeStatus.DRAFT,
    });
    expect(result.aiSummary).toBeNull();
    expect(result.aiDeadlines).toBe(Prisma.DbNull);
    expect(db.notices.create).toHaveBeenCalledTimes(1);
  });
  it('enriches immediately published notices before using their summary for notification delivery', async () => {
    const notify = jest.spyOn(service, 'notifyAudience').mockResolvedValue(undefined);
    db.user.findUnique.mockResolvedValue({id: 'publisher', role: {code: 'ADMIN'}, adminProfile: {departmentId: 'department'}});
    await service.createNotice('publisher', 'ADMIN', {
      title: 'Registration',
      content: 'Apply by 7 November.',
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PUBLISHED',
        aiSummary: enriched.summary,
      }),
    );
  });
  it.each([{ content: 'Changed body' }, { title: 'Changed title' }])(
    'regenerates when source text changes %j',
    async (dto) => {
      const result = await service.updateNotice(
        'publisher',
        'FACULTY',
        'notice',
        dto,
      );
      expect(ai.enrich).toHaveBeenCalledWith(
        dto.title ?? original.title,
        dto.content ?? original.content,
      );
      expect(result.aiSummary).toBe(enriched.summary);
      expect(db.notices.update.mock.calls[0][0].where).toEqual({
        id: 'notice',
        updatedAt: original.updatedAt,
      });
    },
  );
  it('preserves enrichment and avoids an AI request for metadata-only changes', async () => {
    const result = await service.updateNotice(
      'publisher',
      'FACULTY',
      'notice',
      { isPinned: true },
    );
    expect(ai.enrich).not.toHaveBeenCalled();
    expect(result.aiSummary).toBe(original.aiSummary);
    expect(db.notices.update.mock.calls[0][0].data).not.toHaveProperty(
      'aiDeadlines',
    );
  });
  it('does not regenerate when unchanged source text is resubmitted', async () => {
    await service.updateNotice('publisher', 'FACULTY', 'notice', {
      title: original.title,
      content: original.content,
    });
    expect(ai.enrich).not.toHaveBeenCalled();
  });
  it('clears stale generated fields after a text edit if AI fails', async () => {
    ai.enrich.mockResolvedValue(null);
    const result = await service.updateNotice(
      'publisher',
      'FACULTY',
      'notice',
      { content: 'New body with no previous deadlines.' },
    );
    expect(result.aiSummary).toBeNull();
    for (const field of [
      'aiDeadlines',
      'aiActionItems',
      'aiKeyHighlights',
      'aiTags',
    ])
      expect(result[field]).toBe(Prisma.DbNull);
  });
  it('allows an explicit summary override on text updates', async () => {
    const result = await service.updateNotice(
      'publisher',
      'FACULTY',
      'notice',
      { content: 'New body', aiSummary: 'Manual summary' },
    );
    expect(result.aiSummary).toBe('Manual summary');
  });
  it('rejects stale AI results with a conflict if another edit won', async () => {
    db.notices.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Missing revision', {
        code: 'P2025',
        clientVersion: '6.19.3',
      }),
    );
    await expect(
      service.updateNotice('publisher', 'FACULTY', 'notice', {
        content: 'New body',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.notice_audit_logs.create).not.toHaveBeenCalled();
  });
  it('does not send unauthorized edits to the AI provider', async () => {
    await expect(
      service.updateNotice('stranger', 'FACULTY', 'notice', {
        content: 'New body',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(ai.enrich).not.toHaveBeenCalled();
    expect(db.notices.update).not.toHaveBeenCalled();
  });
  it('does not send student-created notices to the AI provider', async () => {
    await expect(
      service.createNotice('student', 'STUDENT', {
        title: 'Title',
        content: 'Body',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(ai.enrich).not.toHaveBeenCalled();
  });
  it('returns generated fields in the recipient feed and notice detail', async () => {
    const row = {
      ...original,
      status: 'PUBLISHED',
      isArchived: false,
      isPinned: false,
      category: 'ACADEMIC',
      targetScope: 'ALL',
      aiSummary: enriched.summary,
      aiDeadlines: enriched.deadlines,
      aiActionItems: enriched.actionItems,
      aiKeyHighlights: enriched.keyHighlights,
      aiTags: enriched.tags,
      notice_reads: [{ readAt: new Date(), acknowledgedAt: null }],
      notice_attachments: [],
      _count: { notice_reads: 1 },
      users_notices_authorIdTousers: {
        id: 'publisher',
        email: 'publisher@example.test',
      },
    };
    db.notices.findMany.mockResolvedValue([row]);
    db.notices.findUnique.mockResolvedValue(row);
    const feed = await service.getRecipientNotices('publisher', {});
    const detail = await service.getNoticeById('publisher', 'notice');
    for (const result of [feed.items[0], detail])
      expect(result).toMatchObject({
        aiSummary: enriched.summary,
        aiDeadlines: enriched.deadlines,
        aiActionItems: enriched.actionItems,
        aiKeyHighlights: enriched.keyHighlights,
        aiTags: enriched.tags,
      });
  });
});
