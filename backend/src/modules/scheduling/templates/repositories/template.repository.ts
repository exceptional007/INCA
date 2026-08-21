import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';

@Injectable()
export class TemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.scheduleTemplate.findMany({
      include: {
        section: true,
        subject: true,
        faculty: { include: { user: true } },
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
        faculty: { include: { user: true } },
        room: true,
      },
    });
  }

  async findBySection(sectionId: string) {
    return this.prisma.scheduleTemplate.findMany({
      where: { sectionId },
      include: {
        subject: true,
        faculty: { include: { user: true } },
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

  async remove(id: string) {
    return this.prisma.scheduleTemplate.delete({
      where: { id },
    });
  }
}
