import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive: boolean = false) {
    return this.prisma.student.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        rollNumber: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.student.findUnique({
      where: { userId },
    });
  }

  async findByCollegeId(collegeId: string) {
    return this.prisma.student.findUnique({
      where: { collegeId },
    });
  }

  async findByRollNumber(rollNumber: string) {
    return this.prisma.student.findUnique({
      where: { rollNumber },
    });
  }

  async findByEnrollmentNumber(enrollmentNumber: string) {
    return this.prisma.student.findUnique({
      where: { enrollmentNumber },
    });
  }

  async create(data: {
    userId: string;
    collegeId: string;
    rollNumber: string;
    enrollmentNumber: string;
    firstName: string;
    lastName?: string;
    gender: any;
    dateOfBirth?: Date;
    phone?: string;
    photoKey?: string;
    bloodGroup?: any;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    address?: string;
  }) {
    return this.prisma.student.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      userId?: string;
      collegeId?: string;
      rollNumber?: string;
      enrollmentNumber?: string;
      firstName?: string;
      lastName?: string;
      gender?: any;
      dateOfBirth?: Date;
      phone?: string;
      photoKey?: string;
      bloodGroup?: any;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      address?: string;
    },
  ) {
    return this.prisma.student.update({
      where: { id },
      data,
    });
  }

  async deactivate(id: string) {
    return this.prisma.student.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  async activate(id: string) {
    return this.prisma.student.update({
      where: { id },
      data: {
        isActive: true,
      },
    });
  }
}
