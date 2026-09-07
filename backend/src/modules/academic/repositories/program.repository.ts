import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProgramRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive: boolean = false) {
    return this.prisma.program.findMany({
      where: includeInactive
        ? undefined
        : {
            isActive: true,
            department: {
              isActive: true,
            },
          },
      include: {
        department: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findByDepartmentId(departmentId: string, includeInactive: boolean = false) {
    return this.prisma.program.findMany({
      where: includeInactive
        ? { departmentId }
        : {
            departmentId,
            isActive: true,
            department: {
              isActive: true,
            },
          },
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
    return this.prisma.$transaction(async (tx) => {
      const program = await tx.program.create({
        data,
        include: {
          department: true,
        },
      });

      const totalSemesters =
        data.durationYears && data.durationYears > 0
          ? data.durationYears * 2
          : 8;

      const semestersData: Array<{
        programId: string;
        number: number;
        name: string;
        isActive: boolean;
      }> = [];

      for (let i = 1; i <= totalSemesters; i++) {
        semestersData.push({
          programId: program.id,
          number: i,
          name: `Semester ${i}`,
          isActive: true,
        });
      }

      await tx.semester.createMany({
        data: semestersData,
      });

      return program;
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

  async activate(id: string) {
    return this.prisma.program.update({
      where: { id },
      data: {
        isActive: true,
      },
      include: {
        department: true,
      },
    });
  }

  async delete(id: string) {
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
