import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcademicService } from './academic.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Academic - Departments')
@ApiBearerAuth('JWT-auth')
@Controller('academic/departments')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a department',
  })
  async createDepartment(@Body() dto: CreateDepartmentDto) {
    return {
      success: true,
      message: 'Department created successfully.',
      data: await this.academicService.createDepartment(dto),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all departments',
  })
  async getAllDepartments() {
    return {
      success: true,
      message: 'Departments fetched successfully.',
      data: await this.academicService.getAllDepartments(),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get department by ID',
  })
  async getDepartmentById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Department fetched successfully.',
      data: await this.academicService.getDepartmentById(id),
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a department',
  })
  async updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return {
      success: true,
      message: 'Department updated successfully.',
      data: await this.academicService.updateDepartment(id, dto),
    };
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a department',
  })
  async deactivateDepartment(@Param('id') id: string) {
    return {
      success: true,
      message: 'Department deactivated successfully.',
      data: await this.academicService.deactivateDepartment(id),
    };
  }
}
