import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { EditRecordDto } from './dto/edit-record.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Attendance Audit')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Patch('records/:id/edit')
  @ApiOperation({
    summary:
      'Edit a submitted attendance record (24-hour window only). Writes to audit log.',
  })
  editRecord(@Param('id') id: string, @Body() dto: EditRecordDto) {
    return this.auditService.editRecord(id, dto);
  }

  @Get('records/:id/audits')
  @ApiOperation({
    summary: 'Get full audit/change-log trail for an attendance record',
  })
  getAudits(@Param('id') id: string) {
    return this.auditService.getAuditsByRecord(id);
  }

  @Get('audits')
  @ApiOperation({ summary: 'Get all attendance audit logs (admin use)' })
  getAllAudits() {
    return this.auditService.getAllAudits();
  }
}
