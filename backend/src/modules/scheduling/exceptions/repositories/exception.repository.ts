import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, ScheduleStatus } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateExceptionDto } from '../dto/create-exception.dto';
import { UpdateExceptionDto } from '../dto/update-exception.dto';

@Injectable()
export class ExceptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminDepartmentId(userId: string): Promise<string | null> {
    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId },
      select: { departmentId: true },
    });
    return profile?.departmentId ?? null;
  }
  async getScheduleDepartmentId(scheduleId: string): Promise<string | null> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: {
        template: {
          select: {
            section: {
              select: {
                semester: {
                  select: { program: { select: { departmentId: true } } },
                },
              },
            },
          },
        },
      },
    });
    return schedule?.template.section.semester.program.departmentId ?? null;
  }
  async findAll() {
    return this.prisma.scheduleException.findMany({
      include: {
        schedule: {
          include: {
            template: {
              include: { subject: true, section: true },
            },
          },
        },
        newFaculty: {
          include: {
            user: {
              select: { id: true, email: true, isActive: true },
            },
          },
        },
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
              include: { subject: true, section: true },
            },
          },
        },
        newFaculty: {
          include: {
            user: {
              select: { id: true, email: true, isActive: true },
            },
          },
        },
        newRoom: true,
      },
    });
  }

  private async lockSchedules(
    tx: Prisma.TransactionClient,
    scheduleIds: string[],
  ) {
    // All mutations lock schedules in the same order before reading remaining exceptions.
    for (const id of [...new Set(scheduleIds)].sort()) {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM schedules WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Schedule not found.');
    }
  }

  private async lockException(
    tx: Prisma.TransactionClient,
    id: string,
    expectedScheduleId: string,
  ) {
    const rows = await tx.$queryRaw<
      { scheduleId: string }[]
    >`SELECT "scheduleId" FROM schedule_exceptions WHERE id = ${id} FOR UPDATE`;
    if (!rows.length)
      throw new NotFoundException('Schedule exception not found.');
    if (rows[0].scheduleId !== expectedScheduleId) {
      throw new ConflictException(
        'This exception was moved to another schedule. Reload it before trying again.',
      );
    }
  }

  private async refreshStatuses(
    tx: Prisma.TransactionClient,
    scheduleIds: string[],
  ) {
    for (const id of [...new Set(scheduleIds)].sort()) {
      const schedule = await tx.schedule.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      if (schedule.status === ScheduleStatus.COMPLETED) continue;
      const exceptions = await tx.scheduleException.findMany({
        where: { scheduleId: id },
      });
      const status = exceptions.some((e) => e.exceptionType === 'CANCELLATION')
        ? ScheduleStatus.CANCELLED
        : exceptions.some(
              (e) =>
                e.exceptionType === 'RESCHEDULE' ||
                e.newStartTime ||
                e.newEndTime ||
                e.newRoomId ||
                e.newFacultyId,
            )
          ? ScheduleStatus.RESCHEDULED
          : ScheduleStatus.SCHEDULED;
      await tx.schedule.update({ where: { id }, data: { status } });
    }
  }

  async create(data: CreateExceptionDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSchedules(tx, [data.scheduleId]);
      const exception = await tx.scheduleException.create({
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
      await this.refreshStatuses(tx, [data.scheduleId]);
      return exception;
    });
  }

  async update(
    id: string,
    data: UpdateExceptionDto,
    expectedScheduleId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockException(tx, id, expectedScheduleId);
      const scheduleIds = [
        expectedScheduleId,
        data.scheduleId ?? expectedScheduleId,
      ];
      await this.lockSchedules(tx, scheduleIds);
      const exception = await tx.scheduleException.update({
        where: { id },
        data,
      });
      await this.refreshStatuses(tx, scheduleIds);
      return exception;
    });
  }

  async remove(id: string, expectedScheduleId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockException(tx, id, expectedScheduleId);
      await this.lockSchedules(tx, [expectedScheduleId]);
      const exception = await tx.scheduleException.delete({ where: { id } });
      await this.refreshStatuses(tx, [expectedScheduleId]);
      return exception;
    });
  }
}
