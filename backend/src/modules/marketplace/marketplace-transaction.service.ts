import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InitiateTransactionDto } from './dto/initiate-transaction.dto';
import { VerifyHandoverDto } from './dto/verify-handover.dto';
import { ConfirmScheduleDto } from './dto/confirm-schedule.dto';
import {
  TransactionStatus,
  ListingStatus,
  ListingVisibility,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class MarketplaceTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  private isFacultyOrAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  private generate6DigitOtp(): string {
    return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  }

  async initiateTransaction(buyerId: string, userRole: string, dto: InitiateTransactionDto) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: dto.listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId === buyerId) {
      throw new BadRequestException('You cannot initiate a transaction on your own listing');
    }

    if (listing.visibility === ListingVisibility.FACULTY_ONLY && !this.isFacultyOrAdmin(userRole)) {
      throw new ForbiddenException('This listing is restricted to faculty members only');
    }

    if (
      listing.status === ListingStatus.SOLD ||
      listing.status === ListingStatus.REMOVED ||
      listing.status === ListingStatus.ARCHIVED
    ) {
      throw new BadRequestException(`Listing is ${listing.status.toLowerCase()} and cannot be purchased`);
    }

    // Check if there is an active transaction already in progress
    const existingActive = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId: dto.listingId,
        buyerId,
        status: {
          in: [
            TransactionStatus.INITIATED,
            TransactionStatus.PRICE_AGREED,
            TransactionStatus.HANDOVER_PENDING,
          ],
        },
      },
    });

    if (existingActive) {
      return existingActive;
    }

    let agreedPrice = listing.price;

    if (dto.offerId) {
      const offer = await this.prisma.marketplaceOffer.findUnique({
        where: { id: dto.offerId },
      });
      if (offer && offer.buyerId === buyerId && offer.status === 'ACCEPTED') {
        agreedPrice = offer.counterAmount || offer.amount;
      }
    } else {
      // Check if an accepted offer exists for this buyer and listing
      const acceptedOffer = await this.prisma.marketplaceOffer.findFirst({
        where: {
          listingId: dto.listingId,
          buyerId,
          status: 'ACCEPTED',
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (acceptedOffer) {
        agreedPrice = acceptedOffer.counterAmount || acceptedOffer.amount;
      }
    }

    const hasSchedule = Boolean(dto.location && dto.date && dto.time);
    const initialStatus = hasSchedule
      ? TransactionStatus.HANDOVER_PENDING
      : TransactionStatus.PRICE_AGREED;
    const otp = hasSchedule ? this.generate6DigitOtp() : null;
    const expiresAt = hasSchedule ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.marketplaceTransaction.create({
        data: {
          listingId: dto.listingId,
          buyerId,
          sellerId: listing.sellerId,
          agreedPrice,
          offerId: dto.offerId || null,
          status: initialStatus,
          handoverLocation: dto.location || listing.preferredLocation || 'Campus Center',
          handoverDate: dto.date || null,
          handoverTime: dto.time || null,
          handoverOtp: otp,
          handoverOtpExpiresAt: expiresAt,
          handoverOtpAttempts: 0,
          buyerConfirmed: hasSchedule,
          sellerConfirmed: false,
        },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              preferredLocation: true,
              images: { take: 1, orderBy: { sortOrder: 'asc' } },
            },
          },
          seller: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true, phone: true } },
              faculty: { select: { firstName: true, lastName: true, phone: true } },
              adminProfile: { select: { name: true } },
            },
          },
          buyer: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true, phone: true } },
              faculty: { select: { firstName: true, lastName: true, phone: true } },
              adminProfile: { select: { name: true } },
            },
          },
        },
      });

      await tx.marketplaceListing.update({
        where: { id: dto.listingId },
        data: { status: ListingStatus.RESERVED },
      });

      return created;
    }, { maxWait: 15000, timeout: 30000 });

    // Notify conversation
    this.addConversationSystemMessage(
      listing.id,
      buyerId,
      buyerId,
      hasSchedule
        ? `Handover initiated. Agreed price: ₹${agreedPrice.toLocaleString('en-IN')}. Verify in-person with OTP on delivery.`
        : `Deal created at agreed price: ₹${agreedPrice.toLocaleString('en-IN')}. Please confirm the handover date, time, and campus meeting location.`,
      'TRANSACTION_INITIATED',
      { transactionId: transaction.id, agreedPrice },
    );

    return {
      ...transaction,
      handoverOtp: transaction.buyerId === buyerId ? transaction.handoverOtp : undefined,
    };
  }

  async confirmSchedule(userId: string, transactionId: string, dto: ConfirmScheduleDto) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.buyerId !== userId && tx.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to schedule this transaction');
    }

    if (tx.status === TransactionStatus.COMPLETED || tx.status === TransactionStatus.CANCELLED) {
      throw new BadRequestException(`Cannot schedule a ${tx.status.toLowerCase()} transaction`);
    }

    const isBuyer = tx.buyerId === userId;
    const isSeller = tx.sellerId === userId;

    const location = dto.location.trim();
    const date = dto.date.trim();
    const time = dto.time.trim();

    // Check if the proposed meeting details are the same or changed
    const detailsChanged =
      tx.handoverLocation !== location ||
      tx.handoverDate !== date ||
      tx.handoverTime !== time;

    const buyerConfirmed = isBuyer ? true : (detailsChanged ? false : tx.buyerConfirmed);
    const sellerConfirmed = isSeller ? true : (detailsChanged ? false : tx.sellerConfirmed);

    // If both confirmed or either party confirms the proposed arrangement
    const bothConfirmed = buyerConfirmed && sellerConfirmed;
    const newStatus = bothConfirmed ? TransactionStatus.HANDOVER_PENDING : TransactionStatus.PRICE_AGREED;

    let otp = tx.handoverOtp;
    let expiresAt = tx.handoverOtpExpiresAt;
    let attempts = tx.handoverOtpAttempts;

    if (bothConfirmed) {
      if (!otp || detailsChanged) {
        otp = this.generate6DigitOtp();
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        attempts = 0;
      }
    } else if (detailsChanged) {
      // Invalidate existing OTP if meeting details changed until re-confirmed
      otp = null;
      expiresAt = null;
      attempts = 0;
    }

    const updated = await this.prisma.marketplaceTransaction.update({
      where: { id: transactionId },
      data: {
        handoverLocation: location,
        handoverDate: date,
        handoverTime: time,
        buyerConfirmed,
        sellerConfirmed,
        buyerConfirmedAt: isBuyer ? new Date() : tx.buyerConfirmedAt,
        sellerConfirmedAt: isSeller ? new Date() : tx.sellerConfirmedAt,
        status: newStatus,
        handoverOtp: otp,
        handoverOtpExpiresAt: expiresAt,
        handoverOtpAttempts: attempts,
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            preferredLocation: true,
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
            adminProfile: { select: { name: true } },
          },
        },
        buyer: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
            adminProfile: { select: { name: true } },
          },
        },
      },
    });

    const userLabel = isSeller ? 'Seller' : 'Buyer';
    if (bothConfirmed) {
      this.addConversationSystemMessage(
        tx.listingId,
        tx.buyerId,
        userId,
        `Deal finalized! Meeting confirmed at ${location} on ${date} at ${time}. In-person verification OTP has been generated for the buyer.`,
        'HANDOVER_SCHEDULED',
        { transactionId, location, date, time },
      );
    } else {
      this.addConversationSystemMessage(
        tx.listingId,
        tx.buyerId,
        userId,
        `${userLabel} proposed handover arrangement at ${location} on ${date} at ${time}. Awaiting confirmation from the other party.`,
        'SCHEDULE_PROPOSED',
        { transactionId, location, date, time },
      );
    }

    return {
      ...updated,
      handoverOtp: tx.buyerId === userId ? updated.handoverOtp : undefined,
    };
  }

  async getTransactionById(userId: string, transactionId: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            preferredLocation: true,
            status: true,
            images: { orderBy: { sortOrder: 'asc' } },
          },
        },
        buyer: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true, rollNumber: true, phone: true, photoKey: true } },
            faculty: { select: { firstName: true, lastName: true, designation: true, phone: true, photoKey: true } },
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true, rollNumber: true, phone: true, photoKey: true } },
            faculty: { select: { firstName: true, lastName: true, designation: true, phone: true, photoKey: true } },
          },
        },
        review: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.buyerId !== userId && tx.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to access this transaction');
    }

    const isBuyer = tx.buyerId === userId;
    return {
      ...tx,
      handoverOtp: isBuyer ? tx.handoverOtp : undefined,
    };
  }

  async verifyHandover(userId: string, transactionId: string, dto: VerifyHandoverDto) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId },
      include: { listing: true },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.sellerId !== userId) {
      throw new ForbiddenException('Only the seller can verify the handover OTP');
    }

    if (tx.status === TransactionStatus.COMPLETED) {
      return { success: true, message: 'Transaction has already been completed', transaction: tx };
    }

    if (tx.status !== TransactionStatus.HANDOVER_PENDING && tx.status !== TransactionStatus.PRICE_AGREED) {
      throw new BadRequestException(`Cannot verify transaction in ${tx.status} status`);
    }

    if (tx.listing.status === ListingStatus.SOLD) {
      throw new BadRequestException('This product has already been sold');
    }

    if (tx.handoverOtpAttempts >= 5) {
      throw new BadRequestException('Too many failed OTP attempts (5/5). Please ask the buyer to regenerate a new OTP.');
    }

    if (!tx.handoverOtpExpiresAt || new Date() > tx.handoverOtpExpiresAt) {
      throw new BadRequestException('Handover OTP has expired. Please ask the buyer to request a new OTP.');
    }

    // Validate OTP match
    if (!tx.handoverOtp || tx.handoverOtp !== dto.otp.trim()) {
      await this.prisma.marketplaceTransaction.update({
        where: { id: transactionId },
        data: { handoverOtpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP. Please check the 6-digit code provided by the buyer.');
    }

    // OTP Verified! Dual confirmation and completion
    const completedTx = await this.prisma.$transaction(async (prismaTx) => {
      const now = new Date();
      const updated = await prismaTx.marketplaceTransaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.COMPLETED,
          buyerConfirmed: true,
          sellerConfirmed: true,
          buyerConfirmedAt: tx.buyerConfirmedAt || now,
          sellerConfirmedAt: now,
          completedAt: now,
          handoverOtp: null,
          handoverOtpAttempts: 0,
        },
        include: {
          listing: true,
          buyer: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true } },
              faculty: { select: { firstName: true, lastName: true } },
              adminProfile: { select: { name: true } },
            },
          },
          seller: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true } },
              faculty: { select: { firstName: true, lastName: true } },
              adminProfile: { select: { name: true } },
            },
          },
        },
      });

      // Atomically mark listing as SOLD
      await prismaTx.marketplaceListing.update({
        where: { id: tx.listingId },
        data: {
          status: ListingStatus.SOLD,
          soldAt: now,
        },
      });

      // Cancel any remaining pending offers for this listing
      await prismaTx.marketplaceOffer.updateMany({
        where: {
          listingId: tx.listingId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
        },
      });

      return updated;
    }, { maxWait: 15000, timeout: 30000 });

    // Notify conversation
    this.addConversationSystemMessage(
      tx.listingId,
      tx.buyerId,
      userId,
      `Handover verified successfully! Order Received. ${tx.listing.title} is marked as SOLD.`,
      'TRANSACTION_COMPLETED',
      { transactionId: completedTx.id },
    );

    return {
      success: true,
      message: 'Handover verified and transaction completed successfully!',
      transaction: completedTx,
    };
  }

  async regenerateOtp(userId: string, transactionId: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.buyerId !== userId) {
      throw new ForbiddenException('Only the buyer can regenerate the handover OTP');
    }

    if (tx.status === TransactionStatus.COMPLETED || tx.status === TransactionStatus.CANCELLED) {
      throw new BadRequestException(`Cannot regenerate OTP for ${tx.status} transaction`);
    }

    const newOtp = this.generate6DigitOtp();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const updated = await this.prisma.marketplaceTransaction.update({
      where: { id: transactionId },
      data: {
        handoverOtp: newOtp,
        handoverOtpExpiresAt: expiresAt,
        handoverOtpAttempts: 0,
      },
    });

    return {
      success: true,
      handoverOtp: newOtp,
      handoverOtpExpiresAt: expiresAt,
    };
  }

  async cancelTransaction(userId: string, transactionId: string, reason?: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId },
      include: { listing: true },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.buyerId !== userId && tx.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to cancel this transaction');
    }

    if (tx.status === TransactionStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel an already completed transaction');
    }

    const cancelledTx = await this.prisma.$transaction(async (prismaTx) => {
      const updated = await prismaTx.marketplaceTransaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.CANCELLED,
          handoverOtp: null,
        },
      });

      // Reset listing to ACTIVE if it was RESERVED
      if (tx.listing.status === ListingStatus.RESERVED) {
        await prismaTx.marketplaceListing.update({
          where: { id: tx.listingId },
          data: { status: ListingStatus.ACTIVE },
        });
      }

      return updated;
    }, { maxWait: 15000, timeout: 30000 });

    this.addConversationSystemMessage(
      tx.listingId,
      tx.buyerId,
      userId,
      `Transaction was cancelled. ${reason ? `Reason: ${reason}` : ''}`,
      'TRANSACTION_CANCELLED',
      { transactionId },
    );

    return { success: true, transaction: cancelledTx };
  }

  async getMyDeals(userId: string) {
    const [purchases, sales] = await Promise.all([
      this.prisma.marketplaceTransaction.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              preferredLocation: true,
              images: { take: 1, orderBy: { sortOrder: 'asc' } },
            },
          },
          seller: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true } },
              faculty: { select: { firstName: true, lastName: true } },
              adminProfile: { select: { name: true } },
            },
          },
          review: true,
        },
      }),
      this.prisma.marketplaceTransaction.findMany({
        where: { sellerId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              preferredLocation: true,
              images: { take: 1, orderBy: { sortOrder: 'asc' } },
            },
          },
          buyer: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true } },
              faculty: { select: { firstName: true, lastName: true } },
              adminProfile: { select: { name: true } },
            },
          },
          review: true,
        },
      }),
    ]);

    // Mask handoverOtp for sales to prevent seller from seeing buyer's code beforehand
    const safeSales = sales.map((s) => ({
      ...s,
      handoverOtp: undefined,
    }));

    return {
      purchases,
      sales: safeSales,
    };
  }

  async findActiveTransaction(listingId: string, buyerId: string) {
    return this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId,
        buyerId,
        status: {
          in: [
            TransactionStatus.INITIATED,
            TransactionStatus.PRICE_AGREED,
            TransactionStatus.HANDOVER_PENDING,
          ],
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            preferredLocation: true,
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
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
