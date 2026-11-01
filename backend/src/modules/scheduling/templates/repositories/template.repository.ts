import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';

@Injectable()
export class TemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async subjectExists(id: string): Promise<boolean> {
    return (await this.prisma.subject.findUnique({ where: { id }, select: { id: true } })) !== null;
  }

  async facultyExists(id: string): Promise<boolean> {
    return (await this.prisma.faculty.findUnique({ where: { id }, select: { id: true } })) !== null;
  }

  async roomExists(id: string): Promise<boolean> {
    return (await this.prisma.room.findUnique({ where: { id }, select: { id: true } })) !== null;
  }

  async getAdminDepartmentId(userId: string): Promise<string | null> {
    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId }, select: { departmentId: true },
    });
    return profile?.departmentId ?? null;
  }

  async getSectionDepartmentId(sectionId: string): Promise<string | null> {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { semester: { select: { program: { select: { departmentId: true } } } } },
    });
    return section?.semester.program.departmentId ?? null;
  }

  async findAll(departmentId?: string) {
    return this.prisma.scheduleTemplate.findMany({
      where: departmentId ? {section: {semester: {program: {departmentId}}}} : {},
      include: {
        section: true,
        subject: true,
        faculty: {
          include: {
            user: {
              select: { id: true, email: true, isActive: true },
            },
          },
        },
        room: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });
  }

  async findById(id: string) {
    return this.prisma.scheduleTemplate.findUnique({
      where: { id },
      include: {
        section: true,
        subject: true,
        faculty: {
          include: {
            user: {
              select: { id: true, email: true, isActive: true },
            },
          },
        },
        room: true,
      },
    });
  }

  async findBySection(sectionId: string) {
    return this.prisma.scheduleTemplate.findMany({
      where: { sectionId },
      include: {
        subject: true,
        faculty: {
          include: {
            user: {
              select: { id: true, email: true, isActive: true },
            },
          },
        },
        room: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });
  }

  async create(data: CreateTemplateDto) {
    return this.prisma.scheduleTemplate.create({
      data: {
        sectionId: data.sectionId,
        subjectId: data.subjectId,
        facultyId: data.facultyId,
        roomId: data.roomId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
    });
  }

  async update(id: string, data: UpdateTemplateDto) {
    return this.prisma.scheduleTemplate.update({
      where: { id },
      data: {
        ...data,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
      },
    });
  }

  async remove(id: string, expectedSectionId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Block new schedules and section changes until the deletion decision commits.
      const templates = await tx.$queryRaw<{ sectionId: string }[]>`
        SELECT "sectionId" FROM schedule_templates WHERE id = ${id} FOR UPDATE
      `;
      if (!templates.length) throw new NotFoundException('Schedule template not found.');
      if (templates[0].sectionId !== expectedSectionId) {
        throw new ConflictException('The template section changed. Reload it before trying again.');
      }

      // Attendance inserts acquire a key-share lock on their schedule; lock every
      // child first so one cannot appear between the check and cascade deletion.
      await tx.$queryRaw`
        SELECT id FROM schedules WHERE "templateId" = ${id} ORDER BY id FOR UPDATE
      `;
      const session = await tx.attendanceSession.findFirst({
        where: { schedule: { templateId: id } },
        select: { id: true },
      });
      if (session) {
        throw new ConflictException(
          'Cannot delete a schedule template with attendance sessions. Its attendance history must be preserved.',
        );
      }
      return tx.scheduleTemplate.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
