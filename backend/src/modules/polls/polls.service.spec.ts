import { Test, TestingModule } from '@nestjs/testing';
import { PollsService, RETENTION_DAYS } from './polls.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PollVotingMode, PollResultVisibility, PollStatus } from '@prisma/client';

describe('PollsService', () => {
  let service: PollsService;
  let prisma: any;

  const mockUser = {
    id: 'user-1',
    name: 'Alice Student',
    email: 'alice@campus.edu',
    role: { code: 'STUDENT', name: 'Student' },
    student: {
      id: 'student-1',
      enrollmentNumber: 'EN12345',
      departmentId: 'dept-cs',
      section: {
        semester: {
          number: 5,
          programId: 'prog-btech-cs',
        },
      },
    },
    faculty: null,
  };

  const mockAdminUser = {
    id: 'admin-1',
    name: 'Dr. Admin',
    email: 'admin@campus.edu',
    role: { code: 'ADMIN', name: 'Administrator' },
    student: null,
    faculty: {
      id: 'fac-1',
      employeeId: 'EMP001',
      departmentId: 'dept-cs',
    },
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      poll: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      pollOption: {
        createMany: jest.fn(),
        update: jest.fn(),
      },
      pollParticipation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      pollAnswer: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
      },
      department: {
        findMany: jest.fn(),
      },
      program: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
  });

  describe('createPoll', () => {
    it('should successfully create a poll with options', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const dto = {
        question: 'Should the library hours be extended?',
        options: ['Yes, 24/7', 'Until midnight', 'Keep as is'],
        votingMode: PollVotingMode.SINGLE_CHOICE,
        isAnonymous: true,
        resultVisibility: PollResultVisibility.ALWAYS_PUBLIC,
        expiresAt: futureDate,
      };

      prisma.poll.create.mockResolvedValue({ id: 'poll-1' });
      prisma.poll.findUnique.mockResolvedValue({
        id: 'poll-1',
        question: dto.question,
        options: [
          { id: 'opt-1', text: 'Yes, 24/7', voteCount: 0 },
          { id: 'opt-2', text: 'Until midnight', voteCount: 0 },
        ],
      });

      const result = await service.createPoll('user-1', dto as any);
      expect(result).toBeDefined();
      expect(prisma.poll.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            question: dto.question,
            options: {
              create: expect.arrayContaining([
                expect.objectContaining({ text: 'Yes, 24/7', displayOrder: 1 }),
              ]),
            },
          }),
        }),
      );
    });

    it('should reject past expiry dates', async () => {
      const pastDate = new Date(Date.now() - 10000).toISOString();
      await expect(
        service.createPoll('user-1', {
          question: 'Test',
          options: ['A', 'B'],
          expiresAt: pastDate,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject polls with fewer than 2 distinct options', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      await expect(
        service.createPoll('user-1', {
          question: 'Test',
          options: ['Option 1'],
          expiresAt: futureDate,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitVote', () => {
    const mockPoll = {
      id: 'poll-1',
      question: 'Campus festival theme?',
      votingMode: PollVotingMode.SINGLE_CHOICE,
      isAnonymous: true,
      targetScope: 'ALL',
      expiresAt: new Date(Date.now() + 86400000),
      isDeleted: false,
      options: [
        { id: 'opt-1', text: 'Retro 80s' },
        { id: 'opt-2', text: 'Cyberpunk' },
      ],
    };

    it('should submit vote anonymously without storing voterId in pollAnswer', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.poll.findUnique.mockResolvedValue(mockPoll);
      prisma.pollParticipation.findUnique.mockResolvedValue(null);
      prisma.poll.findFirst.mockResolvedValue({
        ...mockPoll,
        participations: [{ userId: 'user-1' }],
        _count: { participations: 1 },
      });

      await service.submitVote('user-1', 'poll-1', { optionIds: ['opt-1'] });

      // Check participation recorded
      expect(prisma.pollParticipation.create).toHaveBeenCalledWith({
        data: { pollId: 'poll-1', userId: 'user-1' },
      });

      // Crucial: for anonymous poll, voterId must strictly be null
      expect(prisma.pollAnswer.createMany).toHaveBeenCalledWith({
        data: [
          {
            pollId: 'poll-1',
            optionId: 'opt-1',
            voterId: null,
          },
        ],
      });

      // Vote count incremented
      expect(prisma.pollOption.update).toHaveBeenCalledWith({
        where: { id: 'opt-1' },
        data: { voteCount: { increment: 1 } },
      });
    });

    it('should store voterId in pollAnswer for identified polls', async () => {
      const identifiedPoll = { ...mockPoll, isAnonymous: false };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.poll.findUnique.mockResolvedValue(identifiedPoll);
      prisma.pollParticipation.findUnique.mockResolvedValue(null);
      prisma.poll.findFirst.mockResolvedValue({
        ...identifiedPoll,
        participations: [{ userId: 'user-1' }],
        _count: { participations: 1 },
      });

      await service.submitVote('user-1', 'poll-1', { optionIds: ['opt-1'] });

      expect(prisma.pollAnswer.createMany).toHaveBeenCalledWith({
        data: [
          {
            pollId: 'poll-1',
            optionId: 'opt-1',
            voterId: 'user-1',
          },
        ],
      });
    });

    it('should reject duplicate vote attempt', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.poll.findUnique.mockResolvedValue(mockPoll);
      prisma.pollParticipation.findUnique.mockResolvedValue({ id: 'part-1' });

      await expect(
        service.submitVote('user-1', 'poll-1', { optionIds: ['opt-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject voting on expired polls', async () => {
      const expiredPoll = {
        ...mockPoll,
        expiresAt: new Date(Date.now() - 5000),
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.poll.findUnique.mockResolvedValue(expiredPoll);

      await expect(
        service.submitVote('user-1', 'poll-1', { optionIds: ['opt-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject multiple options when poll is SINGLE_CHOICE', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.poll.findUnique.mockResolvedValue(mockPoll);
      prisma.pollParticipation.findUnique.mockResolvedValue(null);

      await expect(
        service.submitVote('user-1', 'poll-1', {
          optionIds: ['opt-1', 'opt-2'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVoterReport', () => {
    it('should strictly throw ForbiddenException if poll is anonymous', async () => {
      prisma.user.findUnique.mockResolvedValue(mockAdminUser);
      prisma.poll.findUnique.mockResolvedValue({
        id: 'poll-1',
        creatorId: 'admin-1',
        isAnonymous: true,
        isDeleted: false,
      });

      await expect(
        service.getVoterReport('admin-1', 'poll-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return voter list with selected options for identified poll if creator', async () => {
      prisma.user.findUnique.mockResolvedValue(mockAdminUser);
      prisma.poll.findUnique.mockResolvedValue({
        id: 'poll-1',
        question: 'Who will join the committee?',
        creatorId: 'admin-1',
        isAnonymous: false,
        isDeleted: false,
      });

      prisma.pollParticipation.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          votedAt: new Date(),
          user: {
            id: 'user-1',
            name: 'Alice Student',
            email: 'alice@campus.edu',
            role: { code: 'STUDENT' },
            student: {
              enrollmentNumber: 'EN12345',
              department: { name: 'Computer Science' },
            },
          },
        },
      ]);

      prisma.pollAnswer.findMany.mockResolvedValue([
        {
          voterId: 'user-1',
          option: { text: 'I will join' },
        },
      ]);

      const report = await service.getVoterReport('admin-1', 'poll-1');
      expect(report.totalVoters).toBe(1);
      expect(report.voters[0].name).toBe('Alice Student');
      expect(report.voters[0].selectedOptions).toContain('I will join');
    });
  });

  describe('Audience Targeting', () => {
    it('should restrict poll targeted to a different department', () => {
      const studentCtx = {
        userId: 'user-1',
        role: 'STUDENT',
        departmentId: 'dept-cs',
        programId: 'prog-btech-cs',
      };

      const civilPoll = {
        creatorId: 'other-user',
        targetScope: 'DEPARTMENT',
        departmentId: 'dept-civil',
      };

      expect(service.matchesAudience(civilPoll, studentCtx)).toBe(false);

      const csPoll = {
        creatorId: 'other-user',
        targetScope: 'DEPARTMENT',
        departmentId: 'dept-cs',
      };

      expect(service.matchesAudience(csPoll, studentCtx)).toBe(true);
    });
  });
});
