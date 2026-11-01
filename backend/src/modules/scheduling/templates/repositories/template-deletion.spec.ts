import { TemplateRepository } from './template.repository';
import { PrismaService } from '../../../../prisma/prisma.service';

describe('Template deletion preserves attendance history', () => {
  const tx = {
    $queryRaw: jest.fn(),
    attendanceSession: { findFirst: jest.fn() },
    scheduleTemplate: { delete: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    scheduleTemplate: { delete: jest.fn() },
  };
  let repository: TemplateRepository;
  beforeEach(() => {
    jest.resetAllMocks();
    tx.$queryRaw
      .mockResolvedValueOnce([{ sectionId: 'section' }])
      .mockResolvedValue([{ id: 'schedule' }]);
    tx.attendanceSession.findFirst.mockResolvedValue(null);
    tx.scheduleTemplate.delete.mockResolvedValue({ id: 'template' });
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    repository = new TemplateRepository(prisma as unknown as PrismaService);
  });
  it('deletes a template without attendance sessions inside the transaction', async () => {
    await expect(repository.remove('template', 'section')).resolves.toEqual({
      id: 'template',
    });
    expect(tx.scheduleTemplate.delete).toHaveBeenCalledWith({
      where: { id: 'template' },
    });
    expect(prisma.scheduleTemplate.delete).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    });
  });
  it('allows templates without generated schedules', async () => {
    tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ sectionId: 'section' }])
      .mockResolvedValueOnce([]);
    await repository.remove('template', 'section');
    expect(tx.scheduleTemplate.delete).toHaveBeenCalledTimes(1);
  });
  it.each(['OPEN', 'SUBMITTED', 'CLOSED'])(
    'blocks deletion for any linked %s session, even without records',
    async (status) => {
      tx.attendanceSession.findFirst.mockResolvedValue({
        id: 'session',
        status,
        records: [],
      });
      await expect(
        repository.remove('template', 'section'),
      ).rejects.toMatchObject({ status: 409 });
      expect(tx.scheduleTemplate.delete).not.toHaveBeenCalled();
      expect(tx.attendanceSession.findFirst).toHaveBeenCalledWith({
        where: { schedule: { templateId: 'template' } },
        select: { id: true },
      });
    },
  );
  it('locks the template and child schedules before checking attendance', async () => {
    await repository.remove('template', 'section');
    const [parentSql, parentId] = tx.$queryRaw.mock.calls[0];
    const [childSql, childTemplateId] = tx.$queryRaw.mock.calls[1];
    expect(parentSql.join('?')).toContain(
      'SELECT "sectionId" FROM schedule_templates WHERE id = ? FOR UPDATE',
    );
    expect(childSql.join('?')).toContain(
      'SELECT id FROM schedules WHERE "templateId" = ? ORDER BY id FOR UPDATE',
    );
    expect(parentId).toBe('template');
    expect(childTemplateId).toBe('template');
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.attendanceSession.findFirst.mock.invocationCallOrder[0],
    );
    expect(
      tx.attendanceSession.findFirst.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.scheduleTemplate.delete.mock.invocationCallOrder[0]);
  });
  it('rejects a template that disappeared since authorization', async () => {
    tx.$queryRaw.mockReset().mockResolvedValueOnce([]);
    await expect(
      repository.remove('template', 'section'),
    ).rejects.toMatchObject({ status: 404 });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.attendanceSession.findFirst).not.toHaveBeenCalled();
    expect(tx.scheduleTemplate.delete).not.toHaveBeenCalled();
  });
  it('rejects a template moved to another section since authorization', async () => {
    tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ sectionId: 'other-section' }]);
    await expect(
      repository.remove('template', 'section'),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.attendanceSession.findFirst).not.toHaveBeenCalled();
    expect(tx.scheduleTemplate.delete).not.toHaveBeenCalled();
  });
  it('never deletes if the attendance lookup fails', async () => {
    tx.attendanceSession.findFirst.mockRejectedValue(
      new Error('lookup failed'),
    );
    await expect(repository.remove('template', 'section')).rejects.toThrow(
      'lookup failed',
    );
    expect(tx.scheduleTemplate.delete).not.toHaveBeenCalled();
  });
  it('never deletes if acquiring schedule locks fails', async () => {
    tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ sectionId: 'section' }])
      .mockRejectedValueOnce(new Error('lock failed'));
    await expect(repository.remove('template', 'section')).rejects.toThrow(
      'lock failed',
    );
    expect(tx.attendanceSession.findFirst).not.toHaveBeenCalled();
    expect(tx.scheduleTemplate.delete).not.toHaveBeenCalled();
  });
});
