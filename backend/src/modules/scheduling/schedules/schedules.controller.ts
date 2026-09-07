import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Schedules')
@ApiBearerAuth('JWT-auth')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a specific schedule' })
  create(@Body() createScheduleDto: CreateScheduleDto) {
    return this.schedulesService.create(createScheduleDto);
  }

  @Post('generate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Generate semester schedules from templates' })
  generate(@Body() generateDto: GenerateScheduleDto) {
    return this.schedulesService.generate(generateDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'FACULTY', 'SUPER_ADMIN', 'STUDENT')
  @ApiOperation({ summary: 'Get all schedules' })
  findAll(@Req() req: any, @Query('facultyId') facultyIdQuery?: string) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.schedulesService.findAll(req.user?.id, userRole, facultyIdQuery);
  }

  @Get('today')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'FACULTY', 'SUPER_ADMIN', 'STUDENT')
  @ApiOperation({ summary: 'Get today\'s schedules' })
  getTodaySchedules(@Req() req: any, @Query('facultyId') facultyIdQuery?: string) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.schedulesService.getTodaySchedules(req.user?.id, userRole, facultyIdQuery);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'FACULTY', 'SUPER_ADMIN', 'STUDENT')
  @ApiOperation({ summary: 'Get schedule by ID' })
  findOne(@Param('id') id: string) {
    return this.schedulesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a schedule' })
  update(@Param('id') id: string, @Body() updateScheduleDto: UpdateScheduleDto) {
    return this.schedulesService.update(id, updateScheduleDto);
  }
}
