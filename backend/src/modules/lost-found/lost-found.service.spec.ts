import { Test, TestingModule } from '@nestjs/testing';
import { LostFoundService } from './lost-found.service';
import { LostFoundMatchingService } from './lost-found-matching.service';
import { LostFoundClaimService } from './lost-found-claim.service';
import { LostFoundContributionService } from './lost-found-contribution.service';
import { LostFoundNotificationService } from './lost-found-notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClaimStatus, LostFoundStatus, MatchStatus } from '@prisma/client';

describe('Lost & Found Module Services', () => {
  let lostFoundService: LostFoundService;
  let matchingService: LostFoundMatchingService;
  let claimService: LostFoundClaimService;
  let contributionService: LostFoundContributionService;
  let notificationService: LostFoundNotificationService;

  const mockPrisma = {
    lostFoundReport: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    lostFoundImage: {
      create: jest.fn(),
    },
    lostFoundMatch: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    lostFoundClaim: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    lostFoundContribution: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    lostFoundNotification: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  const mockStorage = {
    uploadLostFoundPhoto: jest.fn().mockResolvedValue({
      key: 'lost-found/test.jpg',
      url: 'https://r2.inca.test/lost-found/test.jpg',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LostFoundService,
        LostFoundMatchingService,
        LostFoundClaimService,
        LostFoundContributionService,
        LostFoundNotificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StrictR2StorageService, useValue: mockStorage },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'GEMINI_API_KEY') return null; // test heuristic fallback
              if (key === 'GEMINI_MODEL') return 'gemini-3.6-flash';
              return null;
            }),
          },
        },
      ],
    }).compile();

    lostFoundService = module.get<LostFoundService>(LostFoundService);
    matchingService = module.get<LostFoundMatchingService>(LostFoundMatchingService);
    claimService = module.get<LostFoundClaimService>(LostFoundClaimService);
    contributionService = module.get<LostFoundContributionService>(LostFoundContributionService);
    notificationService = module.get<LostFoundNotificationService>(LostFoundNotificationService);
  });

  describe('LostFoundService', () => {
    it('creates a lost report and invokes matching', async () => {
      const mockCreated = {
        id: 'report-1',
        type: 'LOST',
        title: 'Blue Hydro Flask',
        description: 'Lost in library 2nd floor with stickers',
        category: 'OTHER',
        location: 'Central Library',
        approximateDate: new Date(),
        reporterId: 'user-1',
        status: 'OPEN',
      };

      mockPrisma.lostFoundReport.create.mockResolvedValue(mockCreated);
      mockPrisma.lostFoundReport.findUnique.mockResolvedValue({
        ...mockCreated,
        images: [],
        reporter: { id: 'user-1', name: 'John Doe', email: 'john@inca.edu', role: 'STUDENT' },
        lostMatches: [],
        foundMatches: [],
        _count: { claims: 0 },
      });
      mockPrisma.lostFoundReport.findMany.mockResolvedValue([]);

      const result = await lostFoundService.createReport(
        'user-1',
        {
          type: 'LOST' as any,
          title: 'Blue Hydro Flask',
          description: 'Lost in library 2nd floor with stickers',
          category: 'OTHER' as any,
          location: 'Central Library',
          approximateDate: new Date().toISOString(),
        },
        [],
      );

      expect(mockPrisma.lostFoundReport.create).toHaveBeenCalled();
      expect(result.id).toBe('report-1');
      expect(result.title).toBe('Blue Hydro Flask');
    });

    it('awards 10 contribution points when a FOUND item is reported', async () => {
      const mockFound = {
        id: 'report-found-1',
        type: 'FOUND',
        title: 'Casio Scientific Calculator',
        description: 'Found on table 4 in Lab B',
        category: 'ELECTRONICS',
        location: 'Lab B',
        approximateDate: new Date(),
        reporterId: 'user-finder',
        status: 'OPEN',
      };

      mockPrisma.lostFoundReport.create.mockResolvedValue(mockFound);
      mockPrisma.lostFoundReport.findUnique.mockResolvedValue({
        ...mockFound,
        images: [],
        reporter: { id: 'user-finder', name: 'Finder Jane', email: 'jane@inca.edu', role: 'STUDENT' },
        lostMatches: [],
        foundMatches: [],
        _count: { claims: 0 },
      });
      mockPrisma.lostFoundContribution.findUnique.mockResolvedValue(null);
      mockPrisma.lostFoundContribution.aggregate.mockResolvedValue({ _sum: { points: 0 } });
      mockPrisma.lostFoundContribution.create.mockResolvedValue({ id: 'c-1', points: 10, badge: 'Helper' });

      await lostFoundService.createReport(
        'user-finder',
        {
          type: 'FOUND' as any,
          title: 'Casio Scientific Calculator',
          description: 'Found on table 4 in Lab B',
          category: 'ELECTRONICS' as any,
          location: 'Lab B',
          approximateDate: new Date().toISOString(),
        },
        [],
      );

      expect(mockPrisma.lostFoundContribution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-finder',
            points: 10,
            actionType: 'REPORT_FOUND',
          }),
        }),
      );
    });
  });

  describe('LostFoundMatchingService', () => {
    it('accurately identifies and records matches using candidate filtering & token heuristic', async () => {
      const targetLost = {
        id: 'lost-100',
        type: 'LOST',
        title: 'Black Lenovo ThinkPad Charger',
        description: '65W USB-C charger left in library reading hall',
        category: 'ELECTRONICS',
        location: 'Central Library Floor 1',
        approximateDate: new Date(),
        reporterId: 'user-loser',
        status: 'OPEN',
      };

      const candidateFound = {
        id: 'found-200',
        type: 'FOUND',
        title: 'Lenovo 65W Laptop Charger',
        description: 'Found black usb-c charger plugged in near reading desks',
        category: 'ELECTRONICS',
        location: 'Central Library',
        approximateDate: new Date(),
        reporterId: 'user-finder',
        status: 'OPEN',
      };

      mockPrisma.lostFoundReport.findUnique.mockResolvedValue({
        ...targetLost,
        images: [],
      });
      mockPrisma.lostFoundReport.findMany.mockResolvedValue([candidateFound]);
      mockPrisma.lostFoundMatch.upsert.mockResolvedValue({
        id: 'match-1',
        lostReportId: 'lost-100',
        foundReportId: 'found-200',
        matchingScore: 78,
      });

      const matchCount = await matchingService.findAndCreateMatchesForReport('lost-100');

      expect(matchCount).toBe(1);
      expect(mockPrisma.lostFoundMatch.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            lostReportId_foundReportId: {
              lostReportId: 'lost-100',
              foundReportId: 'found-200',
            },
          },
        }),
      );
      // Both users should be notified of the potential match
      expect(mockPrisma.lostFoundNotification.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('LostFoundClaimService & 6-Digit OTP Handover', () => {
    it('creates an ownership claim with a 6-digit OTP code and sets report to CLAIM_PENDING', async () => {
      mockPrisma.lostFoundReport.findUnique.mockResolvedValue({
        id: 'found-1',
        title: 'Found Keys with Red Lanyard',
        reporterId: 'user-finder',
        status: 'OPEN',
        reporter: { id: 'user-finder' },
      });
      mockPrisma.lostFoundClaim.findFirst.mockResolvedValue(null);
      mockPrisma.lostFoundClaim.create.mockImplementation(({ data }) => ({
        id: 'claim-1',
        ...data,
        claimant: { id: 'user-claimant', name: 'Claimant Sam', email: 'sam@inca.edu', role: 'STUDENT' },
      }));

      const claim = await claimService.submitClaim('user-claimant', 'found-1', {
        claimDetails: 'It has three brass keys and a Honda motorcycle key fob.',
      });

      expect(claim).toBeDefined();
      expect(claim.verificationCode).toHaveLength(6);
      expect(mockPrisma.lostFoundReport.update).toHaveBeenCalledWith({
        where: { id: 'found-1' },
        data: { status: LostFoundStatus.CLAIM_PENDING },
      });
      // Finder receives notification
      expect(mockPrisma.lostFoundNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-finder',
            title: 'New Claim Submitted',
          }),
        }),
      );
    });

    it('rejects handover verification if 6-digit OTP is incorrect', async () => {
      mockPrisma.lostFoundClaim.findUnique.mockResolvedValue({
        id: 'claim-1',
        verificationCode: '654321',
        status: 'APPROVED',
        report: { id: 'found-1', reporterId: 'user-finder', title: 'Found Keys' },
        claimant: { id: 'user-claimant', name: 'Claimant Sam', email: 'sam@inca.edu' },
      });

      await expect(
        claimService.verifyClaimHandover('user-finder', ['STUDENT'], 'claim-1', {
          verificationCode: '999999', // Incorrect OTP
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('completes verified handover on matching OTP, marks report HANDED_OVER, and awards 20 points', async () => {
      mockPrisma.lostFoundClaim.findUnique.mockResolvedValue({
        id: 'claim-1',
        verificationCode: '654321',
        status: 'APPROVED',
        reportId: 'found-1',
        claimantId: 'user-claimant',
        report: { id: 'found-1', reporterId: 'user-finder', title: 'Found Keys' },
        claimant: { id: 'user-claimant', name: 'Claimant Sam', email: 'sam@inca.edu' },
      });
      mockPrisma.lostFoundClaim.update.mockResolvedValue({
        id: 'claim-1',
        status: ClaimStatus.VERIFIED_HANDOVER,
      });
      mockPrisma.lostFoundContribution.findUnique.mockResolvedValue(null);
      mockPrisma.lostFoundContribution.aggregate.mockResolvedValue({ _sum: { points: 10 } });
      mockPrisma.lostFoundContribution.create.mockResolvedValue({ id: 'c-2', points: 20 });

      const result = await claimService.verifyClaimHandover('user-finder', ['STUDENT'], 'claim-1', {
        verificationCode: '654321',
      });

      expect(result.status).toBe(ClaimStatus.VERIFIED_HANDOVER);
      expect(mockPrisma.lostFoundReport.update).toHaveBeenCalledWith({
        where: { id: 'found-1' },
        data: expect.objectContaining({
          status: LostFoundStatus.HANDED_OVER,
        }),
      });
      // Finder receives 20 points
      expect(mockPrisma.lostFoundContribution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-finder',
            actionType: 'VERIFIED_HANDOVER',
            points: 20,
          }),
        }),
      );
    });
  });

  describe('LostFoundContributionService Badge Tiers', () => {
    it('computes correct badge tiers based on points threshold', () => {
      expect(contributionService.getBadgeForPoints(0).badge).toBe('Newcomer');
      expect(contributionService.getBadgeForPoints(15).badge).toBe('Helper');
      expect(contributionService.getBadgeForPoints(60).badge).toBe('Top Contributor');
      expect(contributionService.getBadgeForPoints(120).badge).toBe('Campus Guardian');
    });
  });
});
