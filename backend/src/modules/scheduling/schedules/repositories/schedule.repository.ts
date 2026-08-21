import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateScheduleDto } from '../dto/create-schedule.dto';
import { UpdateScheduleDto } from '../dto/update-schedule.dto';
import { ScheduleStatus } from '@prisma/client';

@Injectable()
export class ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.schedule.findMany({
      include: {
        template: {
          include: {
            section: true,
            subject: true,
            faculty: { include: { user: true } },
            room: true,
          }
        },
        exceptions: true,
      },
      orderBy: { lectureDate: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.schedule.findUnique({
      where: { id },
      include: {
        template: {
          include: {
            section: true,
            subject: true,
            faculty: { include: { user: true } },
            room: true,
          }
        },
        exceptions: true,
      },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date) {
    return this.prisma.schedule.findMany({
      where: {
        lectureDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        template: {
          include: {
            section: true,
            subject: true,
            faculty: { include: { user: true } },
            room: true,
          }
        },
        exceptions: true,
      },
      orderBy: { lectureDate: 'asc' },
    });
  }

  async create(data: CreateScheduleDto) {
    return this.prisma.schedule.create({
      data: {
        templateId: data.templateId,
        lectureDate: new Date(data.lectureDate),
        status: data.status || ScheduleStatus.SCHEDULED,
        remarks: data.remarks,
      },
    });
  }

  async createMany(data: any[]) {
    return this.prisma.schedule.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async update(id: string, data: UpdateScheduleDto) {
    return this.prisma.schedule.update({
      where: { id },
      data: {
        ...data,
        lectureDate: data.lectureDate ? new Date(data.lectureDate) : undefined,
      },
    });
  }
}
