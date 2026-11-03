import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { LateAttendanceService } from './late-attendance.service';
import type { AttendanceActor } from './attendance-access.service';
export class LateRequestDto {
  @IsUUID() scheduleId: string;
  @IsString() @MinLength(3) @MaxLength(2000) reason: string;
}
export class LateDecisionDto {
  @IsEnum({ APPROVED: 'APPROVED', REJECTED: 'REJECTED' }) decision:
    'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(2000) remark?: string;
}
@Controller('attendance/late-requests')
@ApiTags('Late attendance approvals')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LateAttendanceController {
  constructor(private readonly service: LateAttendanceService) {}
  @Post() @Roles('FACULTY') create(
    @CurrentUser() actor: AttendanceActor,
    @Body() dto: LateRequestDto,
  ) {
    return this.service.create(actor.id, dto.scheduleId, dto.reason);
  }
  @Get('mine') @Roles('FACULTY') mine(@CurrentUser() actor: AttendanceActor) {
    return this.service.mine(actor.id);
  }
  @Get('queue') @Roles('ADMIN', 'HOD') queue(
    @CurrentUser() actor: AttendanceActor,
  ) {
    return this.service.queue(actor.id);
  }
  @Post(':id/review') @Roles('ADMIN', 'HOD') review(
    @CurrentUser() actor: AttendanceActor,
    @Param('id') id: string,
    @Body() dto: LateDecisionDto,
  ) {
    return this.service.review(actor.id, id, dto.decision, dto.remark);
  }
  @Post(':id/cancel') @Roles('FACULTY') cancel(
    @CurrentUser() actor: AttendanceActor,
    @Param('id') id: string,
  ) {
    return this.service.cancel(actor.id, id);
  }
}
