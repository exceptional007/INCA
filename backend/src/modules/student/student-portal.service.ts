import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentAttendanceFilterDto } from './dto/student-portal.dto';

export const campusToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const iso = (value: Date) => value.toISOString().slice(0, 10);
const fullDay = (value: string) => ({ MON: 'Monday', MONDAY: 'Monday', TUE: 'Tuesday', TUES: 'Tuesday', TUESDAY: 'Tuesday', WED: 'Wednesday', WEDNESDAY: 'Wednesday', THU: 'Thursday', THURS: 'Thursday', THURSDAY: 'Thursday', FRI: 'Friday', FRIDAY: 'Friday', SAT: 'Saturday', SATURDAY: 'Saturday', SUN: 'Sunday', SUNDAY: 'Sunday' })[value.toUpperCase()] || value;
const person = (value: any) =>
  value
    ? [value.firstName, value.lastName].filter(Boolean).join(' ')
    : 'Not assigned';
const subject = { select: { id: true, code: true, name: true } };
const faculty = { select: { firstName: true, lastName: true } };
const room = { select: { code: true, name: true } };
const objectionSelect = {
  id: true,
  status: true,
  requestedStatus: true,
  reason: true,
  reviewRemark: true,
  reviewedAt: true,
  createdAt: true,
};

@Injectable()
export class StudentPortalService {
  constructor(private readonly db: PrismaService) {}

  async student(userId: string) {
    const student = await this.db.student.findFirst({
      where: {
        userId,
        isActive: true,
        user: { isActive: true, role: { code: 'STUDENT', isActive: true } },
      },
      include: {
        department: true,
        section: {
          include: {
            semester: {
              include: { program: { include: { department: true } } },
            },
          },
        },
      },
    });
    if (!student)
      throw new ForbiddenException(
        'Your active student profile is required. Contact administration.',
      );
    return student;
  }

