import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProgramRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.program.findMany({
      include: {
        department: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.program.findUnique({
      where: { id },
      include: {
        department: true,
      },
    });
  }

  async findByCode(code: string) {
    return this.prisma.program.findUnique({
      where: { code },
    });
  }

  async findByName(departmentId: string, name: string) {
    return this.prisma.program.findUnique({
      where: {
        departmentId_name: {
          departmentId,
          name,
        },
      },
    });
  }

  async create(data: {
    departmentId: string;
    code: string;
    name: string;
    shortName?: string;
    durationYears?: number;
  }) {
    return this.prisma.program.create({
      data,
      include: {
        department: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      departmentId?: string;
      code?: string;
      name?: string;
      shortName?: string;
      durationYears?: number;
    },
  ) {
    return this.prisma.program.update({
      where: { id },
      data,
      include: {
        department: true,
      },
    });
  }
  
  async deactivate(id: string) {
    return this.prisma.program.update({
      where: { id },
      data: {
        isActive: false,
      },
      include: {
        department: true,
      },
    });
  }
}
