import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AttendanceActor } from '../sessions/attendance-access.service';
import { OfflineAttendanceService } from './offline-attendance.service';

export class SyncAttendanceDto extends SubmitAttendanceDto {
  @ApiProperty({ description: 'Sorted student/status signature from the prepared session.' })
  @IsString()
  @MaxLength(200000)
  baseline: string;
}

@ApiTags('Attendance Records')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class OfflineAttendanceController {
  constructor(private readonly offline: OfflineAttendanceService) {}

  @Post('sessions/:sessionId/sync')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN')
  @ApiOperation({ summary: 'Atomically sync and lock a prepared lecture roster; exact retries are idempotent.' })
  sync(@Param('sessionId') sessionId: string, @Body() dto: SyncAttendanceDto, @CurrentUser() actor: AttendanceActor) {
    return this.offline.sync(sessionId, dto, actor);
  }
}
