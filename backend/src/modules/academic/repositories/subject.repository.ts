import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SubjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.subject.findMany({
      include: {
        program: {
          include: {
            department: true,
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
    return this.prisma.subject.findUnique({
      where: { id },
      include: {
        program: {
          include: {
            department: true,
          },
        },
        semester: true,
      },
    });
  }

  async findByCode(code: string) {
    return this.prisma.subject.findUnique({
      where: { code },
    });
  }

  async findBySemesterAndName(
    programId: string,
    semesterId: string,
    name: string,
  ) {
    return this.prisma.subject.findUnique({
      where: {
        programId_semesterId_name: {
          programId,
          semesterId,
          name,
        },
      },
    });
  }

  async create(data: {
    programId: string;
    semesterId: string;
    code: string;
    name: string;
    credits: number;
    isLab: boolean;
  }) {
    return this.prisma.subject.create({
      data,
      include: {
        program: {
          include: {
            department: true,
          },
        },
        semester: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      programId?: string;
      semesterId?: string;
      code?: string;
      name?: string;
      credits?: number;
      isLab?: boolean;
    },
  ) {
    return this.prisma.subject.update({
      where: { id },
      data,
      include: {
        program: {
          include: {
            department: true,
          },
        },
        semester: true,
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
        program: {
          include: {
            department: true,
          },
        },
        semester: true,
      },
    });
  }
}
