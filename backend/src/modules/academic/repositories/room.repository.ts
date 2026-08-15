import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.room.findMany({
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.room.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
    });
  }

  async create(data: {
    code: string;
    name: string;
    building?: string;
    floor?: number;
    capacity?: number;
    isLab: boolean;
  }) {
    return this.prisma.room.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      code?: string;
      name?: string;
      building?: string;
      floor?: number;
      capacity?: number;
      isLab?: boolean;
    },
  ) {
    return this.prisma.room.update({
      where: { id },
      data,
    });
  }

  async deactivate(id: string) {
    return this.prisma.room.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
