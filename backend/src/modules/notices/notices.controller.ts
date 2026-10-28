import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { QueryNoticesDto } from './dto/query-notices.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('notices')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  private extractUserRole(req: any): string {
    return req.user?.role?.code || req.user?.role || 'STUDENT';
  }

  // 1. RECIPIENT ACTIVE FEED
  @Get()
  getRecipientNotices(@Req() req: any, @Query() query: QueryNoticesDto) {
    return this.noticesService.getRecipientNotices(req.user.id, query);
  }

  // 2. ACADEMIC SCOPES (TARGETING PICKERS)
  @Get('academic-scopes')
  getAcademicScopes() {
    return this.noticesService.getAcademicScopes();
  }

  // 3. PUBLISHER MANAGEMENT: MY NOTICES
  @Get('management/my-notices')
  @Roles('FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN')
  getManagedNotices(@Req() req: any, @Query() query: QueryNoticesDto) {
    const userRole = this.extractUserRole(req);
    return this.noticesService.getManagedNotices(req.user.id, userRole, query);
  }

  // 4. NOTICE DETAILS
  @Get(':id')
  getNoticeById(@Req() req: any, @Param('id') id: string) {
    return this.noticesService.getNoticeById(req.user.id, id);
  }

  // 5. MARK NOTICE AS READ
  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.noticesService.markAsRead(req.user.id, id);
  }

  // 6. ACKNOWLEDGE NOTICE
  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledgeNotice(@Req() req: any, @Param('id') id: string) {
    return this.noticesService.acknowledgeNotice(req.user.id, id);
  }

  // 7. CREATE NOTICE (DRAFT, SCHEDULED, OR PUBLISHED)
  @Post()
  @Roles('FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN')
  createNotice(@Req() req: any, @Body() dto: CreateNoticeDto) {
    const userRole = this.extractUserRole(req);
    return this.noticesService.createNotice(req.user.id, userRole, dto);
  }

  // 8. UPDATE NOTICE
  @Put(':id')
  @Roles('FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN')
  updateNotice(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    const userRole = this.extractUserRole(req);
    return this.noticesService.updateNotice(req.user.id, userRole, id, dto);
  }

  // 9. WITHDRAW NOTICE
  @Patch(':id/withdraw')
  @Roles('FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN')
  withdrawNotice(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const userRole = this.extractUserRole(req);
    return this.noticesService.withdrawNotice(req.user.id, userRole, id, reason);
  }

  // 10. ARCHIVE NOTICE
  @Patch(':id/archive')
  @Roles('FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN')
  archiveNotice(@Req() req: any, @Param('id') id: string) {
    const userRole = this.extractUserRole(req);
    return this.noticesService.archiveNotice(req.user.id, userRole, id);
  }

  // 11. DELETE NOTICE
  @Delete(':id')
  @Roles('FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN')
  deleteNotice(@Req() req: any, @Param('id') id: string) {
    const userRole = this.extractUserRole(req);
    return this.noticesService.deleteNotice(req.user.id, userRole, id);
  }

  // 12. NOTICE ANALYTICS
  @Get(':id/analytics')
  @Roles('FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN')
  getNoticeAnalytics(@Req() req: any, @Param('id') id: string) {
    const userRole = this.extractUserRole(req);
    return this.noticesService.getNoticeAnalytics(req.user.id, userRole, id);
  }

  // 13. ATTACHMENT: UPLOAD PDF
  @Post(':id/attachments')
  @Roles('FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userRole = this.extractUserRole(req);
    return this.noticesService.uploadAttachment(req.user.id, userRole, id, file);
  }

  // 14. ATTACHMENT: DELETE
  @Delete(':id/attachments/:attachmentId')
  @Roles('FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN')
  deleteAttachment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const userRole = this.extractUserRole(req);
    return this.noticesService.deleteAttachment(req.user.id, userRole, id, attachmentId);
  }

  // 15. ATTACHMENT: STREAM PDF PREVIEW / DOWNLOAD
  @Get(':id/attachments/:attachmentId/stream')
  async streamAttachment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const { stream, contentType, fileName, fileSize } =
      await this.noticesService.streamAttachment(req.user.id, id, attachmentId);

    res.set({
      'Content-Type': contentType || 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, max-age=3600',
    });

    if (fileSize) {
      res.set('Content-Length', String(fileSize));
    }

    (stream as any).pipe(res);
  }
}

