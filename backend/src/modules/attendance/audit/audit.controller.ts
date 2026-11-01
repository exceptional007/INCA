import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { EditRecordDto } from './dto/edit-record.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AttendanceActor } from '../sessions/attendance-access.service';

@ApiTags('Attendance Audit')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Patch('records/:id/edit')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary:
      'Edit a submitted attendance record (24-hour window only). Writes to audit log.',
  })
  editRecord(@Param('id') id: string, @Body() dto: EditRecordDto, @CurrentUser() actor: AttendanceActor) {
    return this.auditService.editRecord(id, dto, actor);
  }

  @Get('records/:id/audits')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get full audit/change-log trail for an attendance record',
  })
  getAudits(@Param('id') id: string, @CurrentUser() actor: AttendanceActor) {
    return this.auditService.getAuditsByRecord(id, actor);
  }

  @Get('audits')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR')
  @ApiOperation({ summary: 'Get all attendance audit logs (admin use)' })
  getAllAudits(@CurrentUser() actor: AttendanceActor) {
    return this.auditService.getAllAudits(actor);
  }
}
