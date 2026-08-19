import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';

import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { CreateStudentAccountDto } from './dto/create-student-account.dto';

import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@ApiTags('Students')
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a student',
  })
  async createStudent(@Body() dto: CreateStudentDto) {
    return {
      success: true,
      message: 'Student created successfully.',
      data: await this.studentService.createStudent(dto),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all students',
  })
  async getAllStudents() {
    return {
      success: true,
      message: 'Students fetched successfully.',
      data: await this.studentService.getAllStudents(),
    };
  }

  @Get('college-id/:collegeId')
  @ApiOperation({
    summary: 'Get student by college ID',
  })
  async getStudentByCollegeId(@Param('collegeId') collegeId: string) {
    return {
      success: true,
      message: 'Student fetched successfully.',
      data: await this.studentService.getStudentByCollegeId(collegeId),
    };
  }

  @Get('roll-number/:rollNumber')
  @ApiOperation({
    summary: 'Get student by roll number',
  })
  async getStudentByRollNumber(@Param('rollNumber') rollNumber: string) {
    return {
      success: true,
      message: 'Student fetched successfully.',
      data: await this.studentService.getStudentByRollNumber(rollNumber),
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a student',
  })
  async updateStudent(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return {
      success: true,
      message: 'Student updated successfully.',
      data: await this.studentService.updateStudent(id, dto),
    };
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a student',
  })
  async deactivateStudent(@Param('id') id: string) {
    return {
      success: true,
      message: 'Student deactivated successfully.',
      data: await this.studentService.deactivateStudent(id),
    };
  }

  @Post('accounts')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a student account',
  })
  async createStudentAccount(@Body() dto: CreateStudentAccountDto) {
    return {
      success: true,
      message: 'Student account created successfully.',
      data: await this.studentService.createStudentAccount(dto),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get student by ID',
  })
  async getStudentById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Student fetched successfully.',
      data: await this.studentService.getStudentById(id),
    };
  }
}
