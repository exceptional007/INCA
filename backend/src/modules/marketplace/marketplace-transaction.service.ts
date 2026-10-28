import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InitiateTransactionDto } from './dto/initiate-transaction.dto';
import { VerifyHandoverDto } from './dto/verify-handover.dto';
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
    return crypto.randomInt(100000, 1000000).toString();
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

    if (listing.status === ListingStatus.SOLD || listing.status === ListingStatus.REMOVED || listing.status === ListingStatus.ARCHIVED) {
      throw new BadRequestException(`Listing is ${listing.status.toLowerCase()} and cannot be purchased`);
    }

    // Check if there is an active transaction already in progress
    const existingActive = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId: dto.listingId,
        buyerId,
        status: { in: [TransactionStatus.INITIATED, TransactionStatus.PRICE_AGREED, TransactionStatus.HANDOVER_PENDING] },
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
    }

    const otp = this.generate6DigitOtp();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.marketplaceTransaction.create({
        data: {
          listingId: dto.listingId,
          buyerId,
          sellerId: listing.sellerId,
          agreedPrice,
          status: TransactionStatus.HANDOVER_PENDING,
          handoverOtp: otp,
          handoverOtpExpiresAt: expiresAt,
          handoverOtpAttempts: 0,
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
            },
          },
          buyer: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true, phone: true } },
              faculty: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
        },
      });

      await tx.marketplaceListing.update({
        where: { id: dto.listingId },
        data: { status: ListingStatus.RESERVED },
      });

      return created;
    });

    // Notify conversation
    this.addConversationSystemMessage(
      listing.id,
      buyerId,
      buyerId,
      `Handover initiated. Agreed price: ₹${agreedPrice.toLocaleString('en-IN')}. Verify in-person with OTP on delivery.`,
      'TRANSACTION_INITIATED',
      { transactionId: transaction.id, agreedPrice },
    );

    return transaction;
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

    const isSeller = tx.sellerId === userId;
    const isBuyer = tx.buyerId === userId;

    if (!isSeller && !isBuyer) {
      throw new ForbiddenException('Not authorized to verify this transaction');
    }

    if (tx.status === TransactionStatus.COMPLETED) {
      return { success: true, message: 'Transaction has already been completed', transaction: tx };
    }

    if (tx.status !== TransactionStatus.HANDOVER_PENDING && tx.status !== TransactionStatus.PRICE_AGREED) {
      throw new BadRequestException(`Cannot verify transaction in ${tx.status} status`);
    }

    if (tx.handoverOtpAttempts >= 5) {
      throw new BadRequestException('Too many failed OTP attempts. Please generate a new OTP.');
    }

    if (!tx.handoverOtpExpiresAt || new Date() > tx.handoverOtpExpiresAt) {
      throw new BadRequestException('Handover OTP has expired. Please request a new OTP.');
    }

    // Validate OTP match
    if (tx.handoverOtp !== dto.otp.trim()) {
      await this.prisma.marketplaceTransaction.update({
        where: { id: transactionId },
        data: { handoverOtpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP. Please check the code provided by the buyer.');
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
          buyerConfirmedAt: now,
          sellerConfirmedAt: now,
          completedAt: now,
          handoverOtp: null,
        },
        include: {
          listing: true,
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

      // Atomically mark listing as SOLD
      await prismaTx.marketplaceListing.update({
        where: { id: tx.listingId },
        data: {
          status: ListingStatus.SOLD,
          soldAt: now,
        },
      });

      return updated;
    });

    // Notify conversation
    this.addConversationSystemMessage(
      tx.listingId,
      tx.buyerId,
      userId,
      `Handover verified successfully! Transaction is marked COMPLETED. Buyer can now leave a rating & review.`,
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

    if (tx.buyerId !== userId && tx.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to regenerate OTP');
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
      handoverOtp: tx.buyerId === userId ? newOtp : undefined,
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
    });

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
            },
          },
          review: true,
        },
      }),
    ]);

    return {
      purchases,
      sales,
    };
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
