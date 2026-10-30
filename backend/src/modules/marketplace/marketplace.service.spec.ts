import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceNegotiationService } from './marketplace-negotiation.service';
import { MarketplaceTransactionService } from './marketplace-transaction.service';
import { MarketplaceReviewService } from './marketplace-review.service';
import { MarketplaceModerationService } from './marketplace-moderation.service';
import { MarketplaceChatService } from './marketplace-chat.service';
import { MarketplaceGateway } from './marketplace.gateway';
import { JwtService } from '@nestjs/jwt';
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
  let chatService: MarketplaceChatService;
  let gateway: MarketplaceGateway;

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
      groupBy: jest.fn(),
    },
    marketplaceReview: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
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
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    marketplaceMessage: {
      create: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
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
    getObject: jest.fn(),
    getObjectStream: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        MarketplaceNegotiationService,
        MarketplaceTransactionService,
        MarketplaceReviewService,
        MarketplaceModerationService,
        MarketplaceChatService,
        MarketplaceGateway,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StrictR2StorageService, useValue: mockR2Storage },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    marketplaceService = module.get<MarketplaceService>(MarketplaceService);
    negotiationService = module.get<MarketplaceNegotiationService>(MarketplaceNegotiationService);
    transactionService = module.get<MarketplaceTransactionService>(MarketplaceTransactionService);
    reviewService = module.get<MarketplaceReviewService>(MarketplaceReviewService);
    moderationService = module.get<MarketplaceModerationService>(MarketplaceModerationService);
    chatService = module.get<MarketplaceChatService>(MarketplaceChatService);
    gateway = module.get<MarketplaceGateway>(MarketplaceGateway);
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
    it('should generate a 6-digit OTP when transaction is initiated with schedule', async () => {
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
        buyerId: 'buyer-1',
        ...args.data,
      }));
      mockPrisma.marketplaceListing.update.mockResolvedValue({});

      const tx = await transactionService.initiateTransaction('buyer-1', 'STUDENT', {
        listingId: 'list-1',
        location: 'Campus Center',
        date: '2026-10-30',
        time: '14:00',
      });

      expect(tx.handoverOtp).toMatch(/^\d{6}$/);
      expect(tx.status).toBe(TransactionStatus.HANDOVER_PENDING);
    });

    it('should initiate transaction in PRICE_AGREED without premature OTP when schedule is not provided', async () => {
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
        buyerId: 'buyer-1',
        ...args.data,
      }));
      mockPrisma.marketplaceListing.update.mockResolvedValue({});

      const tx = await transactionService.initiateTransaction('buyer-1', 'STUDENT', {
        listingId: 'list-1',
      });

      expect(tx.handoverOtp).toBeNull();
      expect(tx.status).toBe(TransactionStatus.PRICE_AGREED);
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

  describe('Performance Optimizations & Batch Queries', () => {
    it('should use batch groupBy queries for seller reputation in getListings', async () => {
      mockPrisma.marketplaceListing.findMany.mockResolvedValue([
        {
          id: 'list-1',
          sellerId: 'seller-a',
          title: 'Item 1',
          price: 100,
          status: ListingStatus.ACTIVE,
          images: [{ id: 'img-1', storageKey: 'marketplace/test1.png', url: null }],
        },
        {
          id: 'list-2',
          sellerId: 'seller-b',
          title: 'Item 2',
          price: 200,
          status: ListingStatus.ACTIVE,
          images: [{ id: 'img-2', storageKey: 'marketplace/test2.png', url: null }],
        },
      ]);
      mockPrisma.marketplaceListing.count.mockResolvedValue(2);

      // Mock batch groupBy
      mockPrisma.marketplaceReview.groupBy.mockResolvedValue([
        { sellerId: 'seller-a', _avg: { rating: 4.8 }, _count: { rating: 12 } },
        { sellerId: 'seller-b', _avg: { rating: 4.0 }, _count: { rating: 5 } },
      ]);
      mockPrisma.marketplaceTransaction.groupBy.mockResolvedValue([
        { sellerId: 'seller-a', _count: { id: 10 } },
        { sellerId: 'seller-b', _count: { id: 4 } },
      ]);

      const result = await marketplaceService.getListings('user-guest', 'STUDENT', {
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.marketplaceReview.groupBy).toHaveBeenCalledWith({
        by: ['sellerId'],
        where: { sellerId: { in: ['seller-a', 'seller-b'] } },
        _avg: { rating: true },
        _count: { rating: true },
      });
      expect(mockPrisma.marketplaceTransaction.groupBy).toHaveBeenCalledWith({
        by: ['sellerId'],
        where: { sellerId: { in: ['seller-a', 'seller-b'] }, status: TransactionStatus.COMPLETED },
        _count: { id: true },
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].sellerReputation).toEqual({
        averageRating: 4.8,
        totalReviews: 12,
        completedSales: 10,
      });
      expect(result.items[0].images[0].url).toContain('/api/v1/marketplace/images/stream?key=marketplace%2Ftest1.png');
    });

    it('should use batch groupBy query for unread messages in getUserConversations', async () => {
      mockPrisma.marketplaceConversation.findMany.mockResolvedValue([
        { id: 'conv-1', buyerId: 'user-me', sellerId: 'seller-1' },
        { id: 'conv-2', buyerId: 'buyer-2', sellerId: 'user-me' },
      ]);

      mockPrisma.marketplaceMessage.groupBy.mockResolvedValue([
        { conversationId: 'conv-1', _count: { id: 3 } },
      ]);

      const convs = await chatService.getUserConversations('user-me');

      expect(mockPrisma.marketplaceMessage.groupBy).toHaveBeenCalledWith({
        by: ['conversationId'],
        where: {
          conversationId: { in: ['conv-1', 'conv-2'] },
          senderId: { not: 'user-me' },
          isRead: false,
        },
        _count: { id: true },
      });

      expect(convs).toHaveLength(2);
      expect(convs[0].unreadCount).toBe(3);
      expect(convs[1].unreadCount).toBe(0);
    });
  });

  describe('Cloudflare R2 & Image Storage Security', () => {
    it('should reject non-image file uploads with BadRequestException', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'user-seller',
        images: [],
      });

      const badFile = {
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test pdf content'),
        originalname: 'document.pdf',
      } as Express.Multer.File;

      await expect(
        marketplaceService.uploadListingImages('user-seller', 'STUDENT', 'list-1', [badFile]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files larger than 10MB with BadRequestException', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'user-seller',
        images: [],
      });

      const hugeFile = {
        mimetype: 'image/png',
        size: 11 * 1024 * 1024, // 11MB
        buffer: Buffer.alloc(100),
        originalname: 'huge.png',
      } as Express.Multer.File;

      await expect(
        marketplaceService.uploadListingImages('user-seller', 'STUDENT', 'list-1', [hugeFile]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should cleanup uploaded images if subsequent upload fails', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'user-seller',
        images: [],
      });
      mockPrisma.marketplaceImage.count = jest.fn().mockResolvedValue(0);

      mockR2Storage.uploadMarketplaceImage
        .mockResolvedValueOnce('marketplace/img1.png')
        .mockRejectedValueOnce(new Error('R2 write error'));

      const file1 = {
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('image 1'),
        originalname: '1.png',
      } as Express.Multer.File;

      const file2 = {
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('image 2'),
        originalname: '2.jpg',
      } as Express.Multer.File;

      await expect(
        marketplaceService.uploadListingImages('user-seller', 'STUDENT', 'list-1', [file1, file2]),
      ).rejects.toThrow('R2 write error');

      // Verifies cleanup occurred for file1
      expect(mockR2Storage.deleteObject).toHaveBeenCalledWith('marketplace/img1.png');
    });

    it('should stream image from R2 with correct content type', async () => {
      const mockStream = { pipe: jest.fn() } as any;
      mockR2Storage.getObjectStream.mockResolvedValue({
        body: mockStream,
        contentType: 'image/webp',
      });

      const result = await marketplaceService.streamImage('marketplace/photo.webp');
      expect(mockR2Storage.getObjectStream).toHaveBeenCalledWith('marketplace/photo.webp');
      expect(result.contentType).toBe('image/webp');
    });
  });

  describe('Real-Time Socket & Room Security', () => {
    it('should verify participant access in isUserConversationParticipant', async () => {
      mockPrisma.marketplaceConversation.findUnique.mockResolvedValue({
        id: 'conv-100',
        buyerId: 'user-buyer',
        sellerId: 'user-seller',
      });

      const isBuyer = await chatService.isUserConversationParticipant('user-buyer', 'conv-100');
      const isSeller = await chatService.isUserConversationParticipant('user-seller', 'conv-100');
      const isOutsider = await chatService.isUserConversationParticipant('user-hacker', 'conv-100');

      expect(isBuyer).toBe(true);
      expect(isSeller).toBe(true);
      expect(isOutsider).toBe(false);
    });

    it('should block non-participants from joining conversation socket rooms', async () => {
      mockPrisma.marketplaceConversation.findUnique.mockResolvedValue({
        id: 'conv-secret',
        buyerId: 'user-alice',
        sellerId: 'user-bob',
      });

      const mockSocket = {
        id: 'socket-eve',
        data: { userId: 'user-eve' },
        join: jest.fn(),
        emit: jest.fn(),
      } as any;

      const res = await gateway.handleJoinConversation(mockSocket, { conversationId: 'conv-secret' });

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(res).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('not an authorized participant'),
        }),
      );
    });

    it('should allow authorized participants to join conversation socket rooms', async () => {
      mockPrisma.marketplaceConversation.findUnique.mockResolvedValue({
        id: 'conv-secret',
        buyerId: 'user-alice',
        sellerId: 'user-bob',
      });

      const mockSocket = {
        id: 'socket-alice',
        data: { userId: 'user-alice' },
        join: jest.fn(),
        emit: jest.fn(),
      } as any;

      await gateway.handleJoinConversation(mockSocket, { conversationId: 'conv-secret' });

      expect(mockSocket.join).toHaveBeenCalledWith('conv_conv-secret');
    });
  });
});

