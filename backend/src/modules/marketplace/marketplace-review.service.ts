import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { TransactionStatus } from '@prisma/client';

@Injectable()
export class MarketplaceReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(reviewerId: string, dto: CreateReviewDto) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: dto.transactionId },
      include: { review: true },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.buyerId !== reviewerId) {
      throw new ForbiddenException('Only the verified buyer can leave a review for this transaction');
    }

    if (tx.status !== TransactionStatus.COMPLETED) {
      throw new BadRequestException('You can only review a completed transaction');
    }

    if (tx.review) {
      throw new ConflictException('You have already submitted a review for this transaction');
    }

    const review = await this.prisma.marketplaceReview.create({
      data: {
        transactionId: dto.transactionId,
        listingId: tx.listingId,
        reviewerId,
        sellerId: tx.sellerId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            student: { select: { firstName: true, lastName: true } },
            faculty: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return review;
  }

  async getSellerReviews(sellerId: string) {
    const reviews = await this.prisma.marketplaceReview.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: {
          select: {
            id: true,
            email: true,
            student: { select: { firstName: true, lastName: true, photoKey: true } },
            faculty: { select: { firstName: true, lastName: true, photoKey: true } },
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

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    return {
      totalReviews,
      averageRating,
      reviews,
    };
  }
}

