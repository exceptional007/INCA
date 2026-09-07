import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TimetableImportService } from './timetable-import.service';
import { CreateDraftSlotDto } from './dto/create-draft-slot.dto';
import { UpdateDraftSlotDto } from './dto/update-draft-slot.dto';
import { ApproveBatchDto } from './dto/approve-batch.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('admin/timetable-imports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class TimetableImportController {
  constructor(private readonly importService: TimetableImportService) {}

  @Get()
  async getAllBatches() {
    const batches = await this.importService.getAllBatches();
    return {
      success: true,
      message: 'All timetable import batches retrieved.',
      data: batches,
    };
  }

  @Get('active-configurations')
  @Roles('ADMIN', 'SUPER_ADMIN', 'FACULTY')
  async getActiveConfigurations() {
    const data = await this.importService.getActiveConfigurations();
    return {
      success: true,
      message: 'Active timetable configurations retrieved successfully.',
      data,
    };
  }

  @Post()
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTimetable(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    const result = await this.importService.uploadAndProcess(
      file.buffer,
      file.originalname,
      user.id,
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  async getBatchDetails(@Param('id') id: string) {
    const details = await this.importService.getBatchDetails(id);
    return {
      success: true,
      message: 'Batch details retrieved.',
      data: details,
    };
  }

  @Patch(':id/slots/:slotId')
  @Roles('ADMIN')
  async updateDraftSlot(
    @Param('id') id: string,
    @Param('slotId') slotId: string,
    @Body() dto: UpdateDraftSlotDto,
  ) {
    const slot = await this.importService.updateDraftSlot(id, slotId, dto);
    return {
      success: true,
      message: 'Draft slot updated successfully.',
      data: slot,
    };
  }

  @Post(':id/slots')
  @Roles('ADMIN')
  async addDraftSlot(
    @Param('id') id: string,
    @Body() dto: CreateDraftSlotDto,
  ) {
    const slot = await this.importService.addDraftSlot(id, dto);
    return {
      success: true,
      message: 'Draft slot added manually.',
      data: slot,
    };
  }

  @Delete(':id/slots/:slotId')
  @Roles('ADMIN')
  async removeDraftSlot(
    @Param('id') id: string,
    @Param('slotId') slotId: string,
  ) {
    await this.importService.removeDraftSlot(id, slotId);
    return {
      success: true,
      message: 'Draft slot deleted successfully.',
    };
  }

  @Post(':id/approve')
  @Roles('ADMIN')
  async approveAndCommit(
    @Param('id') id: string,
    @Body() dto?: ApproveBatchDto,
  ) {
    const result = await this.importService.approveAndCommit(id, dto?.programId);
    return result;
  }

  @Post(':id/discard')
  @Roles('ADMIN')
  async discardBatch(@Param('id') id: string) {
    await this.importService.discardBatch(id);
    return {
      success: true,
      message: 'Timetable import batch discarded.',
    };
  }

  @Get('sections/:sectionId/versions')
  async getVersionHistory(@Param('sectionId') sectionId: string) {
    const history = await this.importService.getVersionHistory(sectionId);
    return {
      success: true,
      message: 'Version history retrieved successfully.',
      data: history,
    };
  }

  @Post('versions/:versionId/rollback')
  @Roles('ADMIN')
  async rollbackVersion(@Param('versionId') versionId: string) {
    const result = await this.importService.rollbackVersion(versionId);
    return {
      success: true,
      message: 'Timetable version successfully rolled back.',
      data: result,
    };
  }

  @Post('sync-schedules')
  @Roles('ADMIN')
  async syncTimetableSchedules(
    @Body() body?: { versionId?: string; startDate?: string; endDate?: string },
  ) {
    const result = await this.importService.syncTimetableToSchedules(
      body?.versionId,
      body?.startDate,
      body?.endDate,
    );
    return result;
  }

  @Post('test-lecture-session')
  @Roles('ADMIN', 'SUPER_ADMIN', 'FACULTY')
  async createTestLectureSession(
    @Body() body: { slotId?: string; scheduleId?: string; sectionId?: string },
  ) {
    const result = await this.importService.createTestLectureSession(body);
    return result;
  }

  @Get('check-section/:sectionId')
  @Get('sections/:sectionId/check')
  async checkSectionTimetable(@Param('sectionId') sectionId: string) {
    const result = await this.importService.checkSectionTimetable(sectionId);
    return {
      success: true,
      ...result,
    };
  }

  @Get('active-section/:sectionId')
  async getActiveSectionTimetable(@Param('sectionId') sectionId: string) {
    const data = await this.importService.getActiveSectionTimetable(sectionId);
    return {
      success: true,
      message: 'Active section timetable retrieved successfully.',
      data,
    };
  }

  @Post('active-versions/:versionId/slots')
  @Roles('ADMIN')
  async addActiveSlot(
    @Param('versionId') versionId: string,
    @Body() dto: any,
  ) {
    const slot = await this.importService.addActiveSlot(versionId, dto);
    return {
      success: true,
      message: 'Active slot created successfully.',
      data: slot,
    };
  }

  @Patch('active-slots/:slotId')
  @Roles('ADMIN')
  async updateActiveSlot(
    @Param('slotId') slotId: string,
    @Body() dto: any,
  ) {
    const slot = await this.importService.updateActiveSlot(slotId, dto);
    return {
      success: true,
      message: 'Active slot updated successfully.',
      data: slot,
    };
  }

  @Delete('active-slots/:slotId')
  @Roles('ADMIN')
  async deleteActiveSlot(@Param('slotId') slotId: string) {
    await this.importService.deleteActiveSlot(slotId);
    return {
      success: true,
      message: 'Active slot deleted successfully.',
    };
  }

  @Get('files/:key')
  async getFile(@Param('key') key: string, @Res() res: any) {
    const buffer = await this.importService.getFileBuffer(key);
    const contentType = key.endsWith('.png') ? 'image/png' : 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  }
}
