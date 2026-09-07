import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Attendance Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('attendance/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Open a new attendance session for a scheduled lecture or activity',
  })
  create(@Body() dto: CreateSessionDto) {
    return this.sessionsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all attendance sessions' })
  findAll() {
    return this.sessionsService.findAll();
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's attendance sessions" })
  findToday() {
    return this.sessionsService.findToday();
  }

  @Get('my-sessions')
  @ApiOperation({ summary: "Get current authenticated faculty's attendance sessions" })
  findMySessions(@Req() req: any) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.sessionsService.findForUser(req.user?.id, userRole);
  }

  @Get('faculty/:facultyId')
  @ApiOperation({ summary: 'Get all sessions taken by a specific faculty' })
  findByFaculty(@Param('facultyId') facultyId: string) {
    return this.sessionsService.findByFaculty(facultyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single attendance session with all records' })
  findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Patch(':id/submit')
  @ApiOperation({
    summary: 'Submit and lock an attendance session (no more edits without audit)',
  })
  submit(@Param('id') id: string) {
    return this.sessionsService.submitSession(id);
  }
}
