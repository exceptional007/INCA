import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceNegotiationService } from './marketplace-negotiation.service';
import { MarketplaceTransactionService } from './marketplace-transaction.service';
import { MarketplaceReviewService } from './marketplace-review.service';
import { MarketplaceModerationService } from './marketplace-moderation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { ListingStatus, ListingVisibility, OfferStatus, TransactionStatus, ReportStatus, ReportReason } from '@prisma/client';

describe('Marketplace Services Unit Tests', () => {
  let marketplaceService: MarketplaceService;
  let negotiationService: MarketplaceNegotiationService;
  let transactionService: MarketplaceTransactionService;
  let reviewService: MarketplaceReviewService;
  let moderationService: MarketplaceModerationService;

  const mockPrisma = {
    marketplaceListing: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    marketplaceOffer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    marketplaceTransaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    marketplaceReview: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    marketplaceReport: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    marketplaceImage: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    marketplaceConversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    marketplaceMessage: {
      create: jest.fn(),
      count: jest.fn(),
    },
    faculty: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callbackOrPromises) => {
      if (typeof callbackOrPromises === 'function') {
        return callbackOrPromises(mockPrisma);
      }
      return Promise.all(callbackOrPromises);
    }),
  };

  const mockR2Storage = {
    uploadMarketplaceImage: jest.fn().mockResolvedValue('marketplace-images/test.jpg'),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        MarketplaceNegotiationService,
        MarketplaceTransactionService,
        MarketplaceReviewService,
        MarketplaceModerationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StrictR2StorageService, useValue: mockR2Storage },
      ],
    }).compile();

    marketplaceService = module.get<MarketplaceService>(MarketplaceService);
    negotiationService = module.get<MarketplaceNegotiationService>(MarketplaceNegotiationService);
    transactionService = module.get<MarketplaceTransactionService>(MarketplaceTransactionService);
    reviewService = module.get<MarketplaceReviewService>(MarketplaceReviewService);
    moderationService = module.get<MarketplaceModerationService>(MarketplaceModerationService);
    jest.clearAllMocks();
  });

  describe('Audience Visibility & Listings', () => {
    it('should force visibility to ALL when a student creates a listing with FACULTY_ONLY', async () => {
      mockPrisma.marketplaceListing.create.mockResolvedValue({
        id: 'list-1',
        title: 'Algorithms Book',
        visibility: ListingVisibility.ALL,
      });

      await marketplaceService.createListing('student-1', 'STUDENT', {
        title: 'Algorithms Book',
        description: 'CLRS 3rd Edition',
        price: 500,
        category: 'BOOKS_AND_STUDY' as any,
        condition: 'GOOD' as any,
        visibility: ListingVisibility.FACULTY_ONLY,
      });

      expect(mockPrisma.marketplaceListing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            visibility: ListingVisibility.ALL,
          }),
        }),
      );
    });

    it('should allow faculty to create a FACULTY_ONLY listing', async () => {
      mockPrisma.marketplaceListing.create.mockResolvedValue({
        id: 'list-2',
        title: 'Research Monitor',
        visibility: ListingVisibility.FACULTY_ONLY,
      });

      await marketplaceService.createListing('faculty-1', 'FACULTY', {
        title: 'Research Monitor',
        description: 'Dell 27-inch 4K',
        price: 15000,
        category: 'ELECTRONICS' as any,
        condition: 'LIKE_NEW' as any,
        visibility: ListingVisibility.FACULTY_ONLY,
      });

      expect(mockPrisma.marketplaceListing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            visibility: ListingVisibility.FACULTY_ONLY,
          }),
        }),
      );
    });

    it('should forbid students from viewing FACULTY_ONLY listings', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-faculty',
        title: 'Faculty Desk',
        visibility: ListingVisibility.FACULTY_ONLY,
        sellerId: 'faculty-1',
        status: ListingStatus.ACTIVE,
      });

      await expect(
        marketplaceService.getListingById('student-1', 'STUDENT', 'list-faculty'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Structured Negotiation (Offers)', () => {
    it('should forbid seller from making offer on their own listing', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'user-seller',
        status: ListingStatus.ACTIVE,
        visibility: ListingVisibility.ALL,
      });

      await expect(
        negotiationService.createOffer('user-seller', 'STUDENT', {
          listingId: 'list-1',
          amount: 400,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create an offer and cancel previous pending offers', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'user-seller',
        status: ListingStatus.ACTIVE,
        visibility: ListingVisibility.ALL,
      });
      mockPrisma.marketplaceOffer.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.marketplaceOffer.create.mockResolvedValue({
        id: 'offer-1',
        listingId: 'list-1',
        buyerId: 'user-buyer',
        amount: 450,
        status: OfferStatus.PENDING,
      });

      const offer = await negotiationService.createOffer('user-buyer', 'STUDENT', {
        listingId: 'list-1',
        amount: 450,
      });

      expect(mockPrisma.marketplaceOffer.updateMany).toHaveBeenCalledWith({
        where: { listingId: 'list-1', buyerId: 'user-buyer', status: OfferStatus.PENDING },
        data: { status: OfferStatus.CANCELLED },
      });
      expect(offer.amount).toBe(450);
    });
  });

  describe('Transaction Lifecycle & Handover OTP', () => {
    it('should generate a 6-digit OTP when transaction is initiated', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'seller-1',
        price: 500,
        status: ListingStatus.ACTIVE,
        visibility: ListingVisibility.ALL,
      });
      mockPrisma.marketplaceTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.marketplaceTransaction.create.mockImplementation((args) => Promise.resolve({
        id: 'tx-1',
        ...args.data,
      }));
      mockPrisma.marketplaceListing.update.mockResolvedValue({});

      const tx = await transactionService.initiateTransaction('buyer-1', 'STUDENT', {
        listingId: 'list-1',
      });

      expect(tx.handoverOtp).toMatch(/^\d{6}$/);
      expect(tx.status).toBe(TransactionStatus.HANDOVER_PENDING);
    });

    it('should reject handover verification if OTP is invalid', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        listingId: 'list-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        status: TransactionStatus.HANDOVER_PENDING,
        handoverOtp: '654321',
        handoverOtpExpiresAt: new Date(Date.now() + 100000),
        handoverOtpAttempts: 0,
        listing: { id: 'list-1', status: ListingStatus.RESERVED },
      });

      await expect(
        transactionService.verifyHandover('seller-1', 'tx-1', { otp: '000000' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.marketplaceTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { handoverOtpAttempts: { increment: 1 } },
        }),
      );
    });

    it('should atomically complete transaction and mark listing SOLD upon valid OTP verification', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        listingId: 'list-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        status: TransactionStatus.HANDOVER_PENDING,
        handoverOtp: '123456',
        handoverOtpExpiresAt: new Date(Date.now() + 100000),
        handoverOtpAttempts: 0,
        listing: { id: 'list-1', status: ListingStatus.RESERVED },
      });

      mockPrisma.marketplaceTransaction.update.mockResolvedValue({
        id: 'tx-1',
        status: TransactionStatus.COMPLETED,
        buyerConfirmed: true,
        sellerConfirmed: true,
      });
      mockPrisma.marketplaceListing.update.mockResolvedValue({
        id: 'list-1',
        status: ListingStatus.SOLD,
      });

      const res = await transactionService.verifyHandover('seller-1', 'tx-1', { otp: '123456' });

      expect(res.success).toBe(true);
      expect(res.transaction.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  describe('Verified Buyer Reviews', () => {
    it('should forbid non-buyer or non-completed transactions from leaving reviews', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        status: TransactionStatus.HANDOVER_PENDING,
        review: null,
      });

      await expect(
        reviewService.createReview('not-the-buyer', {
          transactionId: 'tx-1',
          rating: 5,
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        reviewService.createReview('buyer-1', {
          transactionId: 'tx-1',
          rating: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent duplicate reviews for the same transaction', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        status: TransactionStatus.COMPLETED,
        review: { id: 'rev-existing', rating: 5 },
      });

      await expect(
        reviewService.createReview('buyer-1', {
          transactionId: 'tx-1',
          rating: 4,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('HOD & Admin Moderation', () => {
    it('should forbid regular students from accessing moderation reports', async () => {
      await expect(
        moderationService.getReportsForModerator('student-1', 'STUDENT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow HOD to resolve reports and remove prohibited listings', async () => {
      mockPrisma.faculty.findUnique.mockResolvedValue({
        id: 'fac-1',
        departmentId: 'dept-cse',
      });
      mockPrisma.marketplaceReport.findUnique.mockResolvedValue({
        id: 'rep-1',
        departmentId: 'dept-cse',
        listingId: 'list-bad',
      });
      mockPrisma.marketplaceReport.update.mockResolvedValue({
        id: 'rep-1',
        status: ReportStatus.ACTION_TAKEN,
      });
      mockPrisma.marketplaceListing.update.mockResolvedValue({
        id: 'list-bad',
        status: ListingStatus.REMOVED,
      });

      const res = await moderationService.resolveReport('user-hod', 'HOD', 'rep-1', {
        status: ReportStatus.ACTION_TAKEN,
        resolutionNote: 'Prohibited item removed.',
        removeListing: true,
      });

      expect(mockPrisma.marketplaceListing.update).toHaveBeenCalledWith({
        where: { id: 'list-bad' },
        data: { status: ListingStatus.REMOVED },
      });
      expect(res.status).toBe(ReportStatus.ACTION_TAKEN);
    });
  });
});

