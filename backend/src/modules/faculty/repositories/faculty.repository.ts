import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FacultyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { includeInactive?: boolean; departmentId?: string; search?: string } | boolean = false) {
    const opts = typeof params === 'boolean' ? { includeInactive: params } : params;
    const { includeInactive = false, departmentId, search } = opts;
    const where: any = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (departmentId && departmentId !== 'ALL') {
      where.departmentId = departmentId;
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { employeeCode: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.prisma.faculty.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        employeeCode: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.faculty.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.faculty.findUnique({
      where: { userId },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
      },
    });
  }

  async findByEmployeeCode(employeeCode: string) {
    return this.prisma.faculty.findUnique({
      where: { employeeCode },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
      },
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
    departmentId?: string;
  }) {
    return this.prisma.faculty.create({
      data,
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
      },
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
      departmentId?: string;
    },
  ) {
    return this.prisma.faculty.update({
      where: { id },
      data,
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
      },
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

  async activate(id: string) {
    return this.prisma.faculty.update({
      where: { id },
      data: {
        isActive: true,
      },
    });
  }
}
