import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TimeSlotRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.timeSlot.findMany({
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.timeSlot.findUnique({
      where: { id },
    });
  }

  async findByTimeRange(startTime: string, endTime: string) {
    return this.prisma.timeSlot.findUnique({
      where: {
        startTime_endTime: {
          startTime,
          endTime,
        },
      },
    });
  }

  async create(data: { name: string; startTime: string; endTime: string }) {
    return this.prisma.timeSlot.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      startTime?: string;
      endTime?: string;
    },
  ) {
    return this.prisma.timeSlot.update({
      where: { id },
      data,
    });
  }

  async deactivate(id: string) {
    return this.prisma.timeSlot.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
