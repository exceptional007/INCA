import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcademicService } from './academic.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

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

  @Post('batches')
  @ApiOperation({
    summary: 'Create a batch',
  })
  async createBatch(@Body() dto: CreateBatchDto) {
    return {
      success: true,
      message: 'Batch created successfully.',
      data: await this.academicService.createBatch(dto),
    };
  }

  @Get('batches')
  @ApiOperation({
    summary: 'Get all batches',
  })
  async getAllBatches() {
    return {
      success: true,
      message: 'Batches fetched successfully.',
      data: await this.academicService.getAllBatches(),
    };
  }

  @Get('batches/:id')
  @ApiOperation({
    summary: 'Get batch by ID',
  })
  async getBatchById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Batch fetched successfully.',
      data: await this.academicService.getBatchById(id),
    };
  }
  @Post('semesters')
  @ApiOperation({
    summary: 'Create a semester',
  })
  async createSemester(@Body() dto: CreateSemesterDto) {
    return {
      success: true,
      message: 'Semester created successfully.',
      data: await this.academicService.createSemester(dto),
    };
  }

  @Get('semesters')
  @ApiOperation({
    summary: 'Get all semesters',
  })
  async getAllSemesters() {
    return {
      success: true,
      message: 'Semesters fetched successfully.',
      data: await this.academicService.getAllSemesters(),
    };
  }

  @Get('semesters/:id')
  @ApiOperation({
    summary: 'Get semester by ID',
  })
  async getSemesterById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Semester fetched successfully.',
      data: await this.academicService.getSemesterById(id),
    };
  }

  @Patch('batches/:id')
  @ApiOperation({
    summary: 'Update a batch',
  })
  async updateBatch(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return {
      success: true,
      message: 'Batch updated successfully.',
      data: await this.academicService.updateBatch(id, dto),
    };
  }

  @Patch('batches/:id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a batch',
  })
  async deactivateBatch(@Param('id') id: string) {
    return {
      success: true,
      message: 'Batch deactivated successfully.',
      data: await this.academicService.deactivateBatch(id),
    };
  }

  @Patch('semesters/:id')
  @ApiOperation({
    summary: 'Update a semester',
  })
  async updateSemester(
    @Param('id') id: string,
    @Body() dto: UpdateSemesterDto,
  ) {
    return {
      success: true,
      message: 'Semester updated successfully.',
      data: await this.academicService.updateSemester(id, dto),
    };
  }

  @Patch('semesters/:id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a semester',
  })
  async deactivateSemester(@Param('id') id: string) {
    return {
      success: true,
      message: 'Semester deactivated successfully.',
      data: await this.academicService.deactivateSemester(id),
    };
  }

  @Post('sections')
  @ApiOperation({
    summary: 'Create a section',
  })
  async createSection(@Body() dto: CreateSectionDto) {
    return {
      success: true,
      message: 'Section created successfully.',
      data: await this.academicService.createSection(dto),
    };
  }

  @Get('sections')
  @ApiOperation({
    summary: 'Get all sections',
  })
  async getAllSections() {
    return {
      success: true,
      message: 'Sections fetched successfully.',
      data: await this.academicService.getAllSections(),
    };
  }

  @Get('sections/:id')
  @ApiOperation({
    summary: 'Get section by ID',
  })
  async getSectionById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Section fetched successfully.',
      data: await this.academicService.getSectionById(id),
    };
  }

  @Patch('sections/:id')
  @ApiOperation({
    summary: 'Update a section',
  })
  async updateSection(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return {
      success: true,
      message: 'Section updated successfully.',
      data: await this.academicService.updateSection(id, dto),
    };
  }

  @Patch('sections/:id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a section',
  })
  async deactivateSection(@Param('id') id: string) {
    return {
      success: true,
      message: 'Section deactivated successfully.',
      data: await this.academicService.deactivateSection(id),
    };
  }

  @Post('subjects')
  @ApiOperation({
    summary: 'Create a subject',
  })
  async createSubject(@Body() dto: CreateSubjectDto) {
    return {
      success: true,
      message: 'Subject created successfully.',
      data: await this.academicService.createSubject(dto),
    };
  }

  @Get('subjects')
  @ApiOperation({
    summary: 'Get all subjects',
  })
  async getAllSubjects() {
    return {
      success: true,
      message: 'Subjects fetched successfully.',
      data: await this.academicService.getAllSubjects(),
    };
  }

  @Get('subjects/:id')
  @ApiOperation({
    summary: 'Get subject by ID',
  })
  async getSubjectById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Subject fetched successfully.',
      data: await this.academicService.getSubjectById(id),
    };
  }

  @Patch('subjects/:id')
  @ApiOperation({
    summary: 'Update a subject',
  })
  async updateSubject(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return {
      success: true,
      message: 'Subject updated successfully.',
      data: await this.academicService.updateSubject(id, dto),
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

  @Patch('subjects/:id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a subject',
  })
  async deactivateSubject(@Param('id') id: string) {
    return {
      success: true,
      message: 'Subject deactivated successfully.',
      data: await this.academicService.deactivateSubject(id),
    };
  }
}
