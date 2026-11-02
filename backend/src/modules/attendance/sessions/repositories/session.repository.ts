import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateSessionDto } from '../dto/create-session.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    schedule: {
      include: {
        template: {
          include: {
            subject: true,
            section: true,
            faculty: {
              include: {
                user: {
                  select: { id: true, email: true, isActive: true },
                },
              },
            },
            room: true,
          },
        },
      },
    },
    activity: {
      include: { activityType: true, room: true },
    },
    takenBy: {
      include: {
        user: {
          select: { id: true, email: true, isActive: true },
        },
      },
    },
    records: {
      include: { student: true },
    },
  };

  async findAll(where: Prisma.AttendanceSessionWhereInput) {
    return this.prisma.attendanceSession.findMany({
      where,
      include: this.include,
      orderBy: { attendanceDate: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.attendanceSession.findUnique({
      where: { id },
      include: this.include,
    });
  }

  async getRoster(sessionId: string) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: {
        scheduleId: true,
        activityId: true,
        schedule: { select: { template: { select: { sectionId: true } } } },
      },
    });
    if (!session) throw new NotFoundException('Attendance session not found.');
    const sectionId = session.schedule?.template.sectionId;
    if (session.scheduleId && !sectionId) {
      throw new BadRequestException('The lecture has no assigned section.');
    }
    if (!session.scheduleId && !session.activityId) {
      throw new BadRequestException('Attendance session has no lecture or activity.');
    }
    // Activities have no section/participant relationship in the existing schema.
    // Lecture rosters use explicit enrollment only, never names or prior attendance.
    return this.prisma.student.findMany({
      where: { isActive: true, ...(sectionId ? { sectionId } : {}) },
      select: {
        id: true, firstName: true, lastName: true, rollNumber: true,
        collegeId: true, photoKey: true, sectionId: true,
      },
      orderBy: { rollNumber: 'asc' },
    });
  }

  async findToday(scope: Prisma.AttendanceSessionWhereInput) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.attendanceSession.findMany({
      where: {
        AND: [scope],
        attendanceDate: { gte: today, lt: tomorrow },
      },
      include: this.include,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findBySchedule(scheduleId: string) {
    return this.prisma.attendanceSession.findFirst({
      where: { scheduleId },
      include: this.include,
    });
  }

  async findByActivity(activityId: string) {
    return this.prisma.attendanceSession.findFirst({
      where: { activityId },
      include: this.include,
    });
  }

  async findByFaculty(facultyId: string, scope: Prisma.AttendanceSessionWhereInput) {
    return this.prisma.attendanceSession.findMany({
      where: {
        AND: [scope],
        OR: [
          { takenById: facultyId },
          { schedule: { template: { facultyId } } },
          { activity: { facultyId } },
        ],
      },
      include: this.include,
      orderBy: { attendanceDate: 'desc' },
    });
  }

  async getFacultyIdForUser(userId: string): Promise<string | null> {
    const fac = await this.prisma.faculty.findUnique({ where: { userId } });
    return fac ? fac.id : null;
  }

  async create(data: CreateSessionDto & { takenById: string }) {
    return this.prisma.attendanceSession.create({
      data: {
        scheduleId: data.scheduleId ?? null,
        activityId: data.activityId ?? null,
        takenById: data.takenById,
        attendanceDate: new Date(data.attendanceDate),
        status: 'OPEN',
      },
      include: this.include,
    });
  }

  async submit(id: string) {
    return this.prisma.attendanceSession.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }
}
