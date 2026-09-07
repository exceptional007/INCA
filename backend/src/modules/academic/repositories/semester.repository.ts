import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SemesterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive: boolean = false, programId?: string) {
    return this.prisma.semester.findMany({
      where: {
        ...(programId ? { programId } : {}),
        ...(includeInactive
          ? {}
          : {
              isActive: true,
              program: {
                isActive: true,
                department: {
                  isActive: true,
                },
              },
            }),
      },
      include: {
        program: {
          include: {
            department: true,
          },
        },
      },
      orderBy: [
        { program: { name: 'asc' } },
        { number: 'asc' },
      ],
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
      },
    });
  }

  async findByProgramAndNumber(programId: string, number: number) {
    return this.prisma.semester.findUnique({
      where: {
        programId_number: {
          programId,
          number,
        },
      },
    });
  }

  async create(data: {
    programId: string;
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
      },
    });
  }

  async update(
    id: string,
    data: {
      programId?: string;
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
      },
    });
  }
}
