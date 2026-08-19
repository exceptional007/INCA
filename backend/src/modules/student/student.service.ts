import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentAccountDto } from './dto/create-student-account.dto';
import * as bcrypt from 'bcrypt';
import { StudentRepository } from './repositories/student.repository';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentService {
  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly prisma: PrismaService,
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

    return this.prisma.$transaction(async (tx) => {
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
    });
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
    });
  }

  async getAllStudents() {
    return this.studentRepository.findAll();
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
}
