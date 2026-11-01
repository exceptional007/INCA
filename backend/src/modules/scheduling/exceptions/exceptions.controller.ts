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
import { ExceptionsService } from './exceptions.service';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { UpdateExceptionDto } from './dto/update-exception.dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ScheduleExceptionActor } from './exceptions.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Schedule Exceptions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedule-exceptions')
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Create a schedule exception (e.g. cancellation, room change)',
  })
  create(
    @Body() createExceptionDto: CreateExceptionDto,
    @CurrentUser() actor: ScheduleExceptionActor,
  ) {
    return this.exceptionsService.create(createExceptionDto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schedule exceptions' })
  findAll() {
    return this.exceptionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get schedule exception by ID' })
  findOne(@Param('id') id: string) {
    return this.exceptionsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a schedule exception' })
  update(
    @Param('id') id: string,
    @Body() updateExceptionDto: UpdateExceptionDto,
    @CurrentUser() actor: ScheduleExceptionActor,
  ) {
    return this.exceptionsService.update(id, updateExceptionDto, actor);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a schedule exception' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: ScheduleExceptionActor,
  ) {
    return this.exceptionsService.remove(id, actor);
  }
}
