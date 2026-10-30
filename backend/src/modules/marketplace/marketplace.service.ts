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

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

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

  /**
   * Resolve a browser-accessible delivery URL for a marketplace image key.
   */
  resolveImageUrl(storageKey: string, existingUrl?: string | null): string {
    if (existingUrl && (existingUrl.startsWith('http://') || existingUrl.startsWith('https://'))) {
      return existingUrl;
    }
    const safeKey = storageKey || existingUrl || '';
    return `/api/v1/marketplace/images/stream?key=${encodeURIComponent(safeKey)}`;
  }

  /**
   * Format listing images with resolved delivery URLs while preserving storage keys.
   */
  formatListingImages(images: any[]) {
    if (!images || !Array.isArray(images)) return [];
    return images
      .filter((img) => Boolean(img && (img.storageKey || img.url)))
      .map((img) => ({
        ...img,
        url: this.resolveImageUrl(img.storageKey, img.url),
      }));
  }

  async streamImage(key: string) {
    return this.r2Storage.getObjectStream(key);
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
            adminProfile: { select: { name: true } },
          },
        },
      },
    });

    return {
      ...listing,
      images: this.formatListingImages(listing.images),
    };
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

    if (!files || files.length === 0) {
      throw new BadRequestException('No image files provided for upload');
    }

    if (listing.images.length + files.length > 6) {
      throw new BadRequestException('A maximum of 6 images is allowed per listing');
    }

    // Validate MIME types and file sizes before uploading to storage
    for (const file of files) {
      const mime = (file.mimetype || '').toLowerCase();
      if (!ALLOWED_MIME_TYPES.includes(mime) && !mime.startsWith('image/')) {
        throw new BadRequestException(
          `Invalid image format for file "${file.originalname}". Only JPG, PNG, WEBP, and GIF are supported.`,
        );
      }
      const fileSize = (file as any).size || (file.buffer ? file.buffer.length : 0);
      if (fileSize > MAX_IMAGE_SIZE) {
        throw new BadRequestException(
          `Image "${file.originalname}" exceeds the 10MB file size limit.`,
        );
      }
    }

    const createdImages: any[] = [];
    const uploadedKeys: string[] = [];
    const currentCount = listing.images.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let fileKey = '';
      try {
        fileKey = await this.r2Storage.uploadMarketplaceImage(
          file.buffer,
          file.originalname,
          file.mimetype,
        );
        uploadedKeys.push(fileKey);

        const img = await this.prisma.marketplaceImage.create({
          data: {
            listingId,
            storageKey: fileKey,
            url: this.resolveImageUrl(fileKey),
            sortOrder: currentCount + i,
          },
        });
        createdImages.push(img);
      } catch (err: any) {
        this.logger.error(`Error uploading image for listing ${listingId}: ${err?.message}`);
        // Clean up any uploaded objects from this batch to prevent orphans
        for (const k of uploadedKeys) {
          await this.r2Storage.deleteObject(k).catch(() => {});
        }
        throw new BadRequestException(`Image upload failed: ${err?.message}`);
      }
    }

    return this.formatListingImages(createdImages);
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
      throw new NotFoundException('Image not found on this listing');
    }

    // Delete from R2 storage
    if (image.storageKey) {
      await this.r2Storage.deleteObject(image.storageKey).catch((err) => {
        this.logger.warn(`Failed to delete R2 object ${image.storageKey}: ${err?.message}`);
      });
    }

    await this.prisma.marketplaceImage.delete({
      where: { id: imageId },
    });

    return { success: true, message: 'Image deleted successfully' };
  }

  /**
   * Optimized listing retrieval with batch seller reputation aggregation (resolving N+1 query bottleneck).
   */
  async getListings(userId: string, userRole: string, query: QueryListingsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const where: Prisma.MarketplaceListingWhereInput = {
      status: { in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] },
    };

    // Role-based visibility
    if (!this.isFacultyOrAdmin(userRole)) {
      where.visibility = ListingVisibility.ALL;
    }

    // Status filter
    if (query.status) {
      where.status = query.status;
    }

    // Search filter
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
      ];
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
              adminProfile: { select: { name: true } },
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

    // Batch aggregate seller reputation to avoid N+1 query loop
    const sellerIds = Array.from(new Set(items.map((i) => i.sellerId))) as string[];
    const reputationMap = new Map<string, { averageRating: number; totalReviews: number; completedSales: number }>();

    for (const sId of sellerIds) {
      reputationMap.set(sId, { averageRating: 0, totalReviews: 0, completedSales: 0 });
    }

    if (sellerIds.length > 0) {
      const [reviewAggregates, transactionAggregates] = await Promise.all([
        this.prisma.marketplaceReview.groupBy({
          by: ['sellerId'],
          where: { sellerId: { in: sellerIds } },
          _avg: { rating: true },
          _count: { rating: true },
        }),
        this.prisma.marketplaceTransaction.groupBy({
          by: ['sellerId'],
          where: { sellerId: { in: sellerIds }, status: 'COMPLETED' },
          _count: { id: true },
        }),
      ]);

      for (const rev of reviewAggregates) {
        const rep = reputationMap.get(rev.sellerId);
        if (rep) {
          rep.averageRating = rev._avg.rating ? Number(rev._avg.rating.toFixed(1)) : 0;
          rep.totalReviews = rev._count.rating || 0;
        }
      }

      for (const tx of transactionAggregates) {
        const rep = reputationMap.get(tx.sellerId);
        if (rep) {
          rep.completedSales = tx._count.id || 0;
        }
      }
    }

    const formattedItems = items.map((item) => ({
      ...item,
      images: this.formatListingImages(item.images),
      sellerReputation: reputationMap.get(item.sellerId) || {
        averageRating: 0,
        totalReviews: 0,
        completedSales: 0,
      },
    }));

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
            adminProfile: { select: { name: true } },
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
              adminProfile: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    activeTransaction = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId,
        status: { in: ['INITIATED', 'PRICE_AGREED', 'HANDOVER_PENDING', 'COMPLETED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
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
            adminProfile: { select: { name: true } },
          },
        },
      },
    });

    return {
      ...listing,
      images: this.formatListingImages(listing.images),
      sellerReputation: reputation,
      sellerOffers,
      activeTransaction,
      buyer: activeTransaction?.buyer || null,
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
            adminProfile: { select: { name: true } },
          },
        },
        offers: {
          where: { status: 'PENDING' },
          include: {
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
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            buyer: {
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
                adminProfile: { select: { name: true } },
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

    return listings.map((l) => ({
      ...l,
      images: this.formatListingImages(l.images),
      activeTransaction: l.transactions?.[0] || null,
      buyer: l.transactions?.[0]?.buyer || null,
    }));
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
      throw new ForbiddenException('Not authorized to update this listing');
    }

    const updated = await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand?.trim() || null } : {}),
        ...(dto.model !== undefined ? { model: dto.model?.trim() || null } : {}),
        ...(dto.pickupLocation !== undefined
          ? { preferredLocation: dto.pickupLocation?.trim() || null }
          : {}),
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
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

    return {
      ...updated,
      images: this.formatListingImages(updated.images),
    };
  }

  async markAsSold(userId: string, userRole: string, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId && !this.isAdmin(userRole)) {
      throw new ForbiddenException('Not authorized to update this listing');
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

    // Delete image objects from R2 storage
    if (listing.images && listing.images.length > 0) {
      for (const img of listing.images) {
        if (img.storageKey) {
          await this.r2Storage.deleteObject(img.storageKey).catch(() => {});
        }
      }
    }

    // Soft archive or hard delete depending on whether transactions exist
    const hasTransactions = await this.prisma.marketplaceTransaction.count({
      where: { listingId },
    });

    if (hasTransactions > 0) {
      await this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: { status: ListingStatus.ARCHIVED },
      });
      return { success: true, message: 'Listing archived (transactions associated)' };
    }

    await this.prisma.marketplaceListing.delete({
      where: { id: listingId },
    });

    return { success: true, message: 'Listing deleted successfully' };
  }

  async getSellerReputationSummary(sellerId: string) {
    const [reviewAgg, completedSales] = await Promise.all([
      this.prisma.marketplaceReview.aggregate({
        where: { sellerId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.marketplaceTransaction.count({
        where: { sellerId, status: 'COMPLETED' },
      }),
    ]);

    const totalReviews = reviewAgg._count.rating || 0;
    const averageRating = reviewAgg._avg.rating ? Number(reviewAgg._avg.rating.toFixed(1)) : 0;

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
            adminProfile: { select: { name: true } },
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
