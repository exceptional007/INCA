import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('filter-options')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR')
  @ApiOperation({
    summary:
      'Get cascading filter options for academic reports (departments, programs, semesters, sections, subjects, faculty, students)',
  })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'semesterId', required: false })
  getFilterOptions(
    @Query('departmentId') departmentId?: string,
    @Query('programId') programId?: string,
    @Query('semesterId') semesterId?: string,
  ) {
    return this.reportsService.getFilterOptions(
      departmentId,
      programId,
      semesterId,
    );
  }

  @Get('analytics/overview')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({
    summary:
      'Institutional overview metrics, attendance trends, department comparisons, and shortfall student count',
  })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-12-31' })
  getInstitutionalOverview(
    @Query('departmentId') departmentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getInstitutionalOverview(
      departmentId,
      startDate,
      endDate,
    );
  }

  @Get('export/csv')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR')
  @ApiOperation({
    summary:
      'Export institutional analytics, student, subject, section, or faculty reports as CSV with formula-injection protection',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['overview', 'student', 'subject', 'section', 'faculty'],
  })
  @ApiQuery({ name: 'targetId', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportReportCsv(
    @Res() res: Response,
    @Query('type') type: string,
    @Query('targetId') targetId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { filename, csv } = await this.reportsService.exportReportCsv(
      type,
      targetId,
      departmentId,
      startDate,
      endDate,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    return res.status(200).send(csv);
  }

  @Get('dashboard/admin')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Get department-scoped aggregate metrics for Admin & HOD dashboard',
  })
  @ApiQuery({ name: 'departmentId', required: false })
  getAdminDashboardSummary(
    @Req() req: any,
    @Query('departmentId') departmentId?: string,
  ) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.reportsService.getAdminDashboardSummary(
      req.user?.id,
      userRole,
      departmentId,
    );
  }

  @Get('dashboard/coordinator')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get section-scoped metrics and shortfalls for Coordinator dashboard',
  })
  @ApiQuery({ name: 'sectionId', required: false })
  getCoordinatorDashboardSummary(
    @Req() req: any,
    @Query('sectionId') sectionId?: string,
  ) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.reportsService.getCoordinatorDashboardSummary(
      req.user?.id,
      userRole,
      sectionId,
    );
  }

  @Get('student/:studentId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY')
  @ApiOperation({
    summary:
      'Student attendance report — overall %, subject breakdown, and session history',
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY')
  @ApiOperation({
    summary:
      'Section attendance report — section stats, subject breakdown, and student roster',
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY')
  @ApiOperation({
    summary:
      'Subject attendance report — section breakdown, distribution, and student roster with shortfall flagging',
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({
    summary:
      'Faculty report — sessions conducted, students marked, and subject breakdown',
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

