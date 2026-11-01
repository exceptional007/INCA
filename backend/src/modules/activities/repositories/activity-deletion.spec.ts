import { ConflictException } from '@nestjs/common';
import { ActivityRepository } from './activity.repository';
import { PrismaService } from '../../../prisma/prisma.service';

describe('Activity deletion preserves attendance history', () => {
  const tx = {
    $queryRaw: jest.fn(),
    attendanceSession: { findFirst: jest.fn() },
    activity: { delete: jest.fn() },
  };
  const prisma = { $transaction: jest.fn(), activity: { delete: jest.fn() } };
  let repository: ActivityRepository;
  beforeEach(() => {
    jest.resetAllMocks();
    tx.$queryRaw.mockResolvedValue([{ facultyId: 'faculty' }]);
    tx.attendanceSession.findFirst.mockResolvedValue(null);
    tx.activity.delete.mockResolvedValue({ id: 'activity' });
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    repository = new ActivityRepository(prisma as unknown as PrismaService);
  });
  it('deletes activities without attendance sessions inside the transaction', async () => {
    await expect(repository.remove('activity', 'faculty')).resolves.toEqual({
      id: 'activity',
    });
    expect(tx.activity.delete).toHaveBeenCalledWith({
      where: { id: 'activity' },
    });
    expect(prisma.activity.delete).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it.each(['OPEN', 'SUBMITTED', 'CLOSED'])(
    'blocks deletion for a %s session even without records',
    async (status) => {
      tx.attendanceSession.findFirst.mockResolvedValue({
        id: 'session',
        status,
        records: [],
      });
      await expect(
        repository.remove('activity', 'faculty'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.activity.delete).not.toHaveBeenCalled();
      expect(tx.attendanceSession.findFirst).toHaveBeenCalledWith({
        where: { activityId: 'activity' },
        select: { id: true },
      });
    },
  );
  it('locks the parent before checking sessions or deleting', async () => {
    await repository.remove('activity', 'faculty');
    const [sql, parameter] = tx.$queryRaw.mock.calls[0];
    expect(sql.join('?')).toContain(
      'SELECT "facultyId" FROM activities WHERE id = ? FOR UPDATE',
    );
    expect(parameter).toBe('activity');
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.attendanceSession.findFirst.mock.invocationCallOrder[0],
    );
    expect(
      tx.attendanceSession.findFirst.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.activity.delete.mock.invocationCallOrder[0]);
  });
  it('returns 404 when the activity disappeared after authorization', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(
      repository.remove('activity', 'faculty'),
    ).rejects.toMatchObject({ status: 404 });
    expect(tx.attendanceSession.findFirst).not.toHaveBeenCalled();
    expect(tx.activity.delete).not.toHaveBeenCalled();
  });
  it('blocks deletion if the organiser changed after authorization', async () => {
    tx.$queryRaw.mockResolvedValue([{ facultyId: 'another-faculty' }]);
    await expect(
      repository.remove('activity', 'faculty'),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.attendanceSession.findFirst).not.toHaveBeenCalled();
    expect(tx.activity.delete).not.toHaveBeenCalled();
  });
  it('does not delete if the attendance check fails', async () => {
    tx.attendanceSession.findFirst.mockRejectedValue(new Error('query failed'));
    await expect(repository.remove('activity', 'faculty')).rejects.toThrow(
      'query failed',
    );
    expect(tx.activity.delete).not.toHaveBeenCalled();
  });
});
