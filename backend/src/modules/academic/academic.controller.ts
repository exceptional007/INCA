import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AcademicService } from './academic.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateTimeSlotDto } from './dto/create-time-slot.dto';
import { UpdateTimeSlotDto } from './dto/update-time-slot.dto';

@ApiTags('Academic')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('academic/departments')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Post()
  @Roles('SUPER_ADMIN')
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
  @ApiOperation({
    summary: 'Get all departments',
  })
  async getAllDepartments(@Query('includeInactive') includeInactive?: string) {
    const shouldInclude = includeInactive === 'true';
    return {
      success: true,
      message: 'Departments fetched successfully.',
      data: await this.academicService.getAllDepartments(shouldInclude),
    };
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
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
  @Roles('SUPER_ADMIN')
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

  @Patch(':id/activate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Activate a department',
  })
  async activateDepartment(@Param('id') id: string) {
    return {
      success: true,
      message: 'Department activated successfully.',
      data: await this.academicService.activateDepartment(id),
    };
  }

  @Post('programs')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Create a program',
  })
  async createProgram(@Req() req: any, @Body() dto: CreateProgramDto) {
    return {
      success: true,
      message: 'Program created successfully.',
      data: await this.academicService.createProgram(
        dto,
        req.user?.role,
        req.user?.id,
      ),
    };
  }

  @Get('programs')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
  @ApiOperation({
    summary: 'Get all programs',
  })
  async getAllPrograms(
    @Req() req: any,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const shouldInclude = includeInactive === 'true';
    return {
      success: true,
      message: 'Programs fetched successfully.',
      data: await this.academicService.getAllPrograms(
        shouldInclude,
        req.user?.role,
        req.user?.id,
      ),
    };
  }

  @Get('programs/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get program by ID',
  })
  async getProgramById(@Req() req: any, @Param('id') id: string) {
    return {
      success: true,
      message: 'Program fetched successfully.',
      data: await this.academicService.getProgramById(
        id,
        req.user?.role,
        req.user?.id,
      ),
    };
  }

  @Patch('programs/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Update a program',
  })
  async updateProgram(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return {
      success: true,
      message: 'Program updated successfully.',
      data: await this.academicService.updateProgram(
        id,
        dto,
        req.user?.role,
        req.user?.id,
      ),
    };
  }

  @Patch('programs/:id/deactivate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Deactivate a program',
  })
  async deactivateProgram(@Req() req: any, @Param('id') id: string) {
    return {
      success: true,
      message: 'Program deactivated successfully.',
      data: await this.academicService.deactivateProgram(
        id,
        req.user?.role,
        req.user?.id,
      ),
    };
  }

  @Patch('programs/:id/activate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Activate a program',
  })
  async activateProgram(@Req() req: any, @Param('id') id: string) {
    return {
      success: true,
      message: 'Program activated successfully.',
      data: await this.academicService.activateProgram(
        id,
        req.user?.role,
        req.user?.id,
      ),
    };
  }

  @Delete('programs/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Delete or deactivate a program',
  })
  async deleteProgram(@Param('id') id: string) {
    return {
      success: true,
      message: 'Program deleted successfully.',
      data: await this.academicService.deleteProgram(id),
    };
  }

  @Post('semesters')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
  @ApiOperation({
    summary: 'Create a semester (Disabled - auto-generated with programs)',
  })
  async createSemester(@Body() dto: CreateSemesterDto) {
    return {
      success: true,
      message: 'Semester created successfully.',
      data: await this.academicService.createSemester(dto),
    };
  }

  @Get('semesters')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get all semesters',
  })
  async getAllSemesters(
    @Query('includeInactive') includeInactive?: string,
    @Query('programId') programId?: string,
  ) {
    return {
      success: true,
      message: 'Semesters fetched successfully.',
      data: await this.academicService.getAllSemesters(
        includeInactive === 'true',
        programId,
      ),
    };
  }

  @Get('semesters/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
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

  @Patch('semesters/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
  @ApiOperation({
    summary: 'Update a semester (Disabled)',
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
  @ApiOperation({
    summary: 'Deactivate a semester (Disabled)',
  })
  async deactivateSemester(@Param('id') id: string) {
    return {
      success: true,
      message: 'Semester deactivated successfully.',
      data: await this.academicService.deactivateSemester(id),
    };
  }

  @Post('sections')
  @Roles('ADMIN', 'HOD')
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get all sections',
  })
  async getAllSections(
    @Query('includeInactive') includeInactive?: string,
    @Query('semesterId') semesterId?: string,
  ) {
    return {
      success: true,
      message: 'Sections fetched successfully.',
      data: await this.academicService.getAllSections(
        includeInactive === 'true',
        semesterId,
      ),
    };
  }

  @Get('sections/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
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
  @Roles('ADMIN', 'HOD')
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
  @Roles('ADMIN', 'HOD')
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
  @Roles('SUPER_ADMIN')
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
  @ApiOperation({
    summary: 'Get all subjects',
  })
  async getAllSubjects(@Query('includeInactive') includeInactive?: string) {
    const shouldInclude = includeInactive === 'true';
    return {
      success: true,
      message: 'Subjects fetched successfully.',
      data: await this.academicService.getAllSubjects(shouldInclude),
    };
  }

  @Get('subjects/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
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
  @Roles('SUPER_ADMIN')
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

  @Patch('subjects/:id/deactivate')
  @Roles('SUPER_ADMIN')
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

  @Patch('subjects/:id/activate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Activate a subject',
  })
  async activateSubject(@Param('id') id: string) {
    return {
      success: true,
      message: 'Subject activated successfully.',
      data: await this.academicService.activateSubject(id),
    };
  }

  @Delete('subjects/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Delete a subject',
  })
  async deleteSubject(@Param('id') id: string) {
    return {
      success: true,
      message: 'Subject deactivated successfully.',
      data: await this.academicService.deactivateSubject(id),
    };
  }

  @Post('academic-sessions')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Create an academic session',
  })
  async createAcademicSession(@Body() dto: CreateAcademicSessionDto) {
    return {
      success: true,
      message: 'Academic session created successfully.',
      data: await this.academicService.createAcademicSession(dto),
    };
  }

  @Get('academic-sessions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get all academic sessions',
  })
  async getAllAcademicSessions() {
    return {
      success: true,
      message: 'Academic sessions fetched successfully.',
      data: await this.academicService.getAllAcademicSessions(),
    };
  }

  @Get('academic-sessions/active')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
  @ApiOperation({
    summary: 'Get active academic session',
  })
  async getActiveAcademicSession() {
    return {
      success: true,
      message: 'Active academic session fetched successfully.',
      data: await this.academicService.getActiveAcademicSession(),
    };
  }

  @Get('academic-sessions/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get academic session by ID',
  })
  async getAcademicSessionById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Academic session fetched successfully.',
      data: await this.academicService.getAcademicSessionById(id),
    };
  }

  @Patch('academic-sessions/:id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Update an academic session',
  })
  async updateAcademicSession(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicSessionDto,
  ) {
    return {
      success: true,
      message: 'Academic session updated successfully.',
      data: await this.academicService.updateAcademicSession(id, dto),
    };
  }

  @Patch('academic-sessions/:id/deactivate')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Deactivate an academic session',
  })
  async deactivateAcademicSession(@Param('id') id: string) {
    return {
      success: true,
      message: 'Academic session deactivated successfully.',
      data: await this.academicService.deactivateAcademicSession(id),
    };
  }

  @Patch('academic-sessions/:id/activate')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Activate an academic session',
  })
  async activateAcademicSession(@Param('id') id: string) {
    return {
      success: true,
      message: 'Academic session activated successfully.',
      data: await this.academicService.activateAcademicSession(id),
    };
  }

  @Post('rooms')
  @Roles('ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Create a room',
  })
  async createRoom(@Body() dto: CreateRoomDto) {
    return {
      success: true,
      message: 'Room created successfully.',
      data: await this.academicService.createRoom(dto),
    };
  }

  @Get('rooms')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get all rooms',
  })
  async getAllRooms() {
    return {
      success: true,
      message: 'Rooms fetched successfully.',
      data: await this.academicService.getAllRooms(),
    };
  }

  @Get('rooms/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get room by ID',
  })
  async getRoomById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Room fetched successfully.',
      data: await this.academicService.getRoomById(id),
    };
  }

  @Patch('rooms/:id')
  @Roles('ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Update a room',
  })
  async updateRoom(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return {
      success: true,
      message: 'Room updated successfully.',
      data: await this.academicService.updateRoom(id, dto),
    };
  }

  @Patch('rooms/:id/deactivate')
  @Roles('ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Deactivate a room',
  })
  async deactivateRoom(@Param('id') id: string) {
    return {
      success: true,
      message: 'Room deactivated successfully.',
      data: await this.academicService.deactivateRoom(id),
    };
  }

  @Post('time-slots')
  @Roles('ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Create a time slot',
  })
  async createTimeSlot(@Body() dto: CreateTimeSlotDto) {
    return {
      success: true,
      message: 'Time slot created successfully.',
      data: await this.academicService.createTimeSlot(dto),
    };
  }

  @Get('time-slots')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get all time slots',
  })
  async getAllTimeSlots() {
    return {
      success: true,
      message: 'Time slots fetched successfully.',
      data: await this.academicService.getAllTimeSlots(),
    };
  }

  @Get('time-slots/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get time slot by ID',
  })
  async getTimeSlotById(@Param('id') id: string) {
    return {
      success: true,
      message: 'Time slot fetched successfully.',
      data: await this.academicService.getTimeSlotById(id),
    };
  }

  @Patch('time-slots/:id')
  @Roles('ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Update a time slot',
  })
  async updateTimeSlot(
    @Param('id') id: string,
    @Body() dto: UpdateTimeSlotDto,
  ) {
    return {
      success: true,
      message: 'Time slot updated successfully.',
      data: await this.academicService.updateTimeSlot(id, dto),
    };
  }

  @Patch('time-slots/:id/deactivate')
  @Roles('ADMIN', 'HOD')
  @ApiOperation({
    summary: 'Deactivate a time slot',
  })
  async deactivateTimeSlot(@Param('id') id: string) {
    return {
      success: true,
      message: 'Time slot deactivated successfully.',
      data: await this.academicService.deactivateTimeSlot(id),
    };
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
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
}
