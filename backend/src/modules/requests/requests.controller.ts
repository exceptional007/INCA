import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { RequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';

@ApiTags('Requests')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new request' })
  async create(@Body() dto: CreateRequestDto) {
    return {
      success: true,
      message: 'Request created successfully.',
      data: await this.requestsService.create(dto),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all requests' })
  async findAll(@Query('status') status?: RequestStatus) {
    return {
      success: true,
      message: 'Requests fetched successfully.',
      data: await this.requestsService.findAll(status),
    };
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({ summary: 'Update a request status (approve/reject)' })
  async update(@Param('id') id: string, @Body() dto: UpdateRequestStatusDto) {
    return {
      success: true,
      message: 'Request updated successfully.',
      data: await this.requestsService.update(id, dto),
    };
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({ summary: 'Delete a request' })
  async remove(@Param('id') id: string) {
    await this.requestsService.remove(id);
    return {
      success: true,
      message: 'Request deleted successfully.',
    };
  }
}
