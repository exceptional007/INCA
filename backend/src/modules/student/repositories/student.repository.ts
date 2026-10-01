import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StudentRepository {
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
        { rollNumber: { contains: term, mode: 'insensitive' } },
        { collegeId: { contains: term, mode: 'insensitive' } },
        { enrollmentNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.prisma.student.findMany({
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
        section: {
          select: {
            id: true,
            name: true,
          },
        },
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
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
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
    return this.prisma.student.findUnique({
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
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findByCollegeId(collegeId: string) {
    return this.prisma.student.findUnique({
      where: { collegeId },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findByRollNumber(rollNumber: string) {
    return this.prisma.student.findUnique({
      where: { rollNumber },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findByEnrollmentNumber(enrollmentNumber: string) {
    return this.prisma.student.findUnique({
      where: { enrollmentNumber },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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
    departmentId?: string;
    sectionId?: string;
  }) {
    return this.prisma.student.create({
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
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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
      departmentId?: string;
      sectionId?: string;
    },
  ) {
    return this.prisma.student.update({
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
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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
