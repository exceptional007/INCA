import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateScheduleDto } from '../dto/create-schedule.dto';
import { UpdateScheduleDto } from '../dto/update-schedule.dto';
import { ScheduleStatus } from '@prisma/client';

@Injectable()
export class ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getFacultyIdForUser(userId: string): Promise<string | null> {
    const fac = await this.prisma.faculty.findUnique({ where: { userId } });
    return fac ? fac.id : null;
  }

  async getStudentSectionIdsForUser(userId: string): Promise<string[]> {
    const student = await this.prisma.student.findUnique({
      where: {userId}, select: {isActive: true, sectionId: true, section: {select: {isActive: true}}},
    });
    return student?.isActive && student.sectionId && student.section?.isActive ? [student.sectionId] : [];
  }

  async findAll(facultyId?: string, sectionIds?: string[]) {
    const where: any = {};
    if (facultyId || (sectionIds && sectionIds.length > 0)) {
      where.template = {};
      if (facultyId) where.template.facultyId = facultyId;
      if (sectionIds && sectionIds.length > 0) where.template.sectionId = { in: sectionIds };
    }

    return this.prisma.schedule.findMany({
      where,
      include: {
        template: {
          include: {
            section: {
              include: {
                semester: {
                  include: {
                    program: true,
                  },
                },
              },
            },
            subject: true,
            faculty: {
              include: {
                user: {
                  select: { id: true, email: true, isActive: true },
                },
              },
            },
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
            section: {
              include: {
                semester: {
                  include: {
                    program: true,
                  },
                },
              },
            },
            subject: true,
            faculty: {
              include: {
                user: {
                  select: { id: true, email: true, isActive: true },
                },
              },
            },
            room: true,
          }
        },
        exceptions: true,
      },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date, facultyId?: string, sectionIds?: string[]) {
    const where: any = {
      lectureDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (facultyId || (sectionIds && sectionIds.length > 0)) {
      where.template = {};
      if (facultyId) where.template.facultyId = facultyId;
      if (sectionIds && sectionIds.length > 0) where.template.sectionId = { in: sectionIds };
    }

    return this.prisma.schedule.findMany({
      where,
      include: {
        template: {
          include: {
            section: {
              include: {
                semester: {
                  include: {
                    program: true,
                  },
                },
              },
            },
            subject: true,
            faculty: {
              include: {
                user: {
                  select: { id: true, email: true, isActive: true },
                },
              },
            },
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
