import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ListingStatus, ListingVisibility } from '@prisma/client';

@Injectable()
export class MarketplaceChatService {
  constructor(private readonly prisma: PrismaService) {}

  private isFacultyOrAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  async getOrCreateConversation(buyerId: string, userRole: string, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId === buyerId) {
      throw new BadRequestException('You cannot initiate a conversation on your own listing');
    }

    if (listing.visibility === ListingVisibility.FACULTY_ONLY && !this.isFacultyOrAdmin(userRole)) {
      throw new ForbiddenException('This listing is restricted to faculty members only');
    }

    if (listing.status === ListingStatus.REMOVED || listing.status === ListingStatus.ARCHIVED) {
      throw new BadRequestException('This listing is no longer active');
    }

    let conv = await this.prisma.marketplaceConversation.findFirst({
      where: {
        listingId,
        buyerId,
        sellerId: listing.sellerId,
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true, photoKey: true } },
            faculty: { select: { firstName: true, lastName: true, photoKey: true } },
          },
        },
        buyer: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true, photoKey: true } },
            faculty: { select: { firstName: true, lastName: true, photoKey: true } },
          },
        },
      },
    });

    if (!conv) {
      conv = await this.prisma.marketplaceConversation.create({
        data: {
          listingId,
          buyerId,
          sellerId: listing.sellerId,
        },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              status: true,
              images: { take: 1, orderBy: { sortOrder: 'asc' } },
            },
          },
          seller: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true, photoKey: true } },
              faculty: { select: { firstName: true, lastName: true, photoKey: true } },
            },
          },
          buyer: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true, photoKey: true } },
              faculty: { select: { firstName: true, lastName: true, photoKey: true } },
            },
          },
        },
      });
    }

    return conv;
  }

  async getUserConversations(userId: string) {
    const conversations = await this.prisma.marketplaceConversation.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
          },
        },
        buyer: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true, photoKey: true } },
            faculty: { select: { firstName: true, lastName: true, photoKey: true } },
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true, photoKey: true } },
            faculty: { select: { firstName: true, lastName: true, photoKey: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const conversationIds = conversations.map((c) => c.id);
    const unreadMap = new Map<string, number>();

    if (conversationIds.length > 0) {
      const unreadGroups = await this.prisma.marketplaceMessage.groupBy({
        by: ['conversationId'],
        where: {
          conversationId: { in: conversationIds },
          senderId: { not: userId },
          isRead: false,
        },
        _count: { id: true },
      });

      for (const ug of unreadGroups) {
        unreadMap.set(ug.conversationId, ug._count.id || 0);
      }
    }

    const result = conversations.map((c: any) => {
      const isUserBuyer = c.buyerId === userId;
      const otherParty = isUserBuyer ? c.seller : c.buyer;

      return {
        ...c,
        unreadCount: unreadMap.get(c.id) || 0,
        otherParty,
        lastMessage: c.messages?.[0] || null,
      };
    });

    return result;
  }

  async isUserConversationParticipant(userId: string, conversationId: string): Promise<boolean> {
    const conv = await this.prisma.marketplaceConversation.findUnique({
      where: { id: conversationId },
      select: { buyerId: true, sellerId: true },
    });
    if (!conv) return false;
    return conv.buyerId === userId || conv.sellerId === userId;
  }

  async getConversationMessages(userId: string, conversationId: string) {
    const conv = await this.prisma.marketplaceConversation.findUnique({
      where: { id: conversationId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            preferredLocation: true,
            sellerId: true,
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
          },
        },
        buyer: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    if (conv.buyerId !== userId && conv.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to access this conversation');
    }

    const messages = await this.prisma.marketplaceMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Mark messages from other user as read
    await this.prisma.marketplaceMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Find any active offer or transaction for this conversation
    const activeOffer = await this.prisma.marketplaceOffer.findFirst({
      where: {
        listingId: conv.listingId,
        buyerId: conv.buyerId,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeTransaction = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId: conv.listingId,
        buyerId: conv.buyerId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        review: true,
      },
    });

    return {
      conversation: conv,
      messages,
      activeOffer,
      activeTransaction,
    };
  }

  async saveMessage(userId: string, dto: SendMessageDto) {
    const conv = await this.prisma.marketplaceConversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    if (conv.buyerId !== userId && conv.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to message in this conversation');
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.marketplaceMessage.create({
        data: {
          conversationId: dto.conversationId,
          senderId: userId,
          content: dto.content.trim(),
          messageType: dto.messageType || 'TEXT',
          metadata: dto.metadata || undefined,
        },
        include: {
          sender: {
            select: {
              id: true,
              student: { select: { firstName: true, lastName: true } },
              faculty: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.marketplaceConversation.update({
        where: { id: dto.conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    const recipientId = conv.buyerId === userId ? conv.sellerId : conv.buyerId;

    return {
      message,
      recipientId,
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.marketplaceMessage.count({
      where: {
        conversation: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
        },
        senderId: { not: userId },
        isRead: false,
      },
    });
    return { unreadCount: count };
  }
}
