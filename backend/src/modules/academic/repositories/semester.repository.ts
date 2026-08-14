import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SemesterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.semester.findMany({
      include: {
        program: {
          include: {
            department: true,
          },
        },
        batch: true,
      },
      orderBy: {
        number: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.semester.findUnique({
      where: { id },
      include: {
        program: {
          include: {
            department: true,
          },
        },
        batch: true,
      },
    });
  }

  async findByBatchAndNumber(batchId: string, number: number) {
    return this.prisma.semester.findUnique({
      where: {
        batchId_number: {
          batchId,
          number,
        },
      },
    });
  }

  async create(data: {
    programId: string;
    batchId: string;
    number: number;
    name: string;
  }) {
    return this.prisma.semester.create({
      data,
      include: {
        program: {
          include: {
            department: true,
          },
        },
        batch: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      programId?: string;
      batchId?: string;
      number?: number;
      name?: string;
    },
  ) {
    return this.prisma.semester.update({
      where: { id },
      data,
      include: {
        program: {
          include: {
            department: true,
          },
        },
        batch: true,
      },
    });
  }

  async deactivate(id: string) {
    return this.prisma.semester.update({
      where: { id },
      data: {
        isActive: false,
      },
      include: {
        program: {
          include: {
            department: true,
          },
        },
        batch: true,
      },
    });
  }
}
