import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Activities')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  // ─── Activity Types ───────────────────────────────────────────────────────

  @Post('types')
  @ApiOperation({ summary: 'Create an activity type (e.g. Guest Lecture, Workshop)' })
  createType(@Body() dto: CreateActivityTypeDto) {
    return this.activitiesService.createActivityType(dto);
  }

  @Get('types')
  @ApiOperation({ summary: 'Get all activity types' })
  findAllTypes() {
    return this.activitiesService.findAllActivityTypes();
  }

  @Get('types/:id')
  @ApiOperation({ summary: 'Get an activity type by ID' })
  findOneType(@Param('id') id: string) {
    return this.activitiesService.findOneActivityType(id);
  }

  @Patch('types/:id')
  @ApiOperation({ summary: 'Update an activity type' })
  updateType(@Param('id') id: string, @Body() dto: UpdateActivityTypeDto) {
    return this.activitiesService.updateActivityType(id, dto);
  }

  @Delete('types/:id')
  @ApiOperation({ summary: 'Delete an activity type (only if no activities are linked)' })
  removeType(@Param('id') id: string) {
    return this.activitiesService.removeActivityType(id);
  }

  // ─── Activities ───────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new activity (event)' })
  create(@Body() dto: CreateActivityDto) {
    return this.activitiesService.createActivity(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all activities' })
  findAll() {
    return this.activitiesService.findAllActivities();
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get all upcoming activities (startTime >= now)' })
  findUpcoming() {
    return this.activitiesService.findUpcomingActivities();
  }

  @Get('faculty/:facultyId')
  @ApiOperation({ summary: 'Get all activities organised by a specific faculty' })
  findByFaculty(@Param('facultyId') facultyId: string) {
    return this.activitiesService.findActivitiesByFaculty(facultyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an activity by ID' })
  findOne(@Param('id') id: string) {
    return this.activitiesService.findOneActivity(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an activity' })
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activitiesService.updateActivity(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an activity' })
  remove(@Param('id') id: string) {
    return this.activitiesService.removeActivity(id);
  }
}
