import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DepartmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string) {
    return this.prisma.department.findUnique({
      where: { code },
    });
  }

  async create(data: {
    code: string;
    name: string;
    shortName?: string;
    description?: string;
  }) {
    return this.prisma.department.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      code?: string;
      name?: string;
      shortName?: string;
      description?: string;
    },
  ) {
    return this.prisma.department.update({
      where: { id },
      data,
    });
  }
  async deactivate(id: string) {
    return this.prisma.department.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
