import { NoticesService } from './notices.service';

describe('Notice publication and audience access consistency', () => {
  const db = {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    notices: { findUnique: jest.fn() },
    notice_attachments: { findUnique: jest.fn() },
    notice_reads: { upsert: jest.fn() },
    notice_audit_logs: { create: jest.fn() },
    notifications: { createMany: jest.fn() },
  };
  const storage = { getObjectStream: jest.fn() };
  let service: NoticesService;
  const user = {
    id: 'student',
    role: { code: 'STUDENT' },
    student: {
      departmentId: 'department',
      sectionId: 'section',
      section: { semester: { number: 3, programId: 'program' } },
    },
  };
  const notice = {
    id: 'notice',
    authorId: 'author',
    targetScope: 'ALL',
    status: 'PUBLISHED',
    publishAt: new Date(0),
    expiresAt: null,
    isArchived: false,
    requiresAcknowledgement: true,
    priority: 'NORMAL',
    title: 'Notice',
    content: 'Content',
  };
  beforeEach(() => {
    jest.resetAllMocks();
    db.user.findUnique.mockResolvedValue(user);
    db.user.findMany.mockResolvedValue([]);
    db.notices.findUnique.mockResolvedValue({ ...notice });
    db.notice_attachments.findUnique.mockResolvedValue({
      noticeId: 'notice',
      fileKey: 'private.pdf',
    });
    db.notice_reads.upsert.mockResolvedValue({
      readAt: new Date(),
      acknowledgedAt: new Date(),
    });
    db.notice_audit_logs.create.mockResolvedValue({});
    db.notifications.createMany.mockResolvedValue({ count: 1 });
    storage.getObjectStream.mockResolvedValue({ stream: {} });
    service = new NoticesService(db as any, storage as any, {enrich: jest.fn().mockResolvedValue(null)} as any);
  });
  const actions = [
    {
      name: 'attachment',
      invoke: (s: NoticesService) =>
        s.streamAttachment('student', 'notice', 'attachment'),
    },
    {
      name: 'read',
      invoke: (s: NoticesService) => s.markAsRead('student', 'notice'),
    },
    {
      name: 'acknowledgement',
      invoke: (s: NoticesService) => s.acknowledgeNotice('student', 'notice'),
    },
  ];
  const unavailable = [
    { status: 'DRAFT' },
    { status: 'SCHEDULED' },
    { status: 'WITHDRAWN' },
    { status: 'EXPIRED' },
    { publishAt: new Date(Date.now() + 86400000) },
    { isArchived: true },
    { expiresAt: new Date(1) },
    { targetScope: 'DEPARTMENT', departmentId: 'other-department' },
    { targetScope: 'ALL', targetYear: 1 },
  ];
  it.each(
    actions.flatMap((action) =>
      unavailable.map((changes, index) => ({ ...action, changes, index })),
    ),
  )(
    'blocks $name for unavailable/audience mismatch case $index',
    async ({ invoke, changes }) => {
      db.notices.findUnique.mockResolvedValue({ ...notice, ...changes });
      await expect(invoke(service)).rejects.toMatchObject({ status: 403 });
      expect(storage.getObjectStream).not.toHaveBeenCalled();
      expect(db.notice_reads.upsert).not.toHaveBeenCalled();
      expect(db.notice_audit_logs.create).not.toHaveBeenCalled();
    },
  );
  it.each(actions)(
    'allows $name for a published targeted notice',
    async ({ invoke }) => {
      await invoke(service);
    },
  );
  it('keeps draft attachment previews available to the author', async () => {
    db.notices.findUnique.mockResolvedValue({
      ...notice,
      authorId: 'student',
      status: 'DRAFT',
    });
    await service.streamAttachment('student', 'notice', 'attachment');
    expect(storage.getObjectStream).toHaveBeenCalledWith('private.pdf');
  });
  it.each([1, 2, 3, 4, 5, 6, 11, 12])(
    'derives year correctly for semester %s',
    async (number) => {
      const ctx = { role: 'STUDENT', semesterNumber: number };
      expect(
        service.matchesAudience(
          { ...notice, targetYear: Math.ceil(number / 2) },
          ctx,
        ),
      ).toBe(true);
      expect(
        service.matchesAudience(
          { ...notice, targetYear: Math.ceil(number / 2) + 1 },
          ctx,
        ),
      ).toBe(false);
    },
  );
  it('rejects year-targeted access when the student semester is unknown', () => {
    expect(
      service.matchesAudience(
        { ...notice, targetYear: 2 },
        { role: 'STUDENT' },
      ),
    ).toBe(false);
  });
  it('delivers to all recipients across more than two pages without truncation', async () => {
    const users = Array.from({ length: 1007 }, (_, index) => ({
      ...user,
      id: String(index).padStart(5, '0'),
    }));
    db.user.findMany.mockImplementation(async ({ cursor, take }) => {
      const start = cursor ? users.findIndex((u) => u.id === cursor.id) + 1 : 0;
      return users.slice(start, start + take);
    });
    await service.notifyAudience(notice);
    const sent = db.notifications.createMany.mock.calls.flatMap(([args]) =>
      args.data.map((n) => n.userId),
    );
    expect(sent).toHaveLength(1007);
    expect(new Set(sent).size).toBe(1007);
    expect(db.user.findMany).toHaveBeenCalledTimes(3);
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      role: { isActive: true },
    });
  });
  const faculty = {
    id: 'faculty',
    role: { code: 'FACULTY' },
    faculty: { departmentId: 'department' },
  };
  const admin = { id: 'admin', role: { code: 'ADMIN' } };
  it.each([
    { scope: 'ALL', changes: {}, expected: ['student', 'faculty', 'admin'] },
    { scope: 'STUDENTS', changes: {}, expected: ['student'] },
    { scope: 'FACULTY', changes: {}, expected: ['faculty'] },
    {
      scope: 'DEPARTMENT',
      changes: { departmentId: 'department' },
      expected: ['student', 'faculty'],
    },
    {
      scope: 'PROGRAM',
      changes: { programId: 'program' },
      expected: ['student'],
    },
    {
      scope: 'CUSTOM',
      changes: { targetAudience: { userIds: ['faculty'] } },
      expected: ['faculty'],
    },
    {
      scope: 'ALL',
      changes: { targetYear: 1, targetAudience: { roles: ['STUDENT'] } },
      expected: [],
    },
    {
      scope: 'ALL',
      changes: {
        targetYear: 2,
        targetAudience: { roles: ['STUDENT'], sectionIds: ['section'] },
      },
      expected: ['student'],
    },
  ])(
    'delivers exactly to audience $scope $changes',
    async ({ scope, changes, expected }) => {
      db.user.findMany.mockResolvedValue([
        user,
        faculty,
        admin,
        { id: 'author', role: { code: 'ADMIN' } },
      ]);
      await service.notifyAudience({
        ...notice,
        targetScope: scope,
        ...changes,
      });
      const sent = db.notifications.createMany.mock.calls.flatMap(([args]) =>
        args.data.map((n) => n.userId),
      );
      expect(sent).toEqual(expected);
    },
  );
});
