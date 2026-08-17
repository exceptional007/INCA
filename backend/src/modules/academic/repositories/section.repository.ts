import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.section.findMany({
      include: {
        batch: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
        semester: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.section.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
        semester: true,
      },
    });
  }

  async findByBatchSemesterAndName(
    batchId: string,
    semesterId: string,
    name: string,
  ) {
    return this.prisma.section.findUnique({
      where: {
        batchId_semesterId_name: {
          batchId,
          semesterId,
          name,
        },
      },
    });
  }

  async create(data: { batchId: string; semesterId: string; name: string }) {
    return this.prisma.section.create({
      data,
      include: {
        batch: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
        semester: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      batchId?: string;
      semesterId?: string;
      name?: string;
    },
  ) {
    return this.prisma.section.update({
      where: { id },
      data,
      include: {
        batch: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
        semester: true,
      },
    });
  }

  async deactivate(id: string) {
    return this.prisma.section.update({
      where: { id },
      data: {
        isActive: false,
      },
      include: {
        batch: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
        semester: true,
      },
    });
  }
}
