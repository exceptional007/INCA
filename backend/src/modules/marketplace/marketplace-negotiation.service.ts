import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondOfferDto, OfferAction } from './dto/respond-offer.dto';
import { OfferStatus, ListingStatus, ListingVisibility, TransactionStatus } from '@prisma/client';

@Injectable()
export class MarketplaceNegotiationService {
  constructor(private readonly prisma: PrismaService) {}

  private isFacultyOrAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  async createOffer(buyerId: string, userRole: string, dto: CreateOfferDto) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: dto.listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId === buyerId) {
      throw new BadRequestException('You cannot make an offer on your own listing');
    }

    if (listing.status !== ListingStatus.ACTIVE && listing.status !== ListingStatus.RESERVED) {
      throw new BadRequestException('This listing is no longer available for offers');
    }

    if (listing.visibility === ListingVisibility.FACULTY_ONLY && !this.isFacultyOrAdmin(userRole)) {
      throw new ForbiddenException('This listing is restricted to faculty members only');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Offer amount must be greater than zero');
    }

    // Cancel any previous pending offer from this buyer on this listing
    await this.prisma.marketplaceOffer.updateMany({
      where: {
        listingId: dto.listingId,
        buyerId,
        status: OfferStatus.PENDING,
      },
      data: {
        status: OfferStatus.CANCELLED,
      },
    });

    const offer = await this.prisma.marketplaceOffer.create({
      data: {
        listingId: dto.listingId,
        buyerId,
        sellerId: listing.sellerId,
        amount: dto.amount,
        status: OfferStatus.PENDING,
      },
      include: {
        buyer: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
    });

    // Also send an automated system message in the conversation if exists
    try {
      const conv = await this.prisma.marketplaceConversation.findFirst({
        where: { listingId: dto.listingId, buyerId },
      });
      if (conv) {
        await this.prisma.marketplaceMessage.create({
          data: {
            conversationId: conv.id,
            senderId: buyerId,
            content: `Made an offer of ₹${dto.amount.toLocaleString('en-IN')}`,
            messageType: 'OFFER',
            metadata: { offerId: offer.id, amount: dto.amount },
          },
        });
        await this.prisma.marketplaceConversation.update({
          where: { id: conv.id },
          data: { lastMessageAt: new Date() },
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return offer;
  }

  async respondOffer(userId: string, offerId: string, dto: RespondOfferDto) {
    const offer = await this.prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
      include: {
        listing: true,
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const isSeller = offer.sellerId === userId;
    const isBuyer = offer.buyerId === userId;

    if (!isSeller && !isBuyer) {
      throw new ForbiddenException('Not authorized to respond to this offer');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(`Cannot respond to offer in ${offer.status} status`);
    }

    let updatedOffer;

    switch (dto.action) {
      case OfferAction.ACCEPT:
        // Only seller can accept an initial buyer offer, or buyer accepts a counteroffer
        if (offer.counterAmount && isBuyer) {
          // Buyer accepts seller's counteroffer
        } else if (!offer.counterAmount && !isSeller) {
          throw new ForbiddenException('Only the seller can accept the buyer offer');
        }

        if (
          offer.listing.status === ListingStatus.SOLD ||
          offer.listing.status === ListingStatus.ARCHIVED ||
          offer.listing.status === ListingStatus.REMOVED
        ) {
          throw new BadRequestException('This listing is no longer available');
        }

        const agreedPrice = offer.counterAmount && isBuyer ? offer.counterAmount : offer.amount;

        updatedOffer = await this.prisma.$transaction(async (tx) => {
          const acc = await tx.marketplaceOffer.update({
            where: { id: offerId },
            data: { status: OfferStatus.ACCEPTED },
          });

          // Mark listing as RESERVED
          await tx.marketplaceListing.update({
            where: { id: offer.listingId },
            data: { status: ListingStatus.RESERVED },
          });

          // Check if active transaction exists for (listingId, buyerId)
          const existingTx = await tx.marketplaceTransaction.findFirst({
            where: {
              listingId: offer.listingId,
              buyerId: offer.buyerId,
              status: {
                in: [
                  TransactionStatus.INITIATED,
                  TransactionStatus.PRICE_AGREED,
                  TransactionStatus.HANDOVER_PENDING,
                ],
              },
            },
          });

          if (existingTx) {
            await tx.marketplaceTransaction.update({
              where: { id: existingTx.id },
              data: {
                agreedPrice,
                offerId: offer.id,
                status: TransactionStatus.PRICE_AGREED,
                buyerConfirmed: false,
                sellerConfirmed: false,
                handoverOtp: null,
                handoverOtpAttempts: 0,
              },
            });
          } else {
            await tx.marketplaceTransaction.create({
              data: {
                listingId: offer.listingId,
                buyerId: offer.buyerId,
                sellerId: offer.sellerId,
                agreedPrice,
                offerId: offer.id,
                status: TransactionStatus.PRICE_AGREED,
                handoverLocation: offer.listing.preferredLocation || 'Campus Center',
                buyerConfirmed: false,
                sellerConfirmed: false,
                handoverOtp: null,
                handoverOtpAttempts: 0,
              },
            });
          }

          return acc;
        }, { maxWait: 15000, timeout: 30000 });

        // Add automated system message
        this.addConversationSystemMessage(
          offer.listingId,
          offer.buyerId,
          userId,
          `Offer accepted at ₹${agreedPrice.toLocaleString('en-IN')}. Please confirm the handover date, time, and campus meeting place to generate the handover OTP.`,
          'OFFER_ACCEPTED',
          { offerId: offer.id, agreedPrice },
        );
        break;

      case OfferAction.REJECT:
        if (!isSeller) {
          throw new ForbiddenException('Only the seller can reject this offer');
        }
        updatedOffer = await this.prisma.marketplaceOffer.update({
          where: { id: offerId },
          data: { status: OfferStatus.REJECTED },
        });

        this.addConversationSystemMessage(
          offer.listingId,
          offer.buyerId,
          userId,
          `Offer of ₹${offer.amount.toLocaleString('en-IN')} was declined`,
          'OFFER_REJECTED',
          { offerId: offer.id },
        );
        break;

      case OfferAction.COUNTER:
        if (!isSeller) {
          throw new ForbiddenException('Only the seller can make a counteroffer');
        }
        if (!dto.counterAmount || dto.counterAmount <= 0) {
          throw new BadRequestException('Counteroffer amount must be greater than zero');
        }

        updatedOffer = await this.prisma.marketplaceOffer.update({
          where: { id: offerId },
          data: {
            counterAmount: dto.counterAmount,
          },
        });

        this.addConversationSystemMessage(
          offer.listingId,
          offer.buyerId,
          userId,
          `Counteroffer proposed: ₹${dto.counterAmount.toLocaleString('en-IN')}`,
          'OFFER_COUNTER',
          { offerId: offer.id, counterAmount: dto.counterAmount },
        );
        break;

      case OfferAction.CANCEL:
        if (!isBuyer && !isSeller) {
          throw new ForbiddenException('Not authorized to cancel this offer');
        }
        updatedOffer = await this.prisma.marketplaceOffer.update({
          where: { id: offerId },
          data: { status: OfferStatus.CANCELLED },
        });

        this.addConversationSystemMessage(
          offer.listingId,
          offer.buyerId,
          userId,
          `Offer was cancelled`,
          'OFFER_CANCELLED',
          { offerId: offer.id },
        );
        break;
    }

    return updatedOffer;
  }

  async getListingOffers(userId: string, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const isSeller = listing.sellerId === userId;

    // Seller sees all offers, buyer sees only their own
    const whereClause: any = { listingId };
    if (!isSeller) {
      whereClause.buyerId = userId;
    }

    return this.prisma.marketplaceOffer.findMany({
      where: whereClause,
      include: {
        buyer: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async addConversationSystemMessage(
    listingId: string,
    buyerId: string,
    senderId: string,
    content: string,
    messageType: string,
    metadata?: any,
  ) {
    try {
      const conv = await this.prisma.marketplaceConversation.findFirst({
        where: { listingId, buyerId },
      });
      if (conv) {
        await this.prisma.marketplaceMessage.create({
          data: {
            conversationId: conv.id,
            senderId,
            content,
            messageType,
            metadata: metadata || undefined,
          },
        });
        await this.prisma.marketplaceConversation.update({
          where: { id: conv.id },
          data: { lastMessageAt: new Date() },
        });
      }
    } catch (e) {
      // Ignore
    }
  }
}

