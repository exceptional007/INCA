import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { UpdateActivityDto } from '../dto/update-activity.dto';

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminDepartmentId(userId: string): Promise<string | null> {
    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId },
      select: { departmentId: true },
    });
    return profile?.departmentId ?? null;
  }

  async getFacultyAccess(facultyId: string) {
    return this.prisma.faculty.findUnique({
      where: { id: facultyId },
      select: { userId: true, departmentId: true },
    });
  }

  async roomExists(roomId: string): Promise<boolean> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true },
    });
    return room !== null;
  }

  private readonly include = {
    activityType: true,
    faculty: {
      include: {
        user: {
          select: { id: true, email: true, isActive: true },
        },
      },
    },
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

  async remove(id: string, expectedFacultyId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // FOR UPDATE also blocks the FK key-share lock used by new attendance sessions.
        const rows = await tx.$queryRaw<{ facultyId: string }[]>`
        SELECT "facultyId" FROM activities WHERE id = ${id} FOR UPDATE
      `;
        if (!rows.length) throw new NotFoundException('Activity not found.');
        if (rows[0].facultyId !== expectedFacultyId) {
          throw new ConflictException(
            'The activity organiser changed. Reload the activity before trying again.',
          );
        }
        const session = await tx.attendanceSession.findFirst({
          where: { activityId: id },
          select: { id: true },
        });
        if (session) {
          throw new ConflictException(
            'Cannot delete an activity with attendance sessions. Its attendance history must be preserved.',
          );
        }
        return tx.activity.delete({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
