import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MarketplaceChatService } from './marketplace-chat.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MarketplaceChatService', () => {
  let service: MarketplaceChatService;
  let prisma: any;

  const mockListing = {
    id: 'listing-123',
    sellerId: 'seller-456',
    title: 'Data Structures Textbook',
    price: 450,
    status: 'ACTIVE',
    visibility: 'ALL',
  };

  const mockBuyer = {
    id: 'buyer-789',
    email: 'buyer@campus.edu',
    student: { firstName: 'Alice', lastName: 'Smith', photoKey: null },
    faculty: null,
    adminProfile: null,
  };

  const mockSeller = {
    id: 'seller-456',
    email: 'seller@campus.edu',
    student: null,
    faculty: null,
    adminProfile: { name: 'Admin John' },
  };

  const mockConv = {
    id: 'conv-abc',
    listingId: 'listing-123',
    buyerId: 'buyer-789',
    sellerId: 'seller-456',
    listing: mockListing,
    buyer: mockBuyer,
    seller: mockSeller,
  };

  beforeEach(async () => {
    prisma = {
      marketplaceListing: {
        findUnique: jest.fn(),
      },
      marketplaceConversation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      marketplaceMessage: {
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
      },
      marketplaceOffer: {
        findFirst: jest.fn(),
      },
      marketplaceTransaction: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceChatService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MarketplaceChatService>(MarketplaceChatService);
  });

  describe('getOrCreateConversation', () => {
    it('should throw NotFoundException if listing does not exist', async () => {
      prisma.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrCreateConversation('buyer-789', 'STUDENT', 'listing-none'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if seller tries to chat on own listing', async () => {
      prisma.marketplaceListing.findUnique.mockResolvedValue(mockListing);

      await expect(
        service.getOrCreateConversation('seller-456', 'STUDENT', 'listing-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing conversation with otherParty attached', async () => {
      prisma.marketplaceListing.findUnique.mockResolvedValue(mockListing);
      prisma.marketplaceConversation.findFirst.mockResolvedValue(mockConv);

      const result = await service.getOrCreateConversation('buyer-789', 'STUDENT', 'listing-123');
      expect(result.id).toBe('conv-abc');
      expect(result.otherParty).toEqual(mockSeller);
      expect((result.otherParty as any).adminProfile.name).toBe('Admin John');
    });

    it('should create conversation if none exists and attach otherParty', async () => {
      prisma.marketplaceListing.findUnique.mockResolvedValue(mockListing);
      prisma.marketplaceConversation.findFirst.mockResolvedValue(null);
      prisma.marketplaceConversation.create.mockResolvedValue(mockConv);

      const result = await service.getOrCreateConversation('buyer-789', 'STUDENT', 'listing-123');
      expect(prisma.marketplaceConversation.create).toHaveBeenCalled();
      expect(result.id).toBe('conv-abc');
      expect(result.otherParty).toEqual(mockSeller);
    });

    it('should recover gracefully when concurrent creation causes P2002 conflict', async () => {
      prisma.marketplaceListing.findUnique.mockResolvedValue(mockListing);
      prisma.marketplaceConversation.findFirst.mockResolvedValue(null);
      const p2002Err: any = new Error('Unique constraint failed');
      p2002Err.code = 'P2002';
      prisma.marketplaceConversation.create.mockRejectedValue(p2002Err);
      prisma.marketplaceConversation.findUnique.mockResolvedValue(mockConv);

      const result = await service.getOrCreateConversation('buyer-789', 'STUDENT', 'listing-123');
      expect(prisma.marketplaceConversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { listingId_buyerId: { listingId: 'listing-123', buyerId: 'buyer-789' } },
        }),
      );
      expect(result.id).toBe('conv-abc');
      expect(result.otherParty).toEqual(mockSeller);
    });
  });

  describe('getConversationMessages', () => {
    it('should throw ForbiddenException if requester is not a participant', async () => {
      prisma.marketplaceConversation.findUnique.mockResolvedValue(mockConv);

      await expect(
        service.getConversationMessages('stranger-999', 'conv-abc'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return conversation with otherParty and messages', async () => {
      prisma.marketplaceConversation.findUnique.mockResolvedValue(mockConv);
      prisma.marketplaceMessage.findMany.mockResolvedValue([
        { id: 'msg-1', content: 'Hi there', senderId: 'buyer-789', createdAt: new Date() },
      ]);
      prisma.marketplaceMessage.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.getConversationMessages('buyer-789', 'conv-abc');
      expect(result.conversation.otherParty).toEqual(mockSeller);
      expect(result.messages).toHaveLength(1);
    });
  });

  describe('saveMessage', () => {
    it('should throw BadRequestException if conversationId is missing', async () => {
      await expect(
        service.saveMessage('buyer-789', { content: 'Hello' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user is not authorized', async () => {
      prisma.marketplaceConversation.findUnique.mockResolvedValue(mockConv);

      await expect(
        service.saveMessage('stranger-999', { conversationId: 'conv-abc', content: 'Hello' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should save message and return recipientId for buyer sending to seller', async () => {
      prisma.marketplaceConversation.findUnique.mockResolvedValue(mockConv);
      const createdMsg = {
        id: 'msg-100',
        conversationId: 'conv-abc',
        senderId: 'buyer-789',
        content: 'Is this still available?',
      };
      prisma.marketplaceMessage.create.mockResolvedValue(createdMsg);
      prisma.marketplaceConversation.update.mockResolvedValue(mockConv);

      const result = await service.saveMessage('buyer-789', {
        conversationId: 'conv-abc',
        content: 'Is this still available?',
      });

      expect(result.recipientId).toBe('seller-456');
      expect(result.message).toEqual(createdMsg);
    });
  });
});

