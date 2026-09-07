import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CreateStudentAccountDto } from './dto/create-student-account.dto';

import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Students')
@ApiBearerAuth('JWT-auth')
@Controller('students')
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
  @ApiOperation({
    summary: 'Get all students',
  })
  async getAllStudents(@Query('includeInactive') includeInactive?: string) {
    const shouldInclude = includeInactive === 'true';
    return {
      success: true,
      message: 'Students fetched successfully.',
      data: await this.studentService.getAllStudents(shouldInclude),
    };
  }

  @Get('college-id/:collegeId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
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

  @Post('upload-photo')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload student photo to R2 (ADMIN only)',
  })
  async uploadPhoto(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPG, PNG, and WebP images are allowed.');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds the 5MB limit.');
    }

    const result = await this.studentService.uploadPhoto(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    return {
      success: true,
      message: 'Photo uploaded to R2 successfully.',
      data: result,
    };
  }

  @Get('photo/stream')
  @ApiOperation({
    summary: 'Stream student profile photo or fallback R2 placeholder',
  })
  async getPhotoStream(
    @Query('key') key: string,
    @Res() res: any,
  ) {
    const { stream, contentType } = await this.studentService.getPhotoStream(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Update a student',
  })
  async updateStudent(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @Req() req: any,
  ) {
    const userRole = req.user?.role?.code || req.user?.role;

    if (dto.photoKey !== undefined && userRole !== 'ADMIN') {
      throw new ForbiddenException('Changing a student photo is restricted to ADMIN accounts only.');
    }

    return {
      success: true,
      message: 'Student updated successfully.',
      data: await this.studentService.updateStudent(id, dto),
    };
  }

  @Patch(':id/photo')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update student photo (ADMIN only)',
  })
  async updateStudentPhoto(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPG, PNG, and WebP images are allowed.');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds the 5MB limit.');
    }

    const { photoKey } = await this.studentService.uploadPhoto(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    const updated = await this.studentService.updateStudent(id, { photoKey });

    return {
      success: true,
      message: 'Student photo updated successfully.',
      data: updated,
    };
  }

  @Patch(':id/deactivate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
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

  @Patch(':id/activate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Activate a student',
  })
  async activateStudent(@Param('id') id: string) {
    return {
      success: true,
      message: 'Student activated successfully.',
      data: await this.studentService.activateStudent(id),
    };
  }

  @Post('accounts')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Create a student account',
  })
  async createStudentAccount(
    @Body() dto: CreateStudentAccountDto,
  ) {
    return {
      success: true,
      message: 'Student account created successfully.',
      data: await this.studentService.createStudentAccount(dto),
    };
  }

  @Get('my/attendance-summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('STUDENT')
  @ApiOperation({
    summary: 'Get current student\'s attendance summary and history',
  })
  async getMyAttendanceSummary(@Req() req: any) {
    const userRole = req.user?.role?.code || req.user?.role;
    const summary = await this.studentService.getAttendanceSummary(req.user?.id, userRole);
    return {
      success: true,
      message: 'Attendance summary retrieved successfully.',
      data: summary,
    };
  }

  @Get('academic/notices')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
  @ApiOperation({
    summary: 'Get academic notices',
  })
  async getAcademicNotices(@Req() req: any) {
    const userRole = req.user?.role?.code || req.user?.role;
    const notices = await this.studentService.getAcademicNotices(req.user?.id, userRole);
    return {
      success: true,
      message: 'Academic notices retrieved successfully.',
      data: notices,
    };
  }

  @Get(':id/attendance-summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'HOD', 'FACULTY', 'COORDINATOR', 'STUDENT')
  @ApiOperation({
    summary: 'Get attendance summary for a specific student ID',
  })
  async getStudentAttendanceSummary(@Param('id') id: string, @Req() req: any) {
    const userRole = req.user?.role?.code || req.user?.role;
    const summary = await this.studentService.getAttendanceSummary(req.user?.id, userRole, id);
    return {
      success: true,
      message: 'Attendance summary retrieved successfully.',
      data: summary,
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'HOD', 'FACULTY', 'COORDINATOR')
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
