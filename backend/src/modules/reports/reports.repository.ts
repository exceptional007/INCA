import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Student: all records for a student ───────────────────────────────────
  async getStudentRecords(
    studentId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        attendanceSession: {
          status: 'SUBMITTED',
          attendanceDate: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        },
      },
      include: {
        attendanceSession: {
          include: {
            schedule: {
              include: {
                template: { include: { subject: true, section: true } },
              },
            },
            activity: { include: { activityType: true } },
          },
        },
      },
    });
  }

  // ── Section: all submitted sessions for a section ────────────────────────
  async getSectionSessions(
    sectionId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.prisma.attendanceSession.findMany({
      where: {
        status: 'SUBMITTED',
        schedule: {
          template: { sectionId },
        },
        attendanceDate: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      },
      include: {
        schedule: {
          include: {
            template: { include: { subject: true } },
          },
        },
        records: { include: { student: true } },
      },
    });
  }

  // ── Subject: all submitted sessions for a subject ────────────────────────
  async getSubjectSessions(
    subjectId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.prisma.attendanceSession.findMany({
      where: {
        status: 'SUBMITTED',
        schedule: {
          template: { subjectId },
        },
        attendanceDate: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      },
      include: {
        schedule: {
          include: {
            template: { include: { subject: true, section: true } },
          },
        },
        records: { include: { student: true } },
      },
    });
  }

  // ── Faculty: all submitted sessions taken by a faculty ───────────────────
  async getFacultySessions(
    facultyId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.prisma.attendanceSession.findMany({
      where: {
        status: 'SUBMITTED',
        takenById: facultyId,
        attendanceDate: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      },
      include: {
        schedule: {
          include: {
            template: { include: { subject: true, section: true } },
          },
        },
        activity: { include: { activityType: true } },
        records: true,
      },
    });
  }

  // ── Student lookup ────────────────────────────────────────────────────────
  async getStudent(studentId: string) {
    return this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
  }

  async getFaculty(facultyId: string) {
    return this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: { user: true },
    });
  }

  async getSubject(subjectId: string) {
    return this.prisma.subject.findUnique({ where: { id: subjectId } });
  }

  async getSection(sectionId: string) {
    return this.prisma.section.findUnique({ where: { id: sectionId } });
  }
}
