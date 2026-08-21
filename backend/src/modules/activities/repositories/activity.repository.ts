import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { UpdateActivityDto } from '../dto/update-activity.dto';

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    activityType: true,
    faculty: { include: { user: true } },
    room: true,
  };

  async findAll() {
    return this.prisma.activity.findMany({
      include: this.include,
      orderBy: { startTime: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.activity.findUnique({
      where: { id },
      include: this.include,
    });
  }

  async findByFaculty(facultyId: string) {
    return this.prisma.activity.findMany({
      where: { facultyId },
      include: this.include,
      orderBy: { startTime: 'desc' },
    });
  }

  async findUpcoming() {
    return this.prisma.activity.findMany({
      where: { startTime: { gte: new Date() } },
      include: this.include,
      orderBy: { startTime: 'asc' },
    });
  }

  async create(data: CreateActivityDto) {
    return this.prisma.activity.create({
      data: {
        activityTypeId: data.activityTypeId,
        title: data.title,
        description: data.description,
        facultyId: data.facultyId,
        roomId: data.roomId ?? null,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        attendanceRequired: data.attendanceRequired ?? true,
      },
      include: this.include,
    });
  }

  async update(id: string, data: UpdateActivityDto) {
    return this.prisma.activity.update({
      where: { id },
      data: {
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    return this.prisma.activity.delete({ where: { id } });
  }
}
