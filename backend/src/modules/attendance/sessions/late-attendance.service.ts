import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AttendanceActor } from './attendance-access.service';

const person = { select: { id: true, email: true } };
const scheduleInclude = {
  template: {
    include: {
      subject: true,
      faculty: { select: { id: true, userId: true, isActive: true } },
      section: { include: { semester: { include: { program: true } } } },
    },
  },
  exceptions: {
    orderBy: { updatedAt: 'desc' as const },
    take: 1,
    include: {
      newFaculty: { select: { id: true, userId: true, isActive: true } },
    },
  },
  attendanceSessions: { select: { id: true, status: true } },
};
export function lectureWindow(schedule: any) {
  const override = schedule.exceptions?.[0];
  function minutes(text: string) {
    const match = text?.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match)
      throw new BadRequestException(
        'The lecture time is invalid. Ask administration to correct it.',
      );
    let h = Number(match[1]);
    const m = Number(match[2]);
    if (m > 59 || (match[3] ? h < 1 || h > 12 : h > 23))
      throw new BadRequestException('The lecture time is invalid.');
    if (match[3]) h = (h % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return h * 60 + m;
  }
  const date = new Date(schedule.lectureDate).toISOString().slice(0, 10);
  const midnight = new Date(`${date}T00:00:00+05:30`).getTime();
  const start =
    midnight +
    minutes(override?.newStartTime || schedule.template.startTime) * 60000;
  const end =
    midnight +
    minutes(override?.newEndTime || schedule.template.endTime) * 60000;
  if (end <= start)
    throw new BadRequestException(
      'The lecture end time must follow its start time. Ask administration to correct the timetable.',
    );
  return { opens: start - 10 * 60000, closes: end + 15 * 60000 };
}
@Injectable()
export class LateAttendanceService {
  constructor(private readonly db: PrismaService) {}
  private async actor(id: string, tx: any = this.db) {
    const user = await tx.user.findUnique({
      where: { id },
      include: { role: true, faculty: true, adminProfile: true },
    });
    if (!user?.isActive || !user.role.isActive)
      throw new ForbiddenException('Active account required.');
    return user;
  }
  private department(actor: any) {
    return actor.role.code === 'ADMIN'
      ? actor.adminProfile?.departmentId
      : actor.faculty?.departmentId;
  }
  private departmentOf(schedule: any) {
    return schedule.template.section.semester.program.departmentId;
  }
  private owner(schedule: any, userId: string) {
    const teacher =
      schedule.exceptions?.[0]?.newFaculty || schedule.template.faculty;
    return teacher?.isActive && teacher.userId === userId;
  }
  private revision(schedule: any) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          date: new Date(schedule.lectureDate).toISOString(),
          status: schedule.status,
          template: {
            id: schedule.templateId,
            section: schedule.template.sectionId,
            subject: schedule.template.subjectId,
            faculty: schedule.template.faculty?.id,
            start: schedule.template.startTime,
            end: schedule.template.endTime,
          },
          exception: schedule.exceptions?.[0]
            ? {
                id: schedule.exceptions[0].id,
                faculty: schedule.exceptions[0].newFacultyId,
                start: schedule.exceptions[0].newStartTime,
                end: schedule.exceptions[0].newEndTime,
                updated: schedule.exceptions[0].updatedAt,
              }
            : null,
        }),
      )
      .digest('hex');
  }
  private async schedule(id: string, tx: any = this.db) {
    const schedule = await tx.schedule.findUnique({
      where: { id },
      include: scheduleInclude,
    });
    if (!schedule) throw new NotFoundException('Lecture not found.');
    return schedule;
  }
  private unlocked(schedule: any) {
    if (schedule.status === 'CANCELLED')
      throw new ConflictException('Cancelled lectures cannot be marked.');
    if (schedule.attendanceSessions.some((s) => s.status === 'SUBMITTED'))
      throw new ConflictException(
        'This lecture is already submitted and locked. Use audited corrections.',
      );
  }
  private async event(
    tx: any,
    requestId: string,
    actorId: string,
    action: string,
  ) {
    await tx.lateAttendanceEvent.create({
      data: { requestId, actorId, action },
    });
  }
  private async transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    try {
      return await this.db.$transaction(work, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (error.code === 'P2002')
        throw new ConflictException(
          'A pending request already exists for this lecture.',
        );
      if (error.code === 'P2034')
        throw new ConflictException(
          'Another update occurred. Refresh and retry.',
        );
      throw error;
    }
  }
  async create(userId: string, scheduleId: string, input: string) {
    const reason = input.trim();
    if (reason.length < 3 || reason.length > 2000)
      throw new BadRequestException(
        'Provide a reason between 3 and 2000 characters.',
      );
    return this.transaction(async (tx) => {
      const actor = await this.actor(userId, tx),
        schedule = await this.schedule(scheduleId, tx);
      if (actor.role.code !== 'FACULTY' || !this.owner(schedule, userId))
        throw new ForbiddenException(
          'Only the currently assigned faculty may request permission for this lecture.',
        );
      this.unlocked(schedule);
      if (Date.now() <= lectureWindow(schedule).closes)
        throw new BadRequestException(
          'Late approval is only needed after the lecture’s 15-minute grace period.',
        );
      const revision = this.revision(schedule);
      if (
        await tx.lateAttendanceRequest.findFirst({
          where: {
            scheduleId,
            requesterId: userId,
            status: 'APPROVED',
            usedAt: null,
            expiresAt: { gt: new Date() },
            scheduleRevision: revision,
          },
        })
      )
        throw new ConflictException(
          'You already have valid permission for this lecture.',
        );
      const override = schedule.exceptions?.[0];
      const request = await tx.lateAttendanceRequest.create({
        data: {
          scheduleId,
          requesterId: userId,
          reason,
          scheduleRevision: revision,
          snapshot: {
            date: new Date(schedule.lectureDate).toISOString().slice(0, 10),
            subject: schedule.template.subject.name,
            code: schedule.template.subject.code,
            section: schedule.template.section.name,
            program: schedule.template.section.semester.program.name,
            semester: schedule.template.section.semester.number,
            startTime: override?.newStartTime || schedule.template.startTime,
            endTime: override?.newEndTime || schedule.template.endTime,
          },
        },
      });
      await this.event(tx, request.id, userId, 'REQUESTED');
      const reviewers = await tx.user.findMany({
        where: {
          isActive: true,
          role: { isActive: true, code: { in: ['ADMIN', 'HOD'] } },
        },
        include: { role: true, faculty: true, adminProfile: true },
      });
      for (const reviewer of reviewers.filter(
        (r) =>
          r.id !== userId && this.department(r) === this.departmentOf(schedule),
      ))
        await tx.notifications.create({
          data: {
            userId: reviewer.id,
            type: 'LATE_ATTENDANCE_REQUESTED',
            title: 'Late attendance awaiting review',
            message: `${actor.email} requested late attendance for ${schedule.template.subject.code}. Open Late attendance approvals.`,
          },
        });
      return request;
    });
  }
  private state(row: any) {
    if (row.usedAt) return 'USED';
    if (row.status !== 'PENDING' && row.status !== 'APPROVED')
      return row.status;
    if (row.schedule.attendanceSessions.some((s) => s.status === 'SUBMITTED'))
      return 'LOCKED';
    if (
      row.schedule.status === 'CANCELLED' ||
      row.scheduleRevision !== this.revision(row.schedule) ||
      !this.owner(row.schedule, row.requesterId)
    )
      return 'STALE';
    if (
      row.status === 'APPROVED' &&
      (!row.expiresAt || row.expiresAt <= new Date())
    )
      return 'EXPIRED';
    return row.status;
  }
  private display(rows: any[]) {
    return rows.map(({ schedule, ...row }) => ({
      ...row,
      effectiveStatus: this.state({ ...row, schedule }),
      canCancel: !row.usedAt && ['PENDING', 'APPROVED'].includes(row.status),
    }));
  }
  async mine(userId: string) {
    const actor = await this.actor(userId);
    if (actor.role.code !== 'FACULTY')
      throw new ForbiddenException('Faculty access required.');
    const rows = await this.db.lateAttendanceRequest.findMany({
      where: { requesterId: userId },
      include: { schedule: { include: scheduleInclude }, reviewer: person },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    const items = this.display(rows);
    return {
      items,
      approvedScheduleIds: items
        .filter((r) => r.effectiveStatus === 'APPROVED')
        .map((r) => r.scheduleId),
    };
  }
  async queue(userId: string) {
    const actor = await this.actor(userId),
      departmentId = this.department(actor);
    if (!['ADMIN', 'HOD'].includes(actor.role.code) || !departmentId)
      throw new ForbiddenException(
        'An assigned Admin/HOD department is required.',
      );
    const rows = await this.db.lateAttendanceRequest.findMany({
      where: {
        requesterId: { not: userId },
        schedule: {
          template: { section: { semester: { program: { departmentId } } } },
        },
      },
      include: {
        schedule: { include: scheduleInclude },
        requester: person,
        reviewer: person,
        events: { include: { actor: person }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return this.display(rows);
  }
  async review(
    userId: string,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    input?: string,
  ) {
    if (!['APPROVED', 'REJECTED'].includes(decision))
      throw new BadRequestException('Invalid decision.');
    if (input && input.length > 2000)
      throw new BadRequestException('Remark is too long.');
    return this.transaction(async (tx) => {
      const actor = await this.actor(userId, tx);
      const request = await tx.lateAttendanceRequest.findUnique({
        where: { id },
        include: {
          schedule: { include: scheduleInclude },
          requester: { include: { role: true } },
        },
      });
      if (!request) throw new NotFoundException('Request not found.');
      if (
        !['ADMIN', 'HOD'].includes(actor.role.code) ||
        !this.department(actor) ||
        this.department(actor) !== this.departmentOf(request.schedule) ||
        userId === request.requesterId
      )
        throw new ForbiddenException('You cannot review this request.');
      if (request.status !== 'PENDING')
        throw new ConflictException('This request has already been decided.');
      if (decision === 'APPROVED') {
        this.unlocked(request.schedule);
        if (
          !request.requester.isActive ||
          !request.requester.role.isActive ||
          request.requester.role.code !== 'FACULTY' ||
          this.state(request) !== 'PENDING'
        )
          throw new ConflictException(
            'The faculty assignment or lecture changed. Reject this request and ask for a new one.',
          );
      }
      const expiresAt =
        decision === 'APPROVED' ? new Date(Date.now() + 24 * 3600000) : null;
      const result = await tx.lateAttendanceRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: decision,
          reviewerId: userId,
          reviewedAt: new Date(),
          expiresAt,
          reviewRemark: input?.trim() || null,
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Another reviewer already decided this request.',
        );
      await this.event(tx, id, userId, decision);
      await tx.notifications.create({
        data: {
          userId: request.requesterId,
          type: 'LATE_ATTENDANCE_REVIEWED',
          title: `Late attendance ${decision.toLowerCase()}`,
          message:
            input?.trim() ||
            (decision === 'APPROVED'
              ? 'Permission is valid for 24 hours and one lecture submission.'
              : 'Your request was rejected. Open Late attendance approvals for details.'),
        },
      });
      return tx.lateAttendanceRequest.findUnique({ where: { id } });
    });
  }
  async cancel(userId: string, id: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(userId, tx);
      if (actor.role.code !== 'FACULTY')
        throw new ForbiddenException('Faculty access required.');
      const result = await tx.lateAttendanceRequest.updateMany({
        where: {
          id,
          requesterId: userId,
          status: { in: ['PENDING', 'APPROVED'] },
          usedAt: null,
        },
        data: { status: 'CANCELLED' },
      });
      if (result.count !== 1)
        throw new ConflictException('This request cannot be cancelled.');
      await this.event(tx, id, userId, 'CANCELLED');
      return { cancelled: true };
    });
  }
  async enforce(
    scheduleId: string | null,
    actor: AttendanceActor,
    tx: any = this.db,
  ) {
    if (!scheduleId || actor.role !== 'FACULTY') return null;
    const schedule = await this.schedule(scheduleId, tx);
    if (!this.owner(schedule, actor.id))
      throw new ForbiddenException(
        'You are no longer the assigned faculty for this lecture.',
      );
    this.unlocked(schedule);
    const window = lectureWindow(schedule),
      now = Date.now();
    if (now < window.opens)
      throw new ForbiddenException(
        'Attendance opens ten minutes before the lecture.',
      );
    if (now <= window.closes) return null;
    const permission = await tx.lateAttendanceRequest.findFirst({
      where: {
        scheduleId,
        requesterId: actor.id,
        status: 'APPROVED',
        usedAt: null,
        expiresAt: { gt: new Date(now) },
        scheduleRevision: this.revision(schedule),
      },
      orderBy: { reviewedAt: 'desc' },
    });
    if (!permission)
      throw new ForbiddenException({
        code: 'LATE_ATTENDANCE_APPROVAL_REQUIRED',
        message:
          'The 15-minute grace period has ended. Request Admin/HOD approval before saving or submitting attendance.',
      });
    return permission;
  }
  async consume(permission: any, actor: AttendanceActor, tx: any) {
    if (!permission) return;
    const result = await tx.lateAttendanceRequest.updateMany({
      where: {
        id: permission.id,
        status: 'APPROVED',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'Late permission expired or was used. Request a new approval.',
      );
    await this.event(tx, permission.id, actor.id, 'USED');
  }
}
