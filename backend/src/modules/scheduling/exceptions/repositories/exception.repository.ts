import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateExceptionDto } from '../dto/create-exception.dto';
import { UpdateExceptionDto } from '../dto/update-exception.dto';

@Injectable()
export class ExceptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.scheduleException.findMany({
      include: {
        schedule: {
          include: {
            template: {
              include: { subject: true, section: true }
            }
          }
        },
        newFaculty: { include: { user: true } },
        newRoom: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.scheduleException.findUnique({
      where: { id },
      include: {
        schedule: {
          include: {
            template: {
              include: { subject: true, section: true }
            }
          }
        },
        newFaculty: { include: { user: true } },
        newRoom: true,
      },
    });
  }

  async create(data: CreateExceptionDto) {
    return this.prisma.scheduleException.create({
      data: {
        scheduleId: data.scheduleId,
        exceptionType: data.exceptionType,
        reason: data.reason,
        newFacultyId: data.newFacultyId,
        newRoomId: data.newRoomId,
        newStartTime: data.newStartTime,
        newEndTime: data.newEndTime,
      },
    });
  }

  async update(id: string, data: UpdateExceptionDto) {
    return this.prisma.scheduleException.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.scheduleException.delete({
      where: { id },
    });
  }
}
