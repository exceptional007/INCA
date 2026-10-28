import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LostFoundService } from './lost-found.service';
import { LostFoundMatchingService } from './lost-found-matching.service';
import { LostFoundClaimService } from './lost-found-claim.service';
import { LostFoundContributionService } from './lost-found-contribution.service';
import { LostFoundNotificationService } from './lost-found-notification.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { SubmitClaimDto } from './dto/submit-claim.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';
import { VerifyClaimHandoverDto } from './dto/verify-claim-handover.dto';
import { ReviewMatchDto } from './dto/review-match.dto';

@Controller('lost-found')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class LostFoundController {
  constructor(
    private readonly lostFoundService: LostFoundService,
    private readonly matchingService: LostFoundMatchingService,
    private readonly claimService: LostFoundClaimService,
    private readonly contributionService: LostFoundContributionService,
    private readonly notificationService: LostFoundNotificationService,
  ) {}

  private extractUserRoles(req: any): string[] {
    const role = req.user?.role?.code || req.user?.role || 'STUDENT';
    return Array.isArray(role) ? role : [role];
  }

  // ==========================================
  // REPORTS
  // ==========================================

  @Post('reports')
  @UseInterceptors(FilesInterceptor('images', 5))
  async createReport(
    @Req() req: any,
    @Body() dto: CreateReportDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.lostFoundService.createReport(req.user.id, dto, files);
  }

  @Get('reports')
  async getReports(@Query() query: QueryReportsDto) {
    return this.lostFoundService.getReports(query);
  }

  @Get('reports/my-reports')
  async getMyReports(@Req() req: any) {
    return this.lostFoundService.getMyReports(req.user.id);
  }

  @Get('reports/:id')
  async getReportById(@Req() req: any, @Param('id') id: string) {
    return this.lostFoundService.getReportById(id, req.user.id);
  }

  @Put('reports/:id')
  async updateReport(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
  ) {
    const roles = this.extractUserRoles(req);
    return this.lostFoundService.updateReport(id, req.user.id, roles, dto);
  }

  @Delete('reports/:id')
  async deleteReport(@Req() req: any, @Param('id') id: string) {
    const roles = this.extractUserRoles(req);
    return this.lostFoundService.deleteReport(id, req.user.id, roles);
  }

  // ==========================================
  // AI MATCHES
  // ==========================================

  @Get('reports/:id/matches')
  async getMatchesForReport(@Param('id') reportId: string) {
    return this.matchingService.getMatchesForReport(reportId);
  }

  @Put('matches/:id/review')
  async reviewMatch(
    @Req() req: any,
    @Param('id') matchId: string,
    @Body() dto: ReviewMatchDto,
  ) {
    return this.matchingService.reviewMatch(matchId, req.user.id, dto.status);
  }

  // ==========================================
  // CLAIMS & OTP HANDOVER
  // ==========================================

  @Post('reports/:id/claims')
  async submitClaim(
    @Req() req: any,
    @Param('id') reportId: string,
    @Body() dto: SubmitClaimDto,
  ) {
    return this.claimService.submitClaim(req.user.id, reportId, dto);
  }

  @Get('reports/:id/claims')
  async getClaimsForReport(@Req() req: any, @Param('id') reportId: string) {
    const roles = this.extractUserRoles(req);
    return this.claimService.getClaimsForReport(reportId, req.user.id, roles);
  }

  @Get('claims/my-claims')
  async getMyClaims(@Req() req: any) {
    return this.claimService.getMyClaims(req.user.id);
  }

  @Put('claims/:id/review')
  async reviewClaim(
    @Req() req: any,
    @Param('id') claimId: string,
    @Body() dto: ReviewClaimDto,
  ) {
    const roles = this.extractUserRoles(req);
    return this.claimService.reviewClaim(req.user.id, roles, claimId, dto);
  }

  @Post('claims/:id/verify-handover')
  async verifyClaimHandover(
    @Req() req: any,
    @Param('id') claimId: string,
    @Body() dto: VerifyClaimHandoverDto,
  ) {
    const roles = this.extractUserRoles(req);
    return this.claimService.verifyClaimHandover(req.user.id, roles, claimId, dto);
  }

  // ==========================================
  // CONTRIBUTIONS & LEADERBOARD
  // ==========================================

  @Get('contributions/my-stats')
  async getMyContributionStats(@Req() req: any) {
    return this.contributionService.getUserContributions(req.user.id);
  }

  @Get('contributions/leaderboard')
  async getLeaderboard(@Query('limit') limit?: number) {
    return this.contributionService.getLeaderboard(limit ? Number(limit) : 10);
  }

  // ==========================================
  // IN-APP NOTIFICATIONS
  // ==========================================

  @Get('notifications')
  async getUserNotifications(
    @Req() req: any,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationService.getUserNotifications(
      req.user.id,
      unreadOnly === 'true',
    );
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationService.getUnreadCount(req.user.id);
    return { unreadCount: count };
  }

  @Put('notifications/:id/read')
  async markNotificationRead(
    @Req() req: any,
    @Param('id') notificationId: string,
  ) {
    return this.notificationService.markAsRead(notificationId, req.user.id);
  }

  @Put('notifications/read-all')
  async markAllNotificationsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id);
  }
}

