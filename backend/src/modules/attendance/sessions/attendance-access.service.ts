import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AttendanceActor {
  id: string;
  role: string;
}

@Injectable()
export class AttendanceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private async departmentIdForActor(actor: AttendanceActor): Promise<string> {
    let departmentId: string | null | undefined;
    if (actor.role === 'ADMIN') {
      departmentId = (
        await this.prisma.adminProfile.findUnique({
          where: { userId: actor.id },
        })
      )?.departmentId;
    } else if (actor.role === 'HOD') {
      departmentId = (
        await this.prisma.faculty.findUnique({ where: { userId: actor.id } })
      )?.departmentId;
    }
    if (!departmentId)
      throw new ForbiddenException(
        'No authorized attendance department assigned.',
      );
    return departmentId;
  }

  private async sourceScopes(
    actor: AttendanceActor,
    write: boolean,
  ): Promise<{
    schedule: Prisma.ScheduleWhereInput;
    activity: Prisma.ActivityWhereInput;
  }> {
    if (!actor?.id || !actor.role)
      throw new ForbiddenException('Authenticated attendance actor required.');
    if (
      actor.role === 'COORDINATOR' ||
      (!write && actor.role === 'SUPER_ADMIN')
    ) {
      return { schedule: {}, activity: {} };
    }
    if (actor.role === 'FACULTY') {
      return {
        schedule: {
          OR: [
            { template: { faculty: { userId: actor.id } } },
            { exceptions: { some: { newFaculty: { userId: actor.id } } } },
          ],
        },
        activity: { faculty: { userId: actor.id } },
      };
    }
    const departmentId = await this.departmentIdForActor(actor);
    return {
      schedule: {
        template: { section: { semester: { program: { departmentId } } } },
      },
      activity: { faculty: { departmentId } },
    };
  }

  async sessionScope(
    actor: AttendanceActor,
    write = false,
  ): Promise<Prisma.AttendanceSessionWhereInput> {
    const scopes = await this.sourceScopes(actor, write);
    return {
      OR: [
        { schedule: scopes.schedule },
        { activity: scopes.activity },
        ...(actor.role === 'FACULTY'
          ? [{ takenBy: { userId: actor.id } }]
          : []),
      ],
    };
  }

  async assertSessionAccess(
    sessionId: string,
    actor: AttendanceActor,
    write = false,
  ) {
    const scope = await this.sessionScope(actor, write);
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, AND: [scope] },
      select: { id: true },
    });
    if (!session)
      throw new ForbiddenException(
        'You do not have access to this attendance session.',
      );
  }

  async assertSourceAccess(
    actor: AttendanceActor,
    source: { scheduleId?: string; activityId?: string },
  ) {
    const scopes = await this.sourceScopes(actor, true);
    if (source.scheduleId) {
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: source.scheduleId },
        select: { id: true },
      });
      if (!schedule) throw new NotFoundException('Schedule not found.');
      const allowed = await this.prisma.schedule.findFirst({
        where: { id: source.scheduleId, AND: [scopes.schedule] },
        select: { id: true },
      });
      if (!allowed)
        throw new ForbiddenException(
          'You are not assigned to this lecture or its department.',
        );
    } else if (source.activityId) {
      const activity = await this.prisma.activity.findUnique({
        where: { id: source.activityId },
        select: { id: true },
      });
      if (!activity) throw new NotFoundException('Activity not found.');
      const allowed = await this.prisma.activity.findFirst({
        where: { id: source.activityId, AND: [scopes.activity] },
        select: { id: true },
      });
      if (!allowed)
        throw new ForbiddenException(
          'You are not assigned to this activity or its department.',
        );
    }
  }

  async facultyIdForActor(actor: AttendanceActor): Promise<string> {
    const faculty = await this.prisma.faculty.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!faculty)
      throw new ForbiddenException(
        'Your own faculty profile is required to open an attendance session.',
      );
    return faculty.id;
  }

  async demoSlotScope(
    actor: AttendanceActor,
  ): Promise<Prisma.TimetableSlotWhereInput> {
    if (!actor?.id)
      throw new ForbiddenException('Authenticated attendance actor required.');
    if (actor.role === 'COORDINATOR') return {};
    if (actor.role === 'FACULTY') return { faculty: { userId: actor.id } };
    const departmentId = await this.departmentIdForActor(actor);
    return {
      version: { section: { semester: { program: { departmentId } } } },
    };
  }
}
