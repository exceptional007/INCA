import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.batch.findMany({
      include: {
        program: {
          include: {
            department: true,
          },
        },
      },
      orderBy: {
        startYear: 'desc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.batch.findUnique({
      where: { id },
      include: {
        program: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async findByProgramAndStartYear(programId: string, startYear: number) {
    return this.prisma.batch.findUnique({
      where: {
        programId_startYear: {
          programId,
          startYear,
        },
      },
    });
  }

  async create(data: {
    programId: string;
    name: string;
    startYear: number;
    endYear: number;
  }) {
    return this.prisma.batch.create({
      data,
      include: {
        program: {
          include: {
            department: true,
          },
        },
      },
    });
  }
  async update(
    id: string,
    data: {
      programId?: string;
      name?: string;
      startYear?: number;
      endYear?: number;
    },
  ) {
    return this.prisma.batch.update({
      where: { id },
      data,
      include: {
        program: {
          include: {
            department: true,
          },
        },
      },
    });
  }
  async deactivate(id: string) {
    return this.prisma.batch.update({
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
      },
    });
  }
}
