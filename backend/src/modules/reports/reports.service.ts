import { Injectable, NotFoundException } from '@nestjs/common';
import { ReportsRepository } from './reports.repository';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { AttendanceStatus } from '@prisma/client';

const PRESENT_STATUSES: AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
];

function calcPercentage(present: number, total: number): number {
  if (total === 0) return 0;
  return parseFloat(((present / total) * 100).toFixed(2));
}

@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  // ── Helpers ───────────────────────────────────────────────────────────────
  private parseDates(startDate?: string, endDate?: string) {
    return {
      start: startDate ? new Date(startDate) : undefined,
      end: endDate ? new Date(endDate) : undefined,
    };
  }

  // ── 1. Student Attendance Report ─────────────────────────────────────────
  async getStudentReport(
    studentId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<any>> {
    const student = await this.reportsRepository.getStudent(studentId);
    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found.`);
    }

    const { start, end } = this.parseDates(startDate, endDate);
    const records = await this.reportsRepository.getStudentRecords(
      studentId,
      start,
      end,
    );

    // Group by subject (from schedule template) or activityType (for activity sessions)
    const subjectMap: Record<
      string,
      { subjectName: string; total: number; present: number }
    > = {};

    for (const record of records) {
      const session = record.attendanceSession;
      let key: string;
      let label: string;

      if (session.schedule?.template?.subject) {
        key = session.schedule.template.subject.id;
        label = `${session.schedule.template.subject.name} (${session.schedule.template.subject.code})`;
      } else if (session.activity?.activityType) {
        key = `activity_${session.activity.activityType.id}`;
        label = `Activity: ${session.activity.activityType.name}`;
      } else {
        key = 'unknown';
        label = 'Unknown';
      }

      if (!subjectMap[key]) {
        subjectMap[key] = { subjectName: label, total: 0, present: 0 };
      }

      subjectMap[key].total += 1;
      if (PRESENT_STATUSES.includes(record.status)) {
        subjectMap[key].present += 1;
      }
    }

    const subjectBreakdown = Object.entries(subjectMap).map(
      ([, val]) => ({
        subject: val.subjectName,
        totalClasses: val.total,
        attended: val.present,
        percentage: calcPercentage(val.present, val.total),
      }),
    );

    const totalClasses = records.length;
    const totalAttended = records.filter((r) =>
      PRESENT_STATUSES.includes(r.status),
    ).length;

    return {
      success: true,
      message: 'Student attendance report generated successfully.',
      data: {
        student: {
          id: student.id,
          name: `${student.firstName} ${student.lastName ?? ''}`.trim(),
          collegeId: student.collegeId,
          rollNumber: student.rollNumber,
        },
        overall: {
          totalClasses,
          attended: totalAttended,
          percentage: calcPercentage(totalAttended, totalClasses),
        },
        bySubject: subjectBreakdown,
        dateRange: { startDate: start ?? null, endDate: end ?? null },
      },
    };
  }

  // ── 2. Section Attendance Report ─────────────────────────────────────────
  async getSectionReport(
    sectionId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<any>> {
    const section = await this.reportsRepository.getSection(sectionId);
    if (!section) {
      throw new NotFoundException(`Section with ID ${sectionId} not found.`);
    }

    const { start, end } = this.parseDates(startDate, endDate);
    const sessions = await this.reportsRepository.getSectionSessions(
      sectionId,
      start,
      end,
    );

    // Build a map: studentId → { studentInfo, subjectId → { total, present } }
    const studentMap: Record<
      string,
      {
        studentInfo: any;
        subjects: Record<string, { name: string; total: number; present: number }>;
      }
    > = {};

    for (const session of sessions) {
      const subjectId = session.schedule?.template?.subject?.id ?? 'unknown';
      const subjectName =
        session.schedule?.template?.subject?.name ?? 'Unknown';

      for (const record of session.records) {
        const sid = record.studentId;

        if (!studentMap[sid]) {
          studentMap[sid] = {
            studentInfo: record.student,
            subjects: {},
          };
        }

        if (!studentMap[sid].subjects[subjectId]) {
          studentMap[sid].subjects[subjectId] = {
            name: subjectName,
            total: 0,
            present: 0,
          };
        }

        studentMap[sid].subjects[subjectId].total += 1;
        if (PRESENT_STATUSES.includes(record.status)) {
          studentMap[sid].subjects[subjectId].present += 1;
        }
      }
    }

    const studentReports = Object.entries(studentMap).map(([, v]) => {
      let grandTotal = 0;
      let grandPresent = 0;

      const bySubject = Object.entries(v.subjects).map(([, sub]) => {
        grandTotal += sub.total;
        grandPresent += sub.present;
        return {
          subject: sub.name,
          totalClasses: sub.total,
          attended: sub.present,
          percentage: calcPercentage(sub.present, sub.total),
        };
      });

      return {
        student: {
          id: v.studentInfo.id,
          name: `${v.studentInfo.firstName} ${v.studentInfo.lastName ?? ''}`.trim(),
          rollNumber: v.studentInfo.rollNumber,
          collegeId: v.studentInfo.collegeId,
        },
        overall: {
          totalClasses: grandTotal,
          attended: grandPresent,
          percentage: calcPercentage(grandPresent, grandTotal),
        },
        bySubject,
      };
    });

    return {
      success: true,
      message: 'Section attendance report generated successfully.',
      data: {
        section: { id: section.id, name: section.name },
        totalSessions: sessions.length,
        students: studentReports,
        dateRange: { startDate: start ?? null, endDate: end ?? null },
      },
    };
  }

  // ── 3. Subject Attendance Report ─────────────────────────────────────────
  async getSubjectReport(
    subjectId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<any>> {
    const subject = await this.reportsRepository.getSubject(subjectId);
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found.`);
    }

    const { start, end } = this.parseDates(startDate, endDate);
    const sessions = await this.reportsRepository.getSubjectSessions(
      subjectId,
      start,
      end,
    );

    const studentMap: Record<
      string,
      { studentInfo: any; total: number; present: number }
    > = {};

    for (const session of sessions) {
      for (const record of session.records) {
        const sid = record.studentId;
        if (!studentMap[sid]) {
          studentMap[sid] = { studentInfo: record.student, total: 0, present: 0 };
        }
        studentMap[sid].total += 1;
        if (PRESENT_STATUSES.includes(record.status)) {
          studentMap[sid].present += 1;
        }
      }
    }

    const studentReports = Object.entries(studentMap).map(([, v]) => ({
      student: {
        id: v.studentInfo.id,
        name: `${v.studentInfo.firstName} ${v.studentInfo.lastName ?? ''}`.trim(),
        rollNumber: v.studentInfo.rollNumber,
        collegeId: v.studentInfo.collegeId,
      },
      totalClasses: v.total,
      attended: v.present,
      percentage: calcPercentage(v.present, v.total),
      isShortfall: calcPercentage(v.present, v.total) < 75,
    }));

    // Sort: shortfall students first, then by percentage ascending
    studentReports.sort((a, b) => {
      if (a.isShortfall !== b.isShortfall) return a.isShortfall ? -1 : 1;
      return a.percentage - b.percentage;
    });

    return {
      success: true,
      message: 'Subject attendance report generated successfully.',
      data: {
        subject: { id: subject.id, name: subject.name, code: subject.code },
        totalSessions: sessions.length,
        shortfallCount: studentReports.filter((s) => s.isShortfall).length,
        students: studentReports,
        dateRange: { startDate: start ?? null, endDate: end ?? null },
      },
    };
  }

  // ── 4. Faculty Report ─────────────────────────────────────────────────────
  async getFacultyReport(
    facultyId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<any>> {
    const faculty = await this.reportsRepository.getFaculty(facultyId);
    if (!faculty) {
      throw new NotFoundException(`Faculty with ID ${facultyId} not found.`);
    }

    const { start, end } = this.parseDates(startDate, endDate);
    const sessions = await this.reportsRepository.getFacultySessions(
      facultyId,
      start,
      end,
    );

    // Group by subject
    const subjectMap: Record<
      string,
      { name: string; sessions: number; studentsMarked: number }
    > = {};

    for (const session of sessions) {
      let key: string;
      let label: string;

      if (session.schedule?.template?.subject) {
        key = session.schedule.template.subject.id;
        label = `${session.schedule.template.subject.name} (${session.schedule.template.subject.code})`;
      } else if (session.activity?.activityType) {
        key = `activity_${session.activity.activityType.id}`;
        label = `Activity: ${session.activity.title}`;
      } else {
        key = 'unknown';
        label = 'Unknown';
      }

      if (!subjectMap[key]) {
        subjectMap[key] = { name: label, sessions: 0, studentsMarked: 0 };
      }
      subjectMap[key].sessions += 1;
      subjectMap[key].studentsMarked += session.records.length;
    }

    const bySubject = Object.entries(subjectMap).map(([, v]) => ({
      subject: v.name,
      sessionsConducted: v.sessions,
      totalStudentsMarked: v.studentsMarked,
    }));

    return {
      success: true,
      message: 'Faculty attendance report generated successfully.',
      data: {
        faculty: {
          id: faculty.id,
          name: `${faculty.firstName} ${faculty.lastName ?? ''}`.trim(),
          employeeCode: faculty.employeeCode,
          designation: faculty.designation,
        },
        totalSessionsConducted: sessions.length,
        bySubject,
        dateRange: { startDate: start ?? null, endDate: end ?? null },
      },
    };
  }
}
