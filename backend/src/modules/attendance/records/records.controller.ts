import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RecordsService } from './records.service';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AttendanceActor } from '../sessions/attendance-access.service';

@ApiTags('Attendance Records')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post('sessions/:sessionId/records')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary:
      'Bulk-submit attendance records for an open session (idempotent — safe to call multiple times)',
  })
  submitRecords(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitAttendanceDto,
    @CurrentUser() actor: AttendanceActor,
  ) {
    return this.recordsService.submitRecords(sessionId, dto, actor);
  }

  @Get('sessions/:sessionId/records')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({ summary: 'Get all attendance records for a session' })
  getRecords(@Param('sessionId') sessionId: string, @CurrentUser() actor: AttendanceActor) {
    return this.recordsService.getRecordsBySession(sessionId, actor);
  }

  @Get('records/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({ summary: 'Get a single attendance record by ID (with audit trail)' })
  findOne(@Param('id') id: string, @CurrentUser() actor: AttendanceActor) {
    return this.recordsService.findOneRecord(id, actor);
  }
}
