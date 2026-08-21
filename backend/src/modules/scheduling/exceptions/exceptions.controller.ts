import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExceptionsService } from './exceptions.service';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { UpdateExceptionDto } from './dto/update-exception.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Schedule Exceptions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('schedule-exceptions')
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a schedule exception (e.g. cancellation, room change)' })
  create(@Body() createExceptionDto: CreateExceptionDto) {
    return this.exceptionsService.create(createExceptionDto);
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
  @ApiOperation({ summary: 'Update a schedule exception' })
  update(@Param('id') id: string, @Body() updateExceptionDto: UpdateExceptionDto) {
    return this.exceptionsService.update(id, updateExceptionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a schedule exception' })
  remove(@Param('id') id: string) {
    return this.exceptionsService.remove(id);
  }
}
