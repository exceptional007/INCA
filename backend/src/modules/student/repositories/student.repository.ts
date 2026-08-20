import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.student.findMany({
      orderBy: {
        rollNumber: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.student.findUnique({
      where: { id },
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
}
