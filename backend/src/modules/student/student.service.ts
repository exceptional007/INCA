import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentAccountDto } from './dto/create-student-account.dto';
import * as bcrypt from 'bcrypt';
import { StudentRepository } from './repositories/student.repository';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

import { StrictR2StorageService } from '../storage/strict-r2-storage.service';

@Injectable()
export class StudentService {
  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly prisma: PrismaService,
    private readonly strictR2StorageService: StrictR2StorageService,
  ) {}

  async createStudentAccount(dto: CreateStudentAccountDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const existingCollegeId = await this.studentRepository.findByCollegeId(
      dto.collegeId,
    );

    if (existingCollegeId) {
      throw new ConflictException('College ID already exists.');
    }

    const existingRollNumber = await this.studentRepository.findByRollNumber(
      dto.rollNumber,
    );

    if (existingRollNumber) {
      throw new ConflictException('Roll number already exists.');
    }

    const existingEnrollmentNumber =
      await this.studentRepository.findByEnrollmentNumber(dto.enrollmentNumber);

    if (existingEnrollmentNumber) {
      throw new ConflictException('Enrollment number already exists.');
    }

    const studentRole = await this.prisma.role.findUnique({
      where: {
        code: 'STUDENT',
      },
    });

    if (!studentRole) {
      throw new NotFoundException('STUDENT role not found.');
    }

    if (!studentRole.isActive) {
      throw new ConflictException('STUDENT role is inactive.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined;

    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            password: hashedPassword,
            roleId: studentRole.id,
            mustChangePassword: true,
          },
        });

        const student = await tx.student.create({
          data: {
            userId: user.id,
            collegeId: dto.collegeId,
            rollNumber: dto.rollNumber,
            enrollmentNumber: dto.enrollmentNumber,
            firstName: dto.firstName,
            lastName: dto.lastName,
            gender: dto.gender,
            dateOfBirth,
            phone: dto.phone,
            photoKey: dto.photoKey,
            bloodGroup: dto.bloodGroup,
            emergencyContactName: dto.emergencyContactName,
            emergencyContactPhone: dto.emergencyContactPhone,
            address: dto.address,
          },
        });

        return {
          user: {
            id: user.id,
            email: user.email,
            roleId: user.roleId,
            mustChangePassword: user.mustChangePassword,
          },
          student,
        };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      },
    );
  }
  
  async createStudent(dto: CreateStudentDto) {
    const existingUser = await this.studentRepository.findByUserId(dto.userId);

    if (existingUser) {
      throw new ConflictException(
        'A student profile already exists for this user.',
      );
    }

    const existingCollegeId = await this.studentRepository.findByCollegeId(
      dto.collegeId,
    );

    if (existingCollegeId) {
      throw new ConflictException('College ID already exists.');
    }

    const existingRollNumber = await this.studentRepository.findByRollNumber(
      dto.rollNumber,
    );

    if (existingRollNumber) {
      throw new ConflictException('Roll number already exists.');
    }

    const existingEnrollmentNumber =
      await this.studentRepository.findByEnrollmentNumber(dto.enrollmentNumber);

    if (existingEnrollmentNumber) {
      throw new ConflictException('Enrollment number already exists.');
    }

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined;

    return this.studentRepository.create({
      userId: dto.userId,
      collegeId: dto.collegeId,
      rollNumber: dto.rollNumber,
      enrollmentNumber: dto.enrollmentNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender,
      dateOfBirth,
      phone: dto.phone,
      photoKey: dto.photoKey,
      bloodGroup: dto.bloodGroup,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
      address: dto.address,
    });
  }

  async getAllStudents(includeInactive: boolean = false) {
    return this.studentRepository.findAll(includeInactive);
  }

  async getStudentById(id: string) {
    const student = await this.studentRepository.findById(id);

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    return student;
  }

  async getStudentByCollegeId(collegeId: string) {
    const student = await this.studentRepository.findByCollegeId(collegeId);

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    return student;
  }

  async getStudentByRollNumber(rollNumber: string) {
    const student = await this.studentRepository.findByRollNumber(rollNumber);

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    return student;
  }

  async updateStudent(id: string, dto: UpdateStudentDto) {
    const student = await this.studentRepository.findById(id);

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    if (dto.userId && dto.userId !== student.userId) {
      const existing = await this.studentRepository.findByUserId(dto.userId);

      if (existing) {
        throw new ConflictException(
          'A student profile already exists for this user.',
        );
      }
    }

    if (dto.collegeId && dto.collegeId !== student.collegeId) {
      const existing = await this.studentRepository.findByCollegeId(
        dto.collegeId,
      );

      if (existing) {
        throw new ConflictException('College ID already exists.');
      }
    }

    if (dto.rollNumber && dto.rollNumber !== student.rollNumber) {
      const existing = await this.studentRepository.findByRollNumber(
        dto.rollNumber,
      );

      if (existing) {
        throw new ConflictException('Roll number already exists.');
      }
    }

    if (
      dto.enrollmentNumber &&
      dto.enrollmentNumber !== student.enrollmentNumber
    ) {
      const existing = await this.studentRepository.findByEnrollmentNumber(
        dto.enrollmentNumber,
      );

      if (existing) {
        throw new ConflictException('Enrollment number already exists.');
      }
    }

    const dateOfBirth =
      dto.dateOfBirth !== undefined ? new Date(dto.dateOfBirth) : undefined;

    return this.studentRepository.update(id, {
      ...dto,
      dateOfBirth,
    });
  }

  async uploadPhoto(fileBuffer: Buffer, filename: string, mimeType: string) {
    const photoKey = await this.strictR2StorageService.uploadStudentPhoto(
      fileBuffer,
      filename,
      mimeType,
    );
    return { photoKey };
  }

  async getPhotoStream(key: string) {
    return this.strictR2StorageService.getObjectStream(key);
  }

  async deactivateStudent(id: string) {
    const student = await this.studentRepository.findById(id);

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    if (!student.isActive) {
      throw new ConflictException('Student is already inactive.');
    }

    return this.studentRepository.deactivate(id);
  }

  async activateStudent(id: string) {
    const student = await this.studentRepository.findById(id);

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    return this.studentRepository.activate(id);
  }

  async getAttendanceSummary(userId: string, userRole: string, requestedStudentId?: string) {
    let studentId: string;

    if (userRole === 'STUDENT') {
      const student = await this.prisma.student.findUnique({
        where: { userId },
      });
      if (!student) {
        throw new NotFoundException('Student profile not found for the authenticated user.');
      }
      if (requestedStudentId && requestedStudentId !== student.id) {
        throw new ForbiddenException('Access denied: You can only query your own attendance records.');
      }
      studentId = student.id;
    } else {
      if (!requestedStudentId) {
        throw new BadRequestException('Student ID is required.');
      }
      const student = await this.prisma.student.findUnique({
        where: { id: requestedStudentId },
      });
      if (!student) {
        throw new NotFoundException('Student not found.');
      }
      studentId = student.id;
    }

    const systemSetting = await this.prisma.systemSetting.findFirst();
    const minAttendanceThreshold = systemSetting?.minAttendance ?? 75;

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId },
      include: {
        attendanceSession: {
          include: {
            schedule: {
              include: {
                template: {
                  include: {
                    subject: true,
                    room: true,
                    faculty: true,
                  },
                },
              },
            },
            activity: {
              include: {
                room: true,
                faculty: true,
              },
            },
            takenBy: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const subjectMap = new Map<string, {
      subject: string;
      code: string;
      attended: number;
      total: number;
      sessions: Array<{
        id: string;
        date: string;
        status: string;
        room: string;
        timeSlot: string;
        instructor: string;
        remarks?: string | null;
      }>;
    }>();

    let totalAttendedCount = 0;
    let totalSessionsCount = 0;

    for (const record of records) {
      const session = record.attendanceSession;
      if (!session) continue;

      let subjectName = 'General Session';
      let subjectCode = 'GEN-100';
      let roomCode = 'TBD';
      let timeSlot = '';
      let instructor = session.takenBy ? `${session.takenBy.firstName} ${session.takenBy.lastName || ''}`.trim() : 'Instructor';

      if (session.schedule?.template?.subject) {
        subjectName = session.schedule.template.subject.name;
        subjectCode = session.schedule.template.subject.code;
        roomCode = session.schedule.template.room?.code || session.schedule.template.room?.name || 'TBD';
        timeSlot = `${session.schedule.template.startTime} - ${session.schedule.template.endTime}`;
        if (session.schedule.template.faculty) {
          instructor = `${session.schedule.template.faculty.firstName} ${session.schedule.template.faculty.lastName || ''}`.trim();
        }
      } else if (session.activity) {
        subjectName = session.activity.title;
        subjectCode = 'ACT';
        roomCode = session.activity.room?.code || 'TBD';
        if (session.activity.faculty) {
          instructor = `${session.activity.faculty.firstName} ${session.activity.faculty.lastName || ''}`.trim();
        }
      }

      const dateStr = session.attendanceDate
        ? new Date(session.attendanceDate).toISOString().split('T')[0]
        : new Date(record.createdAt).toISOString().split('T')[0];

      let displayStatus = 'Present';
      let isCountedAsAttended = false;

      if (record.status === 'PRESENT') {
        displayStatus = 'Present';
        isCountedAsAttended = true;
      } else if (record.status === 'LATE') {
        displayStatus = 'Late';
        isCountedAsAttended = true;
      } else if (record.status === 'EXCUSED') {
        displayStatus = 'Excused';
        isCountedAsAttended = true;
      } else if (record.status === 'ABSENT') {
        displayStatus = 'Absent';
        isCountedAsAttended = false;
      }

      if (!subjectMap.has(subjectCode)) {
        subjectMap.set(subjectCode, {
          subject: subjectName,
          code: subjectCode,
          attended: 0,
          total: 0,
          sessions: [],
        });
      }

      const subEntry = subjectMap.get(subjectCode)!;
      subEntry.total += 1;
      totalSessionsCount += 1;

      if (isCountedAsAttended) {
        subEntry.attended += 1;
        totalAttendedCount += 1;
      }

      subEntry.sessions.push({
        id: record.id,
        date: dateStr,
        status: displayStatus,
        room: roomCode,
        timeSlot,
        instructor,
        remarks: record.remarks,
      });
    }

    const subjectSummaries = Array.from(subjectMap.values()).map((sub) => {
      const percentage = sub.total > 0 ? Math.round((sub.attended / sub.total) * 1000) / 10 : 0;
      return {
        subject: sub.subject,
        code: sub.code,
        attended: sub.attended,
        total: sub.total,
        percentage,
        isShortfall: percentage < minAttendanceThreshold,
        sessions: sub.sessions,
      };
    });

    const overallPercentage = totalSessionsCount > 0
      ? Math.round((totalAttendedCount / totalSessionsCount) * 1000) / 10
      : 0;

    return {
      studentId,
      minAttendanceThreshold,
      overallAttended: totalAttendedCount,
      overallTotal: totalSessionsCount,
      overallPercentage,
      overallShortfall: overallPercentage < minAttendanceThreshold,
      subjectSummaries,
    };
  }

  async getAcademicNotices(userId: string, userRole: string) {
    return [];
  }
}
