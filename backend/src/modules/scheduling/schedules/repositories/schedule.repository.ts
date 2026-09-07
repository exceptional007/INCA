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
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) return [];

    const sectionIds = new Set<string>();

    // 1. Collect section IDs from all past attendance records
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId: student.id },
      select: {
        attendanceSession: {
          select: {
            schedule: {
              select: { template: { select: { sectionId: true } } },
            },
          },
        },
      },
    });
    for (const rec of records) {
      const secId = rec.attendanceSession?.schedule?.template?.sectionId;
      if (secId) sectionIds.add(secId);
    }

    // 2. Derive base section from collegeId pattern (e.g. BIT-23/DS/C/08 -> "C")
    //    then find ALL related sections whose name matches or starts with that base.
    if (student.collegeId) {
      const parts = student.collegeId.split('/');
      const baseSectionName = parts.length >= 3 ? parts[parts.length - 2] : null;
      if (baseSectionName) {
        const allActiveSections = await this.prisma.section.findMany({ where: { isActive: true } });
        const baseUpper = baseSectionName.toUpperCase();
        for (const sec of allActiveSections) {
          const nameUpper = sec.name.toUpperCase();
          // Match: exact ("C"), prefixed sub-batch ("C1","C2"), or combined ("C1+C2")
          if (
            nameUpper === baseUpper ||
            nameUpper.startsWith(baseUpper) ||
            nameUpper.split('+').some((part) => part.trim().startsWith(baseUpper))
          ) {
            sectionIds.add(sec.id);
          }
        }
      }
    }

    // 3. Fallback: first active section
    if (sectionIds.size === 0) {
      const activeSec = await this.prisma.section.findFirst({ where: { isActive: true } });
      if (activeSec) sectionIds.add(activeSec.id);
    }

    return Array.from(sectionIds);
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