  async context(userId: string) {
    const student = await this.student(userId);
    const subjects = await this.db.subject.findMany({
      where: {
        OR: [
          ...(student.sectionId
            ? [
                {
                  scheduleTemplates: { some: { sectionId: student.sectionId } },
                },
                {
                  timetableSlots: {
                    some: {
                      version: { sectionId: student.sectionId, isActive: true },
                    },
                  },
                },
              ]
            : []),
          {
            scheduleTemplates: {
              some: {
                schedules: {
                  some: {
                    attendanceSessions: {
                      some: {
                        status: 'SUBMITTED',
                        records: { some: { studentId: student.id } },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    return {
      studentId: student.id,
      name: person(student),
      rollNumber: student.rollNumber,
      section: student.section
        ? {
            id: student.section.id,
            name: student.section.name,
            semester: student.section.semester.number,
            program: student.section.semester.program.name,
          }
        : null,
      department:
        student.department?.name ||
        student.section?.semester.program.department?.name ||
        null,
      subjects,
    };
  }

  async timetable(userId: string, selectedDate = campusToday()) {
    const student = await this.student(userId);
    const [version, schedules] = await Promise.all([
      student.sectionId
        ? this.db.timetableVersion.findFirst({
            where: { sectionId: student.sectionId, isActive: true, effectiveFrom: { lte: day(campusToday()) } },
            orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
            include: { slots: { include: { subject, faculty, room } } },
          })
        : null,
      this.db.schedule.findMany({
        where: {
          lectureDate: day(selectedDate),
          OR: [
            ...(student.sectionId
              ? [{ template: { sectionId: student.sectionId } }]
              : []),
            {
              attendanceSessions: {
                some: {
                  status: 'SUBMITTED',
                  records: { some: { studentId: student.id } },
                },
              },
            },
          ],
        },
        include: {
          template: { include: { subject, faculty, room } },
          exceptions: {
            orderBy: { updatedAt: 'desc' },
            include: { newFaculty: faculty, newRoom: room },
          },
          attendanceSessions: {
            where: { status: 'SUBMITTED' },
            orderBy: { submittedAt: 'desc' },
            include: {
              records: {
                where: { studentId: student.id },
                select: { id: true, status: true, remarks: true },
              },
              objections: {
                where: { studentId: student.id },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: objectionSelect,
              },
            },
          },
        },
        orderBy: { template: { startTime: 'asc' } },
      }),
    ]);
    const templates =
      !version && student.sectionId
        ? await this.db.scheduleTemplate.findMany({
            where: {
              sectionId: student.sectionId,
              effectiveFrom: { lte: day(campusToday()) },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: day(campusToday()) } },
              ],
            },
            include: { subject, faculty, room },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          })
        : [];
    const weekdays = [
      '',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    const weekly = version
      ? version.slots.map((slot) => ({
          id: slot.id,
          day: fullDay(slot.day),
          startTime: slot.timeSlotStart,
          endTime: slot.timeSlotEnd,
          subject: slot.subject,
          faculty: person(slot.faculty),
          room: slot.room.code || slot.room.name,
        }))
      : templates.map((template) => ({
          id: template.id,
          day: weekdays[template.dayOfWeek],
          startTime: template.startTime,
          endTime: template.endTime,
          subject: template.subject,
          faculty: person(template.faculty),
          room: template.room.code || template.room.name,
        }));
    const lectures = schedules.map((schedule) => {
      const session =
        schedule.attendanceSessions.find((item) => item.records.length > 0) ||
        schedule.attendanceSessions[0];
      const record = session?.records[0];
      const exception = schedule.exceptions[0];
      const objection = session?.objections[0] || null;
      return {
        scheduleId: schedule.id,
        sessionId: session?.id || null,
        recordId: record?.id || null,
        date: selectedDate,
        subject: schedule.template.subject,
        faculty: person(exception?.newFaculty || schedule.template.faculty),
        room: (exception?.newRoom || schedule.template.room).code,
        startTime: exception?.newStartTime || schedule.template.startTime,
        endTime: exception?.newEndTime || schedule.template.endTime,
        lectureStatus: schedule.status,
        attendanceStatus: record?.status || 'NOT_RECORDED',
        remarks: record?.remarks || null,
        objection,
        canObject:
          schedule.status !== 'CANCELLED' &&
          !!session &&
          selectedDate <= campusToday() &&
          objection?.status !== 'PENDING',
      };
    });
    return {
      date: selectedDate,
      sectionAssigned: !!student.sectionId,
      weekly,
      weeklyEffectiveFrom: version?.effectiveFrom
        ? iso(version.effectiveFrom)
        : null,
      lectures,
    };
  }

  async attendance(userId: string, filters: StudentAttendanceFilterDto) {
    const student = await this.student(userId);
    if (filters.date && (filters.startDate || filters.endDate))
      throw new BadRequestException(
        'Choose a single date or a date range, not both.',
      );
    if (
      filters.startDate &&
      filters.endDate &&
      filters.startDate > filters.endDate
    )
      throw new BadRequestException(
        'The start date must be on or before the end date.',
      );
    const start = filters.date || filters.startDate;
    const end = filters.date || filters.endDate;
    const sessionWhere: any = {
      status: 'SUBMITTED',
      ...(start || end
        ? {
            attendanceDate: {
              ...(start ? { gte: day(start) } : {}),
              ...(end ? { lte: day(end) } : {}),
            },
          }
        : {}),
      ...(filters.subjectId
        ? { schedule: { template: { subjectId: filters.subjectId } } }
        : {}),
    };
    const where = { studentId: student.id, attendanceSession: sessionWhere };
    const page = filters.page || 1,
      limit = filters.limit || 25;
    const [counts, records] = await Promise.all([
      this.db.attendanceRecord.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.db.attendanceRecord.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { attendanceSession: { attendanceDate: 'desc' } },
          { id: 'asc' },
        ],
        select: {
          id: true,
          status: true,
          remarks: true,
          attendanceSession: {
            select: {
              id: true,
              attendanceDate: true,
              schedule: {
                select: {
                  status: true,
                  template: {
                    select: {
                      subject,
                      startTime: true,
                      endTime: true,
                      faculty,
                      room,
                    },
                  },
                },
              },
              activity: { select: { title: true } },
              objections: {
                where: { studentId: student.id },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: objectionSelect,
              },
            },
          },
        },
      }),
    ]);
    const statuses: Record<string, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };
    for (const row of counts) statuses[row.status] = row._count._all;
    const total = Object.values(statuses).reduce((a, b) => a + b, 0);
    const attended = statuses.PRESENT + statuses.LATE + statuses.EXCUSED;
    const items = records.map((record) => {
      const session = record.attendanceSession,
        template = session.schedule?.template,
        objection = session.objections[0] || null;
      return {
        recordId: record.id,
        sessionId: session.id,
        date: iso(session.attendanceDate),
        subject: template?.subject || {
          id: null,
          code: 'ACT',
          name: session.activity?.title || 'Campus activity',
        },
        startTime: template?.startTime || '',
        endTime: template?.endTime || '',
        faculty: person(template?.faculty),
        room: template?.room.code || '',
        attendanceStatus: record.status,
        remarks: record.remarks,
        objection,
        canObject:
          !!session.schedule &&
          session.schedule.status !== 'CANCELLED' &&
          iso(session.attendanceDate) <= campusToday() &&
          objection?.status !== 'PENDING',
      };
    });
    return {
      summary: {
        total,
        attended,
        percentage: total ? Math.round((attended / total) * 1000) / 10 : null,
        ...statuses,
      },
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
