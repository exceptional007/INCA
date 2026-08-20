import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FacultyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.faculty.findMany({
      orderBy: {
        employeeCode: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.faculty.findUnique({
      where: { id },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.faculty.findUnique({
      where: { userId },
    });
  }

  async findByEmployeeCode(employeeCode: string) {
    return this.prisma.faculty.findUnique({
      where: { employeeCode },
    });
  }

  async create(data: {
    userId: string;
    employeeCode: string;
    firstName: string;
    lastName?: string;
    gender: any;
    dateOfBirth?: Date;
    designation: string;
    phone?: string;
    photoKey?: string;
  }) {
    return this.prisma.faculty.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      userId?: string;
      employeeCode?: string;
      firstName?: string;
      lastName?: string;
      gender?: any;
      dateOfBirth?: Date;
      designation?: string;
      phone?: string;
      photoKey?: string;
    },
  ) {
    return this.prisma.faculty.update({
      where: { id },
      data,
    });
  }

  async deactivate(id: string) {
    return this.prisma.faculty.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
