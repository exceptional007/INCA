import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AttendanceActor } from './attendance-access.service';

@ApiTags('Attendance Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary:
      'Open a new attendance session for a scheduled lecture or activity',
  })
  create(@Body() dto: CreateSessionDto, @CurrentUser() actor: AttendanceActor) {
    return this.sessionsService.create(dto, actor);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY')
  @ApiOperation({ summary: 'Get all attendance sessions' })
  findAll(@CurrentUser() actor: AttendanceActor) {
    return this.sessionsService.findAll(actor);
  }

  @Get('today')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY')
  @ApiOperation({ summary: "Get today's attendance sessions" })
  findToday(@CurrentUser() actor: AttendanceActor) {
    return this.sessionsService.findToday(actor);
  }

  @Get('my-sessions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY')
  @ApiOperation({ summary: "Get current authenticated faculty's attendance sessions" })
  findMySessions(@CurrentUser() actor: AttendanceActor) {
    return this.sessionsService.findForUser(actor);
  }

  @Get('faculty/:facultyId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY')
  @ApiOperation({ summary: 'Get all sessions taken by a specific faculty' })
  findByFaculty(@Param('facultyId') facultyId: string, @CurrentUser() actor: AttendanceActor) {
    return this.sessionsService.findByFaculty(facultyId, actor);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY')
  @ApiOperation({ summary: 'Get a single attendance session with all records' })
  findOne(@Param('id') id: string, @CurrentUser() actor: AttendanceActor) {
    return this.sessionsService.findOne(id, actor);
  }

  @Get(':id/roster')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY')
  @ApiOperation({ summary: 'Get active students enrolled in the lecture section' })
  getRoster(@Param('id') id: string, @CurrentUser() actor: AttendanceActor) {
    return this.sessionsService.getRoster(id, actor);
  }

  @Patch(':id/submit')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary: 'Submit and lock an attendance session (no more edits without audit)',
  })
  submit(@Param('id') id: string, @CurrentUser() actor: AttendanceActor) {
    return this.sessionsService.submitSession(id, actor);
  }
}
