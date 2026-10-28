import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceChatService } from './marketplace-chat.service';
import { MarketplaceNegotiationService } from './marketplace-negotiation.service';
import { MarketplaceTransactionService } from './marketplace-transaction.service';
import { MarketplaceReviewService } from './marketplace-review.service';
import { MarketplaceModerationService } from './marketplace-moderation.service';
import { MarketplaceGateway } from './marketplace.gateway';

import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
import { InitiateTransactionDto } from './dto/initiate-transaction.dto';
import { VerifyHandoverDto } from './dto/verify-handover.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ReportStatus } from '@prisma/client';

@Controller('marketplace')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly chatService: MarketplaceChatService,
    private readonly negotiationService: MarketplaceNegotiationService,
    private readonly transactionService: MarketplaceTransactionService,
    private readonly reviewService: MarketplaceReviewService,
    private readonly moderationService: MarketplaceModerationService,
    private readonly gateway: MarketplaceGateway,
  ) {}

  private extractUserRole(req: any): string {
    return req.user?.role?.code || req.user?.role || 'STUDENT';
  }

  // -------------------------------------------------------------
  // LISTINGS
  // -------------------------------------------------------------

  @Post('listings')
  createListing(@Req() req: any, @Body() dto: CreateListingDto) {
    const userRole = this.extractUserRole(req);
    return this.marketplaceService.createListing(req.user.id, userRole, dto);
  }

  @Post('listings/:id/images')
  @UseInterceptors(FilesInterceptor('images', 6))
  uploadListingImages(
    @Req() req: any,
    @Param('id') listingId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const userRole = this.extractUserRole(req);
    return this.marketplaceService.uploadListingImages(
      req.user.id,
      userRole,
      listingId,
      files || [],
    );
  }

  @Delete('listings/:id/images/:imageId')
  deleteListingImage(
    @Req() req: any,
    @Param('id') listingId: string,
    @Param('imageId') imageId: string,
  ) {
    const userRole = this.extractUserRole(req);
    return this.marketplaceService.deleteListingImage(
      req.user.id,
      userRole,
      listingId,
      imageId,
    );
  }

  @Get('listings')
  getListings(@Req() req: any, @Query() query: QueryListingsDto) {
    const userRole = this.extractUserRole(req);
    return this.marketplaceService.getListings(req.user.id, userRole, query);
  }

  @Get('listings/my-listings')
  getMyListings(@Req() req: any) {
    return this.marketplaceService.getMyListings(req.user.id);
  }

  @Get('listings/:id')
  getListingById(@Req() req: any, @Param('id') listingId: string) {
    const userRole = this.extractUserRole(req);
    return this.marketplaceService.getListingById(req.user.id, userRole, listingId);
  }

  @Patch('listings/:id')
  updateListing(
    @Req() req: any,
    @Param('id') listingId: string,
    @Body() dto: UpdateListingDto,
  ) {
    const userRole = this.extractUserRole(req);
    return this.marketplaceService.updateListing(req.user.id, userRole, listingId, dto);
  }

  @Patch('listings/:id/sold')
  markAsSold(@Req() req: any, @Param('id') listingId: string) {
    const userRole = this.extractUserRole(req);
    return this.marketplaceService.markAsSold(req.user.id, userRole, listingId);
  }

  @Delete('listings/:id')
  deleteListing(@Req() req: any, @Param('id') listingId: string) {
    const userRole = this.extractUserRole(req);
    return this.marketplaceService.deleteListing(req.user.id, userRole, listingId);
  }

  // -------------------------------------------------------------
  // CHAT & CONVERSATIONS
  // -------------------------------------------------------------

  @Post('conversations')
  getOrCreateConversation(@Req() req: any, @Body('listingId') listingId: string) {
    const userRole = this.extractUserRole(req);
    return this.chatService.getOrCreateConversation(req.user.id, userRole, listingId);
  }

  @Get('conversations')
  getUserConversations(@Req() req: any) {
    return this.chatService.getUserConversations(req.user.id);
  }

  @Get('conversations/unread-count')
  getUnreadCount(@Req() req: any) {
    return this.chatService.getUnreadCount(req.user.id);
  }

  @Get('conversations/:id')
  getConversationMessages(@Req() req: any, @Param('id') conversationId: string) {
    return this.chatService.getConversationMessages(req.user.id, conversationId);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    dto.conversationId = conversationId;
    const { message, recipientId } = await this.chatService.saveMessage(req.user.id, dto);

    // Broadcast in real-time
    this.gateway.notifyConversation(conversationId, 'newMessage', message);
    this.gateway.notifyUser(recipientId, 'unreadNotification', {
      type: 'MARKETPLACE_MESSAGE',
      conversationId,
      message,
    });

    return message;
  }

  // -------------------------------------------------------------
  // NEGOTIATION & OFFERS
  // -------------------------------------------------------------

  @Post('offers')
  async createOffer(@Req() req: any, @Body() dto: CreateOfferDto) {
    const userRole = this.extractUserRole(req);
    const offer = await this.negotiationService.createOffer(req.user.id, userRole, dto);
    this.gateway.notifyUser(offer.sellerId, 'offerUpdate', { type: 'NEW_OFFER', offer });
    return offer;
  }

  @Get('offers/listing/:listingId')
  getListingOffers(@Req() req: any, @Param('listingId') listingId: string) {
    return this.negotiationService.getListingOffers(req.user.id, listingId);
  }

  @Patch('offers/:id/respond')
  async respondOffer(
    @Req() req: any,
    @Param('id') offerId: string,
    @Body() dto: RespondOfferDto,
  ) {
    const offer = await this.negotiationService.respondOffer(req.user.id, offerId, dto);
    const otherUserId = offer.buyerId === req.user.id ? offer.sellerId : offer.buyerId;
    this.gateway.notifyUser(otherUserId, 'offerUpdate', { type: 'OFFER_STATUS', offer });
    return offer;
  }

  // -------------------------------------------------------------
  // TRANSACTIONS & HANDOVER
  // -------------------------------------------------------------

  @Post('transactions')
  async initiateTransaction(@Req() req: any, @Body() dto: InitiateTransactionDto) {
    const userRole = this.extractUserRole(req);
    const tx = await this.transactionService.initiateTransaction(req.user.id, userRole, dto);
    this.gateway.notifyUser(tx.sellerId, 'transactionUpdate', { type: 'TX_INITIATED', tx });
    return tx;
  }

  @Get('transactions/my-deals')
  getMyDeals(@Req() req: any) {
    return this.transactionService.getMyDeals(req.user.id);
  }

  @Get('transactions/:id')
  getTransactionById(@Req() req: any, @Param('id') transactionId: string) {
    return this.transactionService.getTransactionById(req.user.id, transactionId);
  }

  @Post('transactions/:id/regenerate-otp')
  regenerateOtp(@Req() req: any, @Param('id') transactionId: string) {
    return this.transactionService.regenerateOtp(req.user.id, transactionId);
  }

  @Post('transactions/:id/verify-handover')
  @HttpCode(HttpStatus.OK)
  async verifyHandover(
    @Req() req: any,
    @Param('id') transactionId: string,
    @Body() dto: VerifyHandoverDto,
  ) {
    const result = await this.transactionService.verifyHandover(
      req.user.id,
      transactionId,
      dto,
    );
    const tx = result.transaction;
    const otherUserId = tx.buyerId === req.user.id ? tx.sellerId : tx.buyerId;
    this.gateway.notifyUser(otherUserId, 'transactionUpdate', {
      type: 'TX_COMPLETED',
      tx,
    });
    return result;
  }

  @Post('transactions/:id/cancel')
  async cancelTransaction(
    @Req() req: any,
    @Param('id') transactionId: string,
    @Body('reason') reason?: string,
  ) {
    const result = await this.transactionService.cancelTransaction(
      req.user.id,
      transactionId,
      reason,
    );
    const tx = result.transaction;
    const otherUserId = tx.buyerId === req.user.id ? tx.sellerId : tx.buyerId;
    this.gateway.notifyUser(otherUserId, 'transactionUpdate', {
      type: 'TX_CANCELLED',
      tx,
    });
    return result;
  }

  // -------------------------------------------------------------
  // REVIEWS & REPUTATION
  // -------------------------------------------------------------

  @Post('reviews')
  createReview(@Req() req: any, @Body() dto: CreateReviewDto) {
    return this.reviewService.createReview(req.user.id, dto);
  }

  @Get('sellers/:sellerId/reviews')
  getSellerReviews(@Param('sellerId') sellerId: string) {
    return this.reviewService.getSellerReviews(sellerId);
  }

  // -------------------------------------------------------------
  // REPORTS & MODERATION
  // -------------------------------------------------------------

  @Post('reports')
  createReport(@Req() req: any, @Body() dto: CreateReportDto) {
    return this.moderationService.createReport(req.user.id, dto);
  }

  @Get('moderation/reports')
  @Roles('HOD', 'ADMIN', 'SUPER_ADMIN')
  getReportsForModerator(
    @Req() req: any,
    @Query('status') status?: ReportStatus,
  ) {
    const userRole = this.extractUserRole(req);
    return this.moderationService.getReportsForModerator(req.user.id, userRole, status);
  }

  @Patch('moderation/reports/:id/resolve')
  @Roles('HOD', 'ADMIN', 'SUPER_ADMIN')
  resolveReport(
    @Req() req: any,
    @Param('id') reportId: string,
    @Body() dto: ResolveReportDto,
  ) {
    const userRole = this.extractUserRole(req);
    return this.moderationService.resolveReport(req.user.id, userRole, reportId, dto);
  }
}

