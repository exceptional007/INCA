import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ScheduleTemplateActor } from './templates.service';

@ApiTags('Schedule Templates')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedule-templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a schedule template' })
  create(@Body() createTemplateDto: CreateTemplateDto, @CurrentUser() actor: ScheduleTemplateActor) {
    return this.templatesService.create(createTemplateDto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schedule templates' })
  findAll() {
    return this.templatesService.findAll();
  }

  @Get('section/:sectionId')
  @ApiOperation({ summary: 'Get schedule templates by section' })
  findBySection(@Param('sectionId') sectionId: string) {
    return this.templatesService.findBySection(sectionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a schedule template by ID' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a schedule template' })
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto, @CurrentUser() actor: ScheduleTemplateActor) {
    return this.templatesService.update(id, updateTemplateDto, actor);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a schedule template' })
  remove(@Param('id') id: string, @CurrentUser() actor: ScheduleTemplateActor) {
    return this.templatesService.remove(id, actor);
  }
}
