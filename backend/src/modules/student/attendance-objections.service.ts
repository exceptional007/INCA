import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentPortalService, campusToday } from './student-portal.service';
import {
  CreateAttendanceObjectionDto,
  ReviewAttendanceObjectionDto,
} from './dto/student-portal.dto';

const studentInclude = {
  department: true,
  section: { include: { semester: { include: { program: true } } } },
  user: { select: { id: true, email: true } },
};
const details = {
  student: { include: studentInclude },
  attendanceSession: {
    include: {
      schedule: { include: { template: { include: { subject: true } } } },
    },
  },
};
@Injectable()
export class AttendanceObjectionsService {
  constructor(
    private readonly db: PrismaService,
    private readonly portal: StudentPortalService,
  ) {}
  private department(student: any) {
    return (
      student.departmentId || student.section?.semester?.program?.departmentId
    );
  }
  private allowed(actor: any, student: any) {
    return (
      actor?.isActive &&
      actor.role?.isActive &&
      actor.id !== student.userId &&
      (actor.role.code === 'ADMIN' ||
        (actor.role.code === 'HOD' &&
          !!actor.faculty?.departmentId &&
          actor.faculty.departmentId === this.department(student)))
    );
  }
  private async actor(id: string, tx: any = this.db) {
    const actor = await tx.user.findUnique({
      where: { id },
      include: { role: true, faculty: true },
    });
    if (
      !actor?.isActive ||
      !actor.role.isActive ||
      !['ADMIN', 'HOD'].includes(actor.role.code)
    )
      throw new ForbiddenException('Admin or HOD reviewer access required.');
    if (actor.role.code === 'HOD' && !actor.faculty?.departmentId)
      throw new ForbiddenException('Your HOD department must be assigned.');
    return actor;
  }
  async own(userId: string) {
    const student = await this.portal.student(userId);
    return this.db.attendanceObjection.findMany({
      where: { studentId: student.id },
      include: { attendanceSession: details.attendanceSession },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async create(userId: string, dto: CreateAttendanceObjectionDto) {
    const reason = dto.reason.trim();
    if (reason.length < 3 || reason.length > 2000)
      throw new BadRequestException(
        'Give a reason between 3 and 2000 characters.',
      );
    const student = await this.portal.student(userId);
    try {
      return await this.db.$transaction(async (tx) => {
        const session = await tx.attendanceSession.findUnique({
          where: { id: dto.sessionId },
          include: {
            schedule: { include: { template: true } },
            records: { where: { studentId: student.id } },
          },
        });
        if (
          !session ||
          session.status !== 'SUBMITTED' ||
          !session.schedule ||
          session.schedule.status === 'CANCELLED' ||
          session.attendanceDate.toISOString().slice(0, 10) > campusToday()
        )
          throw new BadRequestException(
            'Only submitted past or present lectures can be disputed.',
          );
        if (
          !session.records.length &&
          (!student.sectionId ||
            session.schedule.template.sectionId !== student.sectionId)
        )
          throw new ForbiddenException(
            'This lecture does not belong to your timetable.',
          );
        const request = await tx.attendanceObjection.create({
          data: {
            studentId: student.id,
            attendanceSessionId: session.id,
            reason,
            originalStatus: session.records[0]?.status || null,
            requestedStatus: dto.requestedStatus || null,
          },
        });
        const reviewers = await tx.user.findMany({
          where: {
            isActive: true,
            role: { isActive: true, code: { in: ['ADMIN', 'HOD'] } },
          },
          include: { role: true, faculty: true },
        });
        for (const reviewer of reviewers.filter((actor) =>
          this.allowed(actor, student),
        ))
          await tx.notifications.create({
            data: {
              userId: reviewer.id,
              type: 'ATTENDANCE_OBJECTION',
              title: 'Attendance objection awaiting review',
              message: `${student.rollNumber} raised a lecture objection. Open Attendance objections to review it.`,
            },
          });
        return request;
      });
    } catch (error) {
      if (error.code === 'P2002')
        throw new ConflictException(
          'You already have a pending objection for this lecture.',
        );
      throw error;
    }
  }
  async queue(userId: string) {
    const actor = await this.actor(userId);
    const departmentId = actor.faculty?.departmentId;
    return this.db.attendanceObjection.findMany({
      where: {
        student: {
          userId: { not: userId },
          ...(actor.role.code === 'HOD'
            ? {
                OR: [
                  { departmentId },
                  {
                    departmentId: null,
                    section: { semester: { program: { departmentId } } },
                  },
                ],
              }
            : {}),
        },
      },
      include: details,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }
  async review(userId: string, id: string, dto: ReviewAttendanceObjectionDto) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const actor = await this.actor(userId, tx);
          const request = await tx.attendanceObjection.findUnique({
            where: { id },
            include: details,
          });
          if (!request) throw new NotFoundException('Objection not found.');
          if (!this.allowed(actor, request.student))
            throw new ForbiddenException(
              'You cannot review this student’s objection.',
            );
          if (request.status !== 'PENDING')
            throw new ConflictException(
              'This objection has already been reviewed.',
            );
          const remark = dto.remark?.trim() || null;
          const claimed = await tx.attendanceObjection.updateMany({
            where: { id, status: 'PENDING' },
            data: {
              status: dto.decision,
              reviewerId: userId,
              reviewedAt: new Date(),
              reviewRemark: remark,
            },
          });
          if (claimed.count !== 1)
            throw new ConflictException(
              'This objection has already been reviewed.',
            );
          if (dto.decision === 'APPROVED' && request.requestedStatus) {
            const session = request.attendanceSession;
            if (
              session.status !== 'SUBMITTED' ||
              !session.schedule ||
              session.schedule.status === 'CANCELLED'
            )
              throw new ConflictException(
                'The lecture is no longer available for correction.',
              );
            const key = {
              attendanceSessionId: request.attendanceSessionId,
              studentId: request.studentId,
            };
            const record = await tx.attendanceRecord.findUnique({
              where: { attendanceSessionId_studentId: key },
            });
            if ((record?.status || null) !== request.originalStatus)
              throw new ConflictException(
                'Attendance changed since this request. Reject it with a remark so the student can submit a fresh objection if needed.',
              );
            const updated = await tx.attendanceRecord.upsert({
              where: { attendanceSessionId_studentId: key },
              create: { ...key, status: request.requestedStatus },
              update: { status: request.requestedStatus },
            });
            await tx.attendanceAudit.create({
              data: {
                attendanceRecordId: updated.id,
                oldStatus: record?.status || 'NOT_RECORDED',
                newStatus: request.requestedStatus,
                editedById: userId,
                reason: `Objection ${id}: ${request.reason}${remark ? ` — ${remark}` : ''}`,
              },
            });
          }
          await tx.notifications.create({
            data: {
              userId: request.student.userId,
              type: 'ATTENDANCE_OBJECTION_REVIEWED',
              title: `Attendance objection ${dto.decision.toLowerCase()}`,
              message:
                remark ||
                'Open your timetable or attendance report to see the decision.',
            },
          });
          return tx.attendanceObjection.findUnique({ where: { id } });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error.code === 'P2034')
        throw new ConflictException(
          'Another update occurred. Refresh and try again.',
        );
      throw error;
    }
  }
}
