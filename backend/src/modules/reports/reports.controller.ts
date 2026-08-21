import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('student/:studentId')
  @ApiOperation({
    summary:
      'Student attendance report — overall % and per-subject breakdown',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-12-31' })
  getStudentReport(
    @Param('studentId') studentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getStudentReport(studentId, startDate, endDate);
  }

  @Get('section/:sectionId')
  @ApiOperation({
    summary:
      'Section attendance report — all students attendance % in a section',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-12-31' })
  getSectionReport(
    @Param('sectionId') sectionId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSectionReport(sectionId, startDate, endDate);
  }

  @Get('subject/:subjectId')
  @ApiOperation({
    summary:
      'Subject attendance report — per-student % with shortfall (<75%) flagging',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-12-31' })
  getSubjectReport(
    @Param('subjectId') subjectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSubjectReport(subjectId, startDate, endDate);
  }

  @Get('faculty/:facultyId')
  @ApiOperation({
    summary:
      'Faculty report — sessions conducted and students marked, grouped by subject',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-12-31' })
  getFacultyReport(
    @Param('facultyId') facultyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getFacultyReport(facultyId, startDate, endDate);
  }
}
