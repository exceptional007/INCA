import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceTransactionService } from './marketplace-transaction.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionStatus, ListingStatus, ListingVisibility, OfferStatus } from '@prisma/client';

describe('MarketplaceTransactionService - End-to-End Workflow Spec', () => {
  let service: MarketplaceTransactionService;

  const mockPrisma = {
    marketplaceListing: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    marketplaceOffer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    marketplaceTransaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    marketplaceConversation: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    marketplaceMessage: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callbackOrPromises) => {
      if (typeof callbackOrPromises === 'function') {
        return callbackOrPromises(mockPrisma);
      }
      return Promise.all(callbackOrPromises);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceTransactionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MarketplaceTransactionService>(MarketplaceTransactionService);
  });

  describe('initiateTransaction', () => {
    it('should throw NotFoundException if listing does not exist', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(
        service.initiateTransaction('buyer-1', 'STUDENT', { listingId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if seller tries to buy their own listing', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'user-self',
        status: ListingStatus.ACTIVE,
      });

      await expect(
        service.initiateTransaction('user-self', 'STUDENT', { listingId: 'list-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if listing is already SOLD, REMOVED or ARCHIVED', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'seller-1',
        status: ListingStatus.SOLD,
      });

      await expect(
        service.initiateTransaction('buyer-1', 'STUDENT', { listingId: 'list-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should bind agreedPrice to accepted offer amount if offerId is supplied', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'seller-1',
        price: 1000,
        status: ListingStatus.ACTIVE,
        preferredLocation: 'Main Gate',
      });
      mockPrisma.marketplaceOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        buyerId: 'buyer-1',
        amount: 800,
        status: OfferStatus.ACCEPTED,
      });
      mockPrisma.marketplaceTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.marketplaceTransaction.create.mockImplementation((args) => Promise.resolve({
        id: 'tx-1',
        buyerId: 'buyer-1',
        ...args.data,
      }));
      mockPrisma.marketplaceListing.update.mockResolvedValue({});

      const tx = await service.initiateTransaction('buyer-1', 'STUDENT', {
        listingId: 'list-1',
        offerId: 'offer-1',
      });

      expect(tx.agreedPrice).toBe(800);
      expect(tx.status).toBe(TransactionStatus.PRICE_AGREED);
      expect(tx.handoverOtp).toBeNull();
    });

    it('should generate 6-digit OTP with leading zeroes and set HANDOVER_PENDING when schedule is provided', async () => {
      mockPrisma.marketplaceListing.findUnique.mockResolvedValue({
        id: 'list-1',
        sellerId: 'seller-1',
        price: 500,
        status: ListingStatus.ACTIVE,
      });
      mockPrisma.marketplaceTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.marketplaceTransaction.create.mockImplementation((args) => Promise.resolve({
        id: 'tx-1',
        buyerId: 'buyer-1',
        ...args.data,
      }));
      mockPrisma.marketplaceListing.update.mockResolvedValue({});

      const tx = await service.initiateTransaction('buyer-1', 'STUDENT', {
        listingId: 'list-1',
        location: 'Library Quad',
        date: '2026-11-01',
        time: '11:00',
      });

      expect(tx.status).toBe(TransactionStatus.HANDOVER_PENDING);
      expect(tx.handoverOtp).toMatch(/^\d{6}$/);
      expect(tx.handoverLocation).toBe('Library Quad');
      expect(tx.handoverDate).toBe('2026-11-01');
      expect(tx.handoverTime).toBe('11:00');
    });
  });

  describe('confirmSchedule', () => {
    it('should throw ForbiddenException if user is not buyer or seller', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.PRICE_AGREED,
      });

      await expect(
        service.confirmSchedule('random-intruder', 'tx-1', {
          location: 'Canteen',
          date: '2026-11-01',
          time: '15:00',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update buyer confirmation and keep status PRICE_AGREED if seller has not confirmed', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.PRICE_AGREED,
        handoverLocation: 'Canteen',
        handoverDate: '2026-11-01',
        handoverTime: '15:00',
        buyerConfirmed: false,
        sellerConfirmed: false,
        handoverOtp: null,
      });

      mockPrisma.marketplaceTransaction.update.mockImplementation((args) => Promise.resolve({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        ...args.data,
      }));

      const res = await service.confirmSchedule('buyer-1', 'tx-1', {
        location: 'Canteen',
        date: '2026-11-01',
        time: '15:00',
      });

      expect(res.buyerConfirmed).toBe(true);
      expect(res.sellerConfirmed).toBe(false);
      expect(res.status).toBe(TransactionStatus.PRICE_AGREED);
      expect(res.handoverOtp).toBeNull();
    });

    it('should transition to HANDOVER_PENDING and generate 6-digit OTP when both parties confirm meeting arrangement', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.PRICE_AGREED,
        handoverLocation: 'Library Front Gate',
        handoverDate: '2026-11-02',
        handoverTime: '16:00',
        buyerConfirmed: true,
        sellerConfirmed: false,
        handoverOtp: null,
      });

      mockPrisma.marketplaceTransaction.update.mockImplementation((args) => Promise.resolve({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        ...args.data,
      }));

      const res = await service.confirmSchedule('seller-1', 'tx-1', {
        location: 'Library Front Gate',
        date: '2026-11-02',
        time: '16:00',
      });

      expect(res.status).toBe(TransactionStatus.HANDOVER_PENDING);
      expect(res.buyerConfirmed).toBe(true);
      expect(res.sellerConfirmed).toBe(true);
      // Ensure caller is seller, so handoverOtp is masked
      expect(res.handoverOtp).toBeUndefined();
    });
  });

  describe('verifyHandover', () => {
    it('should throw ForbiddenException if buyer tries to verify the OTP', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.HANDOVER_PENDING,
        handoverOtp: '123456',
      });

      await expect(
        service.verifyHandover('buyer-1', 'tx-1', { otp: '123456' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should increment handoverOtpAttempts on incorrect OTP', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.HANDOVER_PENDING,
        handoverOtp: '123456',
        handoverOtpAttempts: 2,
        handoverOtpExpiresAt: new Date(Date.now() + 1000000),
        listing: { id: 'list-1', status: ListingStatus.RESERVED },
      });

      mockPrisma.marketplaceTransaction.update.mockResolvedValue({});

      await expect(
        service.verifyHandover('seller-1', 'tx-1', { otp: '000000' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.marketplaceTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tx-1' },
          data: { handoverOtpAttempts: { increment: 1 } },
        }),
      );
    });

    it('should block verification and require regeneration if attempts reach 5', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.HANDOVER_PENDING,
        handoverOtp: '123456',
        handoverOtpAttempts: 5,
        handoverOtpExpiresAt: new Date(Date.now() + 1000000),
        listing: { id: 'list-1', status: ListingStatus.RESERVED },
      });

      await expect(
        service.verifyHandover('seller-1', 'tx-1', { otp: '123456' }),
      ).rejects.toThrow('Too many failed OTP attempts');
    });

    it('should throw BadRequestException if OTP has expired', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.HANDOVER_PENDING,
        handoverOtp: '123456',
        handoverOtpAttempts: 0,
        handoverOtpExpiresAt: new Date(Date.now() - 1000), // Expired in past
        listing: { id: 'list-1', status: ListingStatus.RESERVED },
      });

      await expect(
        service.verifyHandover('seller-1', 'tx-1', { otp: '123456' }),
      ).rejects.toThrow('Handover OTP has expired');
    });

    it('should atomically mark transaction COMPLETED, listing SOLD, invalidate OTP, and cancel pending offers', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        listingId: 'list-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.HANDOVER_PENDING,
        handoverOtp: '987654',
        handoverOtpAttempts: 1,
        handoverOtpExpiresAt: new Date(Date.now() + 1000000),
        listing: { id: 'list-1', status: ListingStatus.RESERVED },
      });

      mockPrisma.marketplaceTransaction.update.mockResolvedValue({
        id: 'tx-1',
        listingId: 'list-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.COMPLETED,
        completedAt: new Date(),
        handoverOtp: null,
      });

      mockPrisma.marketplaceListing.update.mockResolvedValue({
        id: 'list-1',
        status: ListingStatus.SOLD,
      });

      mockPrisma.marketplaceOffer.updateMany.mockResolvedValue({ count: 2 });

      const res = await service.verifyHandover('seller-1', 'tx-1', { otp: '987654' });

      expect(res.success).toBe(true);
      expect(res.transaction.status).toBe(TransactionStatus.COMPLETED);

      // Verify listing status marked as SOLD
      expect(mockPrisma.marketplaceListing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'list-1' },
          data: expect.objectContaining({ status: ListingStatus.SOLD }),
        }),
      );

      // Verify other pending offers are cancelled
      expect(mockPrisma.marketplaceOffer.updateMany).toHaveBeenCalledWith({
        where: {
          listingId: 'list-1',
          status: OfferStatus.PENDING,
        },
        data: { status: OfferStatus.CANCELLED },
      });
    });

    it('should return idempotent success if transaction was already COMPLETED', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.COMPLETED,
      });

      const res = await service.verifyHandover('seller-1', 'tx-1', { otp: '123456' });
      expect(res.success).toBe(true);
      expect(res.message).toBe('Transaction has already been completed');
    });
  });

  describe('regenerateOtp', () => {
    it('should throw ForbiddenException if anyone other than the buyer attempts regeneration', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.HANDOVER_PENDING,
      });

      await expect(
        service.regenerateOtp('seller-1', 'tx-1'),
      ).rejects.toThrow('Only the buyer can regenerate the handover OTP');
    });

    it('should generate a fresh 6-digit OTP and reset attempts to 0', async () => {
      mockPrisma.marketplaceTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: TransactionStatus.HANDOVER_PENDING,
        handoverOtpAttempts: 4,
      });

      mockPrisma.marketplaceTransaction.update.mockImplementation((args) => Promise.resolve({
        id: 'tx-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        ...args.data,
      }));

      const res = await service.regenerateOtp('buyer-1', 'tx-1');

      expect(res.handoverOtp).toMatch(/^\d{6}$/);
      expect(mockPrisma.marketplaceTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tx-1' },
          data: expect.objectContaining({
            handoverOtpAttempts: 0,
          }),
        }),
      );
    });
  });

  describe('getMyDeals - OTP masking', () => {
    it('should strictly mask handoverOtp on sales so seller cannot view buyer OTP prior to handover', async () => {
      mockPrisma.marketplaceTransaction.findMany
        .mockResolvedValueOnce([
          // purchases (caller is buyer)
          { id: 'tx-purchase', buyerId: 'user-me', handoverOtp: '123456', status: TransactionStatus.HANDOVER_PENDING },
        ])
        .mockResolvedValueOnce([
          // sales (caller is seller)
          { id: 'tx-sale', sellerId: 'user-me', buyerId: 'other-buyer', handoverOtp: '654321', status: TransactionStatus.HANDOVER_PENDING },
        ]);

      const deals = await service.getMyDeals('user-me');

      expect(deals.purchases[0].handoverOtp).toBe('123456');
      expect(deals.sales[0].handoverOtp).toBeUndefined();
    });
  });
});
