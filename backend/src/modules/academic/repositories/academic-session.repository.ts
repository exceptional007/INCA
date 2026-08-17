import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AcademicSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.academicSession.findMany({
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.academicSession.findUnique({
      where: { id },
    });
  }

  async findByName(name: string) {
    return this.prisma.academicSession.findUnique({
      where: { name },
    });
  }

  async findActive() {
    return this.prisma.academicSession.findFirst({
      where: {
        isActive: true,
      },
    });
  }

  async create(data: {
    name: string;
    startDate: Date;
    endDate: Date;
    isActive?: boolean;
  }) {
    return this.prisma.academicSession.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return this.prisma.academicSession.update({
      where: { id },
      data,
    });
  }

  async deactivate(id: string) {
    return this.prisma.academicSession.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  async activate(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.academicSession.updateMany({
        where: {
          isActive: true,
          id: {
            not: id,
          },
        },
        data: {
          isActive: false,
        },
      });

      return tx.academicSession.update({
        where: { id },
        data: {
          isActive: true,
        },
      });
    });
  }
}
