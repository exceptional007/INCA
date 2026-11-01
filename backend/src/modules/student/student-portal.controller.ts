import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StudentPortalService } from './student-portal.service';
import { AttendanceObjectionsService } from './attendance-objections.service';
import {
  CreateAttendanceObjectionDto,
  ReviewAttendanceObjectionDto,
  StudentAttendanceFilterDto,
  StudentDateDto,
} from './dto/student-portal.dto';

@ApiTags('Student portal')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('STUDENT')
@Controller('student-portal')
export class StudentPortalController {
  constructor(
    private readonly portal: StudentPortalService,
    private readonly objections: AttendanceObjectionsService,
  ) {}
  @Get('context') context(@Req() req: any) {
    return this.portal.context(req.user.id);
  }
  @Get('timetable') timetable(@Req() req: any, @Query() query: StudentDateDto) {
    return this.portal.timetable(req.user.id, query.date);
  }
  @Get('attendance') attendance(
    @Req() req: any,
    @Query() query: StudentAttendanceFilterDto,
  ) {
    return this.portal.attendance(req.user.id, query);
  }
  @Get('objections') own(@Req() req: any) {
    return this.objections.own(req.user.id);
  }
  @Post('objections') create(
    @Req() req: any,
    @Body() dto: CreateAttendanceObjectionDto,
  ) {
    return this.objections.create(req.user.id, dto);
  }
}
@ApiTags('Attendance objections')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN', 'HOD')
@Controller('attendance/objections')
export class AttendanceObjectionsController {
  constructor(private readonly objections: AttendanceObjectionsService) {}
  @Get() queue(@Req() req: any) {
    return this.objections.queue(req.user.id);
  }
  @Post(':id/review') review(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewAttendanceObjectionDto,
  ) {
    return this.objections.review(req.user.id, id, dto);
  }
}
