import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { RequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Requests')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new request' })
  async create(@Body() dto: { title: string; details: string; requester: string }) {
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
  @ApiOperation({ summary: 'Update a request status (approve/reject)' })
  async update(@Param('id') id: string, @Body() dto: { status: RequestStatus }) {
    return {
      success: true,
      message: 'Request updated successfully.',
      data: await this.requestsService.update(id, dto),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a request' })
  async remove(@Param('id') id: string) {
    await this.requestsService.remove(id);
    return {
      success: true,
      message: 'Request deleted successfully.',
    };
  }
}
