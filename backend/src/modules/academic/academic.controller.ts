import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcademicService } from './academic.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

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

  @Post('programs')
  @ApiOperation({
    summary: 'Create a program',
  })
  async createProgram(@Body() dto: CreateProgramDto) {
    return {
      success: true,
      message: 'Program created successfully.',
      data: await this.academicService.createProgram(dto),
    };
  }

  @Get('programs')
  @ApiOperation({
    summary: 'Get all programs',
  })
  async getAllPrograms() {
    return {
      success: true,
      message: 'Programs fetched successfully.',
      data: await this.academicService.getAllPrograms(),
    };
  }

  @Get('programs/:id')
  @ApiOperation({
    summary: 'Get program by ID',
  })
  async getProgramById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Program fetched successfully.',
      data: await this.academicService.getProgramById(id),
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

  @Patch('programs/:id')
  @ApiOperation({
    summary: 'Update a program',
  })
  async updateProgram(@Param('id') id: string, @Body() dto: UpdateProgramDto) {
    return {
      success: true,
      message: 'Program updated successfully.',
      data: await this.academicService.updateProgram(id, dto),
    };
  }
  
  @Patch('programs/:id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a program',
  })
  async deactivateProgram(@Param('id') id: string) {
    return {
      success: true,
      message: 'Program deactivated successfully.',
      data: await this.academicService.deactivateProgram(id),
    };
  }
}
