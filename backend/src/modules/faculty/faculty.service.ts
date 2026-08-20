import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { FacultyRepository } from './repositories/faculty.repository';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateFacultyAccountDto } from './dto/create-faculty-account.dto';

@Injectable()
export class FacultyService {
  constructor(
    private readonly facultyRepository: FacultyRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createFacultyAccount(dto: CreateFacultyAccountDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const existingEmployeeCode =
      await this.facultyRepository.findByEmployeeCode(dto.employeeCode);

    if (existingEmployeeCode) {
      throw new ConflictException('Employee code already exists.');
    }

    const facultyRole = await this.prisma.role.findUnique({
      where: {
        code: 'FACULTY',
      },
    });

    if (!facultyRole) {
      throw new NotFoundException('FACULTY role not found.');
    }

    if (!facultyRole.isActive) {
      throw new ConflictException('FACULTY role is inactive.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          roleId: facultyRole.id,
          mustChangePassword: true,
        },
      });

      const faculty = await tx.faculty.create({
        data: {
          userId: user.id,
          employeeCode: dto.employeeCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          gender: dto.gender,
          dateOfBirth,
          designation: dto.designation,
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
        faculty,
      };
    });
  }
  
  async createFaculty(dto: CreateFacultyDto) {
    const existingUser = await this.facultyRepository.findByUserId(dto.userId);

    if (existingUser) {
      throw new ConflictException(
        'A faculty profile already exists for this user.',
      );
    }

    const existingEmployeeCode =
      await this.facultyRepository.findByEmployeeCode(dto.employeeCode);

    if (existingEmployeeCode) {
      throw new ConflictException('Employee code already exists.');
    }

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined;

    return this.facultyRepository.create({
      userId: dto.userId,
      employeeCode: dto.employeeCode,
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender,
      dateOfBirth,
      designation: dto.designation,
      phone: dto.phone,
      photoKey: dto.photoKey,
    });
  }

  async getAllFaculty() {
    return this.facultyRepository.findAll();
  }

  async getFacultyById(id: string) {
    const faculty = await this.facultyRepository.findById(id);

    if (!faculty) {
      throw new NotFoundException('Faculty not found.');
    }

    return faculty;
  }

  async getFacultyByEmployeeCode(employeeCode: string) {
    const faculty =
      await this.facultyRepository.findByEmployeeCode(employeeCode);

    if (!faculty) {
      throw new NotFoundException('Faculty not found.');
    }

    return faculty;
  }
  async updateFaculty(id: string, dto: UpdateFacultyDto) {
    const faculty = await this.facultyRepository.findById(id);

    if (!faculty) {
      throw new NotFoundException('Faculty not found.');
    }

    if (dto.userId && dto.userId !== faculty.userId) {
      const existing = await this.facultyRepository.findByUserId(dto.userId);

      if (existing) {
        throw new ConflictException(
          'A faculty profile already exists for this user.',
        );
      }
    }

    if (dto.employeeCode && dto.employeeCode !== faculty.employeeCode) {
      const existing = await this.facultyRepository.findByEmployeeCode(
        dto.employeeCode,
      );

      if (existing) {
        throw new ConflictException('Employee code already exists.');
      }
    }

    const dateOfBirth =
      dto.dateOfBirth !== undefined ? new Date(dto.dateOfBirth) : undefined;

    return this.facultyRepository.update(id, {
      ...dto,
      dateOfBirth,
    });
  }

  async deactivateFaculty(id: string) {
    const faculty = await this.facultyRepository.findById(id);

    if (!faculty) {
      throw new NotFoundException('Faculty not found.');
    }

    if (!faculty.isActive) {
      throw new ConflictException('Faculty is already inactive.');
    }

    return this.facultyRepository.deactivate(id);
  }
}
