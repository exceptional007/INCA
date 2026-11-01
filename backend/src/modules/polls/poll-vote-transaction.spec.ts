import { BadRequestException } from '@nestjs/common';
import { PollVotingMode, Prisma } from '@prisma/client';
import { PollsService } from './polls.service';

describe('Atomic poll voting', () => {
  let service: PollsService;
  let prisma: any;
  let failureStage: string | undefined;
  let state: {
    participants: Set<string>;
    answers: Array<{
      pollId: string;
      optionId: string;
      voterId: string | null;
    }>;
    counts: Record<string, number>;
  };
  let poll: any;
  let counterOrder: string[];

  beforeEach(() => {
    failureStage = undefined;
    counterOrder = [];
    state = {
      participants: new Set(),
      answers: [],
      counts: { 'option-a': 0, 'option-b': 0 },
    };
    poll = {
      id: 'poll',
      creatorId: 'creator',
      targetScope: 'ALL',
      isDeleted: false,
      expiresAt: new Date(Date.now() + 60000),
      isAnonymous: true,
      votingMode: PollVotingMode.MULTIPLE_CHOICE,
      options: [{ id: 'option-a' }, { id: 'option-b' }],
    };
    const escapedWrite = () => {
      throw new Error('Vote write escaped the transaction');
    };
    prisma = {
      poll: { findUnique: jest.fn(async () => poll) },
      pollParticipation: {
        findUnique: jest.fn(async ({ where }) =>
          state.participants.has(where.pollId_userId.userId)
            ? { id: 'existing' }
            : null,
        ),
        create: jest.fn(escapedWrite),
      },
      pollAnswer: { createMany: jest.fn(escapedWrite) },
      pollOption: { update: jest.fn(escapedWrite) },
      $transaction: jest.fn(),
    };

    // Isolated transaction adapter: stage changes, commit only on success, and
    // serialize commits so concurrent requests encounter the unique constraint.
    // No real database, app startup, migrations or production data are involved.
    let tail = Promise.resolve();
    prisma.$transaction.mockImplementation(async (callback) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const draft = {
        participants: new Set(state.participants),
        answers: [...state.answers],
        counts: { ...state.counts },
      };
      const tx = {
        pollParticipation: {
          create: jest.fn(async ({ data }) => {
            if (draft.participants.has(data.userId)) {
              throw new Prisma.PrismaClientKnownRequestError(
                'Duplicate participation',
                { code: 'P2002', clientVersion: '6.19.3' },
              );
            }
            if (failureStage === 'participation')
              throw new Error('Participation insert failed');
            draft.participants.add(data.userId);
          }),
        },
        pollAnswer: {
          createMany: jest.fn(async ({ data }) => {
            if (failureStage === 'answers')
              throw new Error('Answer insert failed');
            draft.answers.push(...data);
          }),
        },
        pollOption: {
          update: jest.fn(async ({ where }) => {
            counterOrder.push(where.id);
            if (failureStage === where.id)
              throw new Error('Counter update failed');
            draft.counts[where.id]++;
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

    service = new PollsService(prisma);
    jest
      .spyOn(service, 'getUserAcademicContext')
      .mockImplementation(async (userId) => ({
        userId,
        role: 'STUDENT',
        departmentId: null,
        programId: null,
        semesterNumber: null,
        batch: null,
        user: {} as any,
      }));
    jest
      .spyOn(service, 'getPollById')
      .mockImplementation(async () => ({ counts: { ...state.counts } }) as any);
  });

  it.each(['participation', 'answers', 'option-a', 'option-b'])(
    'rolls back the complete vote when %s fails',
    async (stage) => {
      failureStage = stage;
      await expect(
        service.submitVote('voter', 'poll', {
          optionIds: ['option-b', 'option-a'],
        }),
      ).rejects.toThrow();
      expect(state).toEqual({
        participants: new Set(),
        answers: [],
        counts: { 'option-a': 0, 'option-b': 0 },
      });
      expect(service.getPollById).not.toHaveBeenCalled();
    },
  );

  it('allows retry after a rolled-back counter failure', async () => {
    failureStage = 'option-b';
    await expect(
      service.submitVote('voter', 'poll', {
        optionIds: ['option-a', 'option-b'],
      }),
    ).rejects.toThrow();
    failureStage = undefined;
    await service.submitVote('voter', 'poll', {
      optionIds: ['option-a', 'option-b'],
    });
    expect(state.participants.size).toBe(1);
    expect(state.answers).toHaveLength(2);
    expect(state.counts).toEqual({ 'option-a': 1, 'option-b': 1 });
  });

  it('records anonymous multi-choice answers once per distinct option', async () => {
    await service.submitVote('voter', 'poll', {
      optionIds: ['option-b', 'option-a', 'option-b'],
    });
    expect(state.answers).toEqual([
      { pollId: 'poll', optionId: 'option-b', voterId: null },
      { pollId: 'poll', optionId: 'option-a', voterId: null },
    ]);
    expect(state.counts).toEqual({ 'option-a': 1, 'option-b': 1 });
    expect(counterOrder).toEqual(['option-a', 'option-b']);
    expect(prisma.pollParticipation.create).not.toHaveBeenCalled();
    expect(prisma.pollAnswer.createMany).not.toHaveBeenCalled();
    expect(prisma.pollOption.update).not.toHaveBeenCalled();
  });

  it('preserves voter IDs for identified single-choice polls', async () => {
    poll.isAnonymous = false;
    poll.votingMode = PollVotingMode.SINGLE_CHOICE;
    await service.submitVote('voter', 'poll', { optionIds: ['option-a'] });
    expect(state.answers).toEqual([
      { pollId: 'poll', optionId: 'option-a', voterId: 'voter' },
    ]);
  });

  it('accepts only one concurrent vote from the same user', async () => {
    const results = await Promise.allSettled([
      service.submitVote('voter', 'poll', { optionIds: ['option-a'] }),
      service.submitVote('voter', 'poll', { optionIds: ['option-b'] }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BadRequestException);
    expect(rejected.reason.message).toBe('You have already voted in this poll');
    expect(state.participants.size).toBe(1);
    expect(state.answers).toHaveLength(1);
    expect(state.counts['option-a'] + state.counts['option-b']).toBe(1);
  });

  it('retains increments from distinct concurrent voters', async () => {
    await Promise.all([
      service.submitVote('voter-a', 'poll', {
        optionIds: ['option-a', 'option-b'],
      }),
      service.submitVote('voter-b', 'poll', {
        optionIds: ['option-b', 'option-a'],
      }),
    ]);
    expect(state.participants.size).toBe(2);
    expect(state.answers).toHaveLength(4);
    expect(state.counts).toEqual({ 'option-a': 2, 'option-b': 2 });
  });

  it.each([{ optionIds: [] }, { optionIds: ['unknown-option'] }])(
    'rejects invalid selections %j without starting a transaction',
    async ({ optionIds }) => {
      await expect(
        service.submitVote('voter', 'poll', { optionIds }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
