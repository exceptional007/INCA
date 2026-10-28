import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { ListingStatus, ListingVisibility, Prisma } from '@prisma/client';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: StrictR2StorageService,
  ) {}

  private isFacultyOrAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  private isAdmin(userRole: string): boolean {
    const role = (userRole || '').toUpperCase();
    return ['ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  async createListing(userId: string, userRole: string, dto: CreateListingDto) {
    let visibility = dto.visibility || ListingVisibility.ALL;
    if (visibility === ListingVisibility.FACULTY_ONLY && !this.isFacultyOrAdmin(userRole)) {
      visibility = ListingVisibility.ALL;
    }

    const listing = await this.prisma.marketplaceListing.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        price: dto.price,
        category: dto.category,
        condition: dto.condition,
        visibility,
        preferredLocation: dto.pickupLocation?.trim() || 'Campus Center',
        sellerId: userId,
        status: ListingStatus.ACTIVE,
      },
      include: {
        images: true,
        seller: {
          select: {
            id: true,
            email: true,
            student: {
              select: {
                firstName: true,
                lastName: true,
                rollNumber: true,
                photoKey: true,
                department: { select: { name: true, code: true } },
              },
            },
            faculty: {
              select: {
                firstName: true,
                lastName: true,
                designation: true,
                photoKey: true,
                department: { select: { name: true, code: true } },
              },
            },
          },
        },
      },
    });

    return listing;
  }

  async uploadListingImages(
    userId: string,
    userRole: string,
    listingId: string,
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
  ) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { images: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId && !this.isAdmin(userRole)) {
      throw new ForbiddenException('Not authorized to modify this listing');
    }

    if (listing.images.length + files.length > 6) {
      throw new BadRequestException('A maximum of 6 images is allowed per listing');
    }

    const createdImages: any[] = [];
    const currentCount = listing.images.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fileKey = await this.r2Storage.uploadMarketplaceImage(
          file.buffer,
          file.originalname,
          file.mimetype,
        );

        const img = await this.prisma.marketplaceImage.create({
          data: {
            listingId,
            storageKey: fileKey,
            url: fileKey,
            sortOrder: currentCount + i,
          },
        });
        createdImages.push(img);
      } catch (err: any) {
        this.logger.error(`Error uploading image for listing ${listingId}: ${err?.message}`);
        throw new BadRequestException(`Image upload failed: ${err?.message}`);
      }
    }

    return createdImages;
  }

  async deleteListingImage(userId: string, userRole: string, listingId: string, imageId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { images: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId && !this.isAdmin(userRole)) {
      throw new ForbiddenException('Not authorized to modify this listing');
    }

    const image = listing.images.find((img) => img.id === imageId);
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    try {
      await this.r2Storage.deleteObject(image.storageKey);
    } catch (e) {
      this.logger.warn(`Could not delete R2 object: ${image.storageKey}`);
    }

    await this.prisma.marketplaceImage.delete({ where: { id: imageId } });

    return { success: true };
  }

  async getListings(userId: string, userRole: string, query: QueryListingsDto) {
    const isFaculty = this.isFacultyOrAdmin(userRole);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.MarketplaceListingWhereInput = {
      status: query.status ? query.status : { in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] },
    };

    // Audience Visibility restriction
    if (!isFaculty) {
      where.visibility = ListingVisibility.ALL;
    }

    // Category filter
    if (query.category) {
      where.category = query.category;
    }

    // Condition filter
    if (query.condition) {
      where.condition = query.condition;
    }

    // Price range
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) {
        where.price.gte = Number(query.minPrice);
      }
      if (query.maxPrice !== undefined) {
        where.price.lte = Number(query.maxPrice);
      }
    }

    // Keyword Search
    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { preferredLocation: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Order By
    let orderBy: Prisma.MarketplaceListingOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sortBy === 'price') {
      orderBy = { price: query.sortOrder === 'asc' ? 'asc' : 'desc' };
    }

    const [total, items] = await Promise.all([
      this.prisma.marketplaceListing.count({ where }),
      this.prisma.marketplaceListing.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
          seller: {
            select: {
              id: true,
              email: true,
              student: {
                select: {
                  firstName: true,
                  lastName: true,
                  rollNumber: true,
                  photoKey: true,
                  department: { select: { name: true, code: true } },
                },
              },
              faculty: {
                select: {
                  firstName: true,
                  lastName: true,
                  designation: true,
                  photoKey: true,
                  department: { select: { name: true, code: true } },
                },
              },
            },
          },
          _count: {
            select: {
              offers: true,
              conversations: true,
            },
          },
        },
      }),
    ]);

    const formattedItems = await Promise.all(
      items.map(async (item) => {
        const reputation = await this.getSellerReputationSummary(item.sellerId);
        return {
          ...item,
          sellerReputation: reputation,
        };
      }),
    );

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getListingById(userId: string, userRole: string, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        seller: {
          select: {
            id: true,
            email: true,
            student: {
              select: {
                firstName: true,
                lastName: true,
                rollNumber: true,
                photoKey: true,
                department: { select: { name: true, code: true } },
              },
            },
            faculty: {
              select: {
                firstName: true,
                lastName: true,
                designation: true,
                photoKey: true,
                department: { select: { name: true, code: true } },
              },
            },
          },
        },
        _count: {
          select: {
            offers: true,
            conversations: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status === ListingStatus.REMOVED && !this.isAdmin(userRole)) {
      throw new NotFoundException('This listing has been removed by moderation');
    }

    // Role-based visibility enforcement
    if (listing.visibility === ListingVisibility.FACULTY_ONLY && !this.isFacultyOrAdmin(userRole)) {
      throw new ForbiddenException('This listing is restricted to faculty members only.');
    }

    const reputation = await this.getSellerReputationSummary(listing.sellerId);

    // If caller is the seller, include active offers and transactions
    let sellerOffers: any = null;
    let activeTransaction: any = null;

    if (listing.sellerId === userId) {
      sellerOffers = await this.prisma.marketplaceOffer.findMany({
        where: { listingId },
        include: {
          buyer: {
            select: {
              id: true,
              email: true,
              student: { select: { firstName: true, lastName: true, rollNumber: true } },
              faculty: { select: { firstName: true, lastName: true, designation: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    activeTransaction = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId,
        status: { in: ['INITIATED', 'PRICE_AGREED', 'HANDOVER_PENDING'] },
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
      },
    });

    return {
      ...listing,
      sellerReputation: reputation,
      sellerOffers,
      activeTransaction,
    };
  }

  async getMyListings(userId: string) {
    const listings = await this.prisma.marketplaceListing.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        offers: {
          orderBy: { createdAt: 'desc' },
          take: 5,
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
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            offers: true,
            conversations: true,
          },
        },
      },
    });

    return listings;
  }

  async updateListing(
    userId: string,
    userRole: string,
    listingId: string,
    dto: UpdateListingDto,
  ) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId && !this.isAdmin(userRole)) {
      throw new ForbiddenException('Not authorized to edit this listing');
    }

    let visibility = dto.visibility;
    if (visibility === ListingVisibility.FACULTY_ONLY && !this.isFacultyOrAdmin(userRole)) {
      visibility = ListingVisibility.ALL;
    }

    const updated = await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        ...(dto.title && { title: dto.title.trim() }),
        ...(dto.description && { description: dto.description.trim() }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.category && { category: dto.category }),
        ...(dto.condition && { condition: dto.condition }),
        ...(visibility && { visibility }),
        ...(dto.pickupLocation && { preferredLocation: dto.pickupLocation.trim() }),
        ...(dto.status && { status: dto.status }),
      },
      include: {
        images: true,
      },
    });

    return updated;
  }

  async markAsSold(userId: string, userRole: string, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId && !this.isAdmin(userRole)) {
      throw new ForbiddenException('Not authorized to change this listing');
    }

    return this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.SOLD,
        soldAt: new Date(),
      },
    });
  }

  async deleteListing(userId: string, userRole: string, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { images: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId && !this.isAdmin(userRole)) {
      throw new ForbiddenException('Not authorized to delete this listing');
    }

    // Soft delete to preserve audit and transaction history
    await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { status: ListingStatus.ARCHIVED },
    });

    return { success: true, message: 'Listing archived successfully' };
  }

  async getSellerReputationSummary(sellerId: string) {
    const reviews = await this.prisma.marketplaceReview.findMany({
      where: { sellerId },
      select: { rating: true },
    });

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    const completedSales = await this.prisma.marketplaceTransaction.count({
      where: { sellerId, status: 'COMPLETED' },
    });

    return {
      averageRating,
      totalReviews,
      completedSales,
    };
  }

  async getSellerFullReviews(sellerId: string) {
    const reviews = await this.prisma.marketplaceReview.findMany({
      where: { sellerId },
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
      orderBy: { createdAt: 'desc' },
    });

    const summary = await this.getSellerReputationSummary(sellerId);

    return {
      summary,
      reviews,
    };
  }
}
