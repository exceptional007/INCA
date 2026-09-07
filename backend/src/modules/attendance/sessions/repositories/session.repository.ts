import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateSessionDto } from '../dto/create-session.dto';

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
            faculty: { include: { user: true } },
            room: true,
          },
        },
      },
    },
    activity: {
      include: { activityType: true, room: true },
    },
    takenBy: { include: { user: true } },
    records: {
      include: { student: true },
    },
  };

  async findAll() {
    return this.prisma.attendanceSession.findMany({
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

  async findToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.attendanceSession.findMany({
      where: {
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

  async findByFaculty(facultyId: string) {
    return this.prisma.attendanceSession.findMany({
      where: {
        OR: [
          { takenById: facultyId },
          { schedule: { template: { facultyId } } },
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

  async create(data: CreateSessionDto) {
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
