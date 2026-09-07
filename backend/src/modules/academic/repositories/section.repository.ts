import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive: boolean = false, semesterId?: string) {
    return this.prisma.section.findMany({
      where: {
        ...(semesterId ? { semesterId } : {}),
        ...(includeInactive
          ? {}
          : {
              isActive: true,
              semester: {
                isActive: true,
                program: {
                  isActive: true,
                  department: {
                    isActive: true,
                  },
                },
              },
            }),
      },
      include: {
        semester: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
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
        semester: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });
  }

  async findBySemesterAndName(semesterId: string, name: string) {
    return this.prisma.section.findUnique({
      where: {
        semesterId_name: {
          semesterId,
          name,
        },
      },
    });
  }

  async create(data: { semesterId: string; name: string }) {
    return this.prisma.section.create({
      data,
      include: {
        semester: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: {
      semesterId?: string;
      name?: string;
    },
  ) {
    return this.prisma.section.update({
      where: { id },
      data,
      include: {
        semester: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
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
        semester: {
          include: {
            program: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    });
  }
}
