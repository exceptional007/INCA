import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SubjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive: boolean = false) {
    return this.prisma.subject.findMany({
      where: includeInactive ? undefined : { isActive: true },
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
      orderBy: [
        { year: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async findById(id: string) {
    return this.prisma.subject.findUnique({
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

  async findByCode(code: string) {
    return this.prisma.subject.findUnique({
      where: { code },
    });
  }

  async findBySemesterAndName(semesterId: string, name: string) {
    return this.prisma.subject.findUnique({
      where: {
        semesterId_name: {
          semesterId,
          name,
        },
      },
    });
  }

  async create(data: {
    year: number;
    semesterId: string;
    code: string;
    name: string;
    isLab: boolean;
  }) {
    return this.prisma.subject.create({
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
      year?: number;
      semesterId?: string;
      code?: string;
      name?: string;
      isLab?: boolean;
    },
  ) {
    return this.prisma.subject.update({
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
    return this.prisma.subject.update({
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

  async activate(id: string) {
    return this.prisma.subject.update({
      where: { id },
      data: {
        isActive: true,
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
