import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { FacultyService } from './faculty.service';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';

import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { CreateFacultyAccountDto } from './dto/create-faculty-account.dto';

@ApiTags('Faculty')
@Controller('faculty')
export class FacultyController {
  constructor(private readonly facultyService: FacultyService) {}

  @Post('accounts')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a faculty account',
  })
  async createFacultyAccount(@Body() dto: CreateFacultyAccountDto) {
    return {
      success: true,
      message: 'Faculty account created successfully.',
      data: await this.facultyService.createFacultyAccount(dto),
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Create a faculty profile',
  })
  async createFaculty(@Body() dto: CreateFacultyDto) {
    return {
      success: true,
      message: 'Faculty created successfully.',
      data: await this.facultyService.createFaculty(dto),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all faculty',
  })
  async getAllFaculty() {
    return {
      success: true,
      message: 'Faculty fetched successfully.',
      data: await this.facultyService.getAllFaculty(),
    };
  }

  @Get('employee-code/:employeeCode')
  @ApiOperation({
    summary: 'Get faculty by employee code',
  })
  async getFacultyByEmployeeCode(@Param('employeeCode') employeeCode: string) {
    return {
      success: true,
      message: 'Faculty fetched successfully.',
      data: await this.facultyService.getFacultyByEmployeeCode(employeeCode),
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a faculty member',
  })
  async updateFaculty(@Param('id') id: string, @Body() dto: UpdateFacultyDto) {
    return {
      success: true,
      message: 'Faculty updated successfully.',
      data: await this.facultyService.updateFaculty(id, dto),
    };
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a faculty member',
  })
  async deactivateFaculty(@Param('id') id: string) {
    return {
      success: true,
      message: 'Faculty deactivated successfully.',
      data: await this.facultyService.deactivateFaculty(id),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get faculty by ID',
  })
  async getFacultyById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Faculty fetched successfully.',
      data: await this.facultyService.getFacultyById(id),
    };
  }
}
