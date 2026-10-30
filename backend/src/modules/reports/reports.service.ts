import { Injectable, NotFoundException } from '@nestjs/common';
import { ReportsRepository } from './reports.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { AttendanceStatus } from '@prisma/client';

const PRESENT_STATUSES: AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.EXCUSED,
];

function calcPercentage(present: number, total: number): number {
  if (total === 0) return 0;
  return parseFloat(((present / total) * 100).toFixed(2));
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────
  private parseDates(startDate?: string, endDate?: string) {
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  // ── CSV Formula Injection Sanitizer ───────────────────────────────────────
  private sanitizeCsv(val: any): string {
    if (val === null || val === undefined) return '""';
    let str = String(val).trim();
    // Neutralize spreadsheet formula injection (=, +, -, @, \t, \r)
    if (/^[=+@\-\t\r]/.test(str)) {
      str = `'${str}`;
    }
    // Escape quotes
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }

  // ── 0. Filter Options Discovery ──────────────────────────────────────────
  async getFilterOptions(
    departmentId?: string,
    programId?: string,
    semesterId?: string,
  ): Promise<ApiResponse<any>> {
    const options = await this.reportsRepository.getFilterOptions(
      departmentId,
      programId,
      semesterId,
    );
    return {
      success: true,
      message: 'Filter options discovered successfully.',
      data: options,
    };
  }

  // ── 0. Institutional Overview & Analytics ─────────────────────────────────
  async getInstitutionalOverview(
    departmentId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<any>> {
    const { start, end } = this.parseDates(startDate, endDate);
    const data = await this.reportsRepository.getInstitutionalOverviewData(
      departmentId,
      start,
      end,
    );

    let totalRecords = 0;
    let presentRecords = 0;

    const dateMap = new Map<
      string,
      { date: string; present: number; absent: number; total: number; rate: number }
    >();

    const deptMap = new Map<
      string,
      {
        id: string;
        name: string;
        code: string;
        totalRecords: number;
        presentRecords: number;
        sessionsCount: number;
      }
    >();

    for (const session of data.submittedSessions) {
      const dStr = session.attendanceDate
        ? session.attendanceDate.toISOString().split('T')[0]
        : '';
      if (dStr && !dateMap.has(dStr)) {
        dateMap.set(dStr, { date: dStr, present: 0, absent: 0, total: 0, rate: 0 });
      }
      const dateItem = dStr ? dateMap.get(dStr)! : null;

      const dept =
        session.schedule?.template?.section?.semester?.program?.department;
      const deptId = dept?.id || 'general';
      const deptName = dept?.name || dept?.shortName || 'Institutional Common';
      const deptCode = dept?.code || 'INST';

      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          id: deptId,
          name: deptName,
          code: deptCode,
          totalRecords: 0,
          presentRecords: 0,
          sessionsCount: 0,
        });
      }
      const deptItem = deptMap.get(deptId)!;
      deptItem.sessionsCount++;

      for (const rec of session.records) {
        totalRecords++;
        deptItem.totalRecords++;
        if (dateItem) dateItem.total++;

        const isPresent = PRESENT_STATUSES.includes(rec.status as any);
        if (isPresent) {
          presentRecords++;
          deptItem.presentRecords++;
          if (dateItem) dateItem.present++;
        } else {
          if (dateItem) dateItem.absent++;
        }
      }
    }

    for (const item of dateMap.values()) {
      item.rate = calcPercentage(item.present, item.total);
    }
    const attendanceTrends = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const departmentSummaries = Array.from(deptMap.values()).map((d) => ({
      departmentId: d.id,
      departmentName: d.name,
      departmentCode: d.code,
      sessionsCount: d.sessionsCount,
      totalRecords: d.totalRecords,
      presentRecords: d.presentRecords,
      attendanceRate: calcPercentage(d.presentRecords, d.totalRecords),
    }));

    // Find student shortfall across institution/department
    const students = await this.prisma.student.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        rollNumber: true,
        firstName: true,
        lastName: true,
        department: { select: { id: true, name: true, shortName: true } },
        section: { select: { id: true, name: true } },
        attendanceRecords: {
          where: {
            attendanceSession: {
              status: 'SUBMITTED',
              ...(start || end
                ? {
                    attendanceDate: {
                      ...(start ? { gte: start } : {}),
                      ...(end ? { lte: end } : {}),
                    },
                  }
                : {}),
            },
          },
          select: { status: true },
        },
      },
    });

    let above75 = 0;
    let between65and75 = 0;
    let below65 = 0;
    const shortfallList: any[] = [];

    for (const st of students) {
      const total = st.attendanceRecords.length;
      if (total === 0) continue;
      const present = st.attendanceRecords.filter((r) =>
        PRESENT_STATUSES.includes(r.status as any),
      ).length;
      const pct = calcPercentage(present, total);

      if (pct >= 75) {
        above75++;
      } else if (pct >= 65) {
        between65and75++;
        shortfallList.push({
          id: st.id,
          name: `${st.firstName} ${st.lastName ?? ''}`.trim(),
          rollNumber: st.rollNumber,
          departmentName:
            st.department?.name || st.department?.shortName || 'General',
          sectionName: st.section?.name || 'Unassigned',
          totalClasses: total,
          attended: present,
          missed: total - present,
          percentage: pct,
          severity: 'moderate',
        });
      } else {
        below65++;
        shortfallList.push({
          id: st.id,
          name: `${st.firstName} ${st.lastName ?? ''}`.trim(),
          rollNumber: st.rollNumber,
          departmentName:
            st.department?.name || st.department?.shortName || 'General',
          sectionName: st.section?.name || 'Unassigned',
          totalClasses: total,
          attended: present,
          missed: total - present,
          percentage: pct,
          severity: 'critical',
        });
      }
    }

    shortfallList.sort((a, b) => a.percentage - b.percentage);

    const overallAttendanceRate = calcPercentage(presentRecords, totalRecords);

    return {
      success: true,
      message: 'Institutional overview metrics generated successfully.',
      data: {
        metrics: {
          ...data.counts,
          totalEvaluatedRecords: totalRecords,
          presentRecords,
          absentRecords: totalRecords - presentRecords,
          overallAttendanceRate,
          shortfallCount: shortfallList.length,
          evaluatedStudentsCount: above75 + between65and75 + below65,
        },
        distribution: {
          above75,
          between65and75,
          below65,
        },
        attendanceTrends,
        departmentSummaries,
        topShortfallStudents: shortfallList.slice(0, 50),
        dateRange: { startDate: start ?? null, endDate: end ?? null },
      },
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

    // Group by subject (from schedule template) or activityType
    const subjectMap: Record<
      string,
      {
        subjectId?: string;
        subjectCode?: string;
        subjectName: string;
        total: number;
        present: number;
      }
    > = {};

    const attendanceHistory: any[] = [];

    for (const record of records) {
      const session = record.attendanceSession;
      let key: string;
      let label: string;
      let code = '';
      let subId: string | undefined;

      if (session.schedule?.template?.subject) {
        subId = session.schedule.template.subject.id;
        code = session.schedule.template.subject.code;
        key = subId || 'unknown';
        label = session.schedule.template.subject.name;
      } else if (session.activity?.activityType) {
        key = `activity_${session.activity.activityType.id}`;
        label = `Activity: ${session.activity.activityType.name}`;
      } else {
        key = 'unknown';
        label = 'General Session';
      }

      if (!subjectMap[key]) {
        subjectMap[key] = {
          subjectId: subId,
          subjectCode: code,
          subjectName: label,
          total: 0,
          present: 0,
        };
      }

      subjectMap[key].total += 1;
      const isPresent = PRESENT_STATUSES.includes(record.status);
      if (isPresent) {
        subjectMap[key].present += 1;
      }

      attendanceHistory.push({
        id: record.id,
        date: session.attendanceDate
          ? session.attendanceDate.toISOString().split('T')[0]
          : '—',
        subjectName: label,
        subjectCode: code,
        subjectId: subId,
        facultyName: session.takenBy
          ? `${session.takenBy.firstName} ${session.takenBy.lastName ?? ''}`.trim()
          : 'Faculty',
        status: record.status,
        remarks: record.remarks || '',
      });
    }

    // Sort history descending by date
    attendanceHistory.sort((a, b) => b.date.localeCompare(a.date));

    const subjectBreakdown = Object.entries(subjectMap).map(([, val]) => {
      const pct = calcPercentage(val.present, val.total);
      return {
        subjectId: val.subjectId,
        subjectCode: val.subjectCode,
        subject: val.subjectName,
        totalClasses: val.total,
        attended: val.present,
        missed: val.total - val.present,
        percentage: pct,
        isShortfall: pct < 75,
      };
    });

    const totalClasses = records.length;
    const totalAttended = records.filter((r) =>
      PRESENT_STATUSES.includes(r.status),
    ).length;
    const overallPct = calcPercentage(totalAttended, totalClasses);

    const program = student.section?.semester?.program;
    const department = program?.department;

    return {
      success: true,
      message: 'Student attendance report generated successfully.',
      data: {
        student: {
          id: student.id,
          name: `${student.firstName} ${student.lastName ?? ''}`.trim(),
          collegeId: student.collegeId,
          rollNumber: student.rollNumber,
          email: student.user?.email,
          sectionId: student.sectionId,
          sectionName: student.section?.name,
          semesterNumber: student.section?.semester?.number,
          programName: program?.name,
          programShortName: program?.shortName,
          departmentName: department?.name || department?.shortName,
        },
        overall: {
          totalClasses,
          attended: totalAttended,
          missed: totalClasses - totalAttended,
          percentage: overallPct,
          isShortfall: overallPct < 75,
          eligibilityStatus: overallPct >= 75 ? 'ELIGIBLE' : 'SHORTFALL',
        },
        bySubject: subjectBreakdown,
        attendanceHistory: attendanceHistory.slice(0, 100),
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

    // Subject breakdown at section level
    const subjectStatsMap: Record<
      string,
      { id: string; name: string; code: string; totalSessions: number; attendedRecords: number; totalRecords: number }
    > = {};

    // Student breakdown
    const studentMap: Record<
      string,
      {
        studentInfo: any;
        subjects: Record<string, { name: string; code: string; total: number; present: number }>;
      }
    > = {};

    for (const session of sessions) {
      const subject = session.schedule?.template?.subject;
      const subId = subject?.id || 'unknown';
      const subName = subject?.name || 'General';
      const subCode = subject?.code || 'GEN';

      if (!subjectStatsMap[subId]) {
        subjectStatsMap[subId] = {
          id: subId,
          name: subName,
          code: subCode,
          totalSessions: 0,
          attendedRecords: 0,
          totalRecords: 0,
        };
      }
      subjectStatsMap[subId].totalSessions++;

      for (const record of session.records) {
        const sid = record.studentId;
        const isPres = PRESENT_STATUSES.includes(record.status);

        subjectStatsMap[subId].totalRecords++;
        if (isPres) subjectStatsMap[subId].attendedRecords++;

        if (!studentMap[sid]) {
          studentMap[sid] = {
            studentInfo: record.student,
            subjects: {},
          };
        }

        if (!studentMap[sid].subjects[subId]) {
          studentMap[sid].subjects[subId] = {
            name: subName,
            code: subCode,
            total: 0,
            present: 0,
          };
        }

        studentMap[sid].subjects[subId].total += 1;
        if (isPres) {
          studentMap[sid].subjects[subId].present += 1;
        }
      }
    }

    const studentReports = Object.entries(studentMap).map(([, v]) => {
      let grandTotal = 0;
      let grandPresent = 0;

      const bySubject = Object.entries(v.subjects).map(([, sub]) => {
        grandTotal += sub.total;
        grandPresent += sub.present;
        const pct = calcPercentage(sub.present, sub.total);
        return {
          subject: sub.name,
          code: sub.code,
          totalClasses: sub.total,
          attended: sub.present,
          missed: sub.total - sub.present,
          percentage: pct,
          isShortfall: pct < 75,
        };
      });

      const overallPct = calcPercentage(grandPresent, grandTotal);

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
          missed: grandTotal - grandPresent,
          percentage: overallPct,
        },
        isShortfall: overallPct < 75,
        bySubject,
      };
    });

    // Sort shortfall students first, then by rollNumber
    studentReports.sort((a, b) => {
      if (a.isShortfall !== b.isShortfall) return a.isShortfall ? -1 : 1;
      return a.overall.percentage - b.overall.percentage;
    });

    const bySubjectList = Object.values(subjectStatsMap).map((s) => ({
      subjectId: s.id,
      name: s.name,
      code: s.code,
      totalSessions: s.totalSessions,
      attendanceRate: calcPercentage(s.attendedRecords, s.totalRecords),
    }));

    let grandAttended = 0;
    let grandClasses = 0;
    for (const sr of studentReports) {
      grandAttended += sr.overall.attended;
      grandClasses += sr.overall.totalClasses;
    }

    const program = section.semester?.program;
    const department = program?.department;

    return {
      success: true,
      message: 'Section attendance report generated successfully.',
      data: {
        section: {
          id: section.id,
          name: section.name,
          semesterNumber: section.semester?.number,
          programName: program?.name,
          programShortName: program?.shortName,
          departmentName: department?.name || department?.shortName,
          totalRegisteredStudents: section.students?.length || studentReports.length,
        },
        totalSessions: sessions.length,
        evaluatedStudentsCount: studentReports.length,
        overallAttendancePct: calcPercentage(grandAttended, grandClasses),
        shortfallCount: studentReports.filter((s) => s.isShortfall).length,
        bySubject: bySubjectList,
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
      { studentInfo: any; sectionName?: string; total: number; present: number }
    > = {};

    const sectionMap: Record<
      string,
      { id: string; name: string; sessions: number; present: number; total: number }
    > = {};

    let totalAttendanceRecords = 0;
    let presentAttendanceRecords = 0;

    for (const session of sessions) {
      const sec = session.schedule?.template?.section;
      const secId = sec?.id || 'unassigned';
      const secName = sec?.name || 'Unassigned';

      if (!sectionMap[secId]) {
        sectionMap[secId] = { id: secId, name: secName, sessions: 0, present: 0, total: 0 };
      }
      sectionMap[secId].sessions++;

      for (const record of session.records) {
        totalAttendanceRecords++;
        sectionMap[secId].total++;

        const sid = record.studentId;
        const isPres = PRESENT_STATUSES.includes(record.status);
        if (isPres) {
          presentAttendanceRecords++;
          sectionMap[secId].present++;
        }

        if (!studentMap[sid]) {
          studentMap[sid] = {
            studentInfo: record.student,
            sectionName: (record.student as any)?.section?.name || secName,
            total: 0,
            present: 0,
          };
        }
        studentMap[sid].total += 1;
        if (isPres) {
          studentMap[sid].present += 1;
        }
      }
    }

    let above75 = 0;
    let between65and75 = 0;
    let below65 = 0;

    const studentReports = Object.entries(studentMap).map(([, v]) => {
      const pct = calcPercentage(v.present, v.total);
      const isShortfall = pct < 75;

      if (pct >= 75) above75++;
      else if (pct >= 65) between65and75++;
      else below65++;

      return {
        student: {
          id: v.studentInfo.id,
          name: `${v.studentInfo.firstName} ${v.studentInfo.lastName ?? ''}`.trim(),
          rollNumber: v.studentInfo.rollNumber,
          collegeId: v.studentInfo.collegeId,
          sectionName: v.sectionName,
        },
        totalClasses: v.total,
        attended: v.present,
        missed: v.total - v.present,
        percentage: pct,
        isShortfall,
      };
    });

    studentReports.sort((a, b) => {
      if (a.isShortfall !== b.isShortfall) return a.isShortfall ? -1 : 1;
      return a.percentage - b.percentage;
    });

    const bySection = Object.values(sectionMap).map((s) => ({
      sectionId: s.id,
      sectionName: s.name,
      sessionsCount: s.sessions,
      attendanceRate: calcPercentage(s.present, s.total),
    }));

    const program = subject.semester?.program;
    const department = program?.department;

    return {
      success: true,
      message: 'Subject attendance report generated successfully.',
      data: {
        subject: {
          id: subject.id,
          name: subject.name,
          code: subject.code,
          type: subject.isLab ? 'LAB' : 'THEORY',
          isLab: subject.isLab,
          semesterNumber: subject.semester?.number,
          programName: program?.name,
          departmentName: department?.name || department?.shortName,
        },
        totalSessions: sessions.length,
        enrolledStudentsCount: studentReports.length,
        averageAttendancePct: calcPercentage(presentAttendanceRecords, totalAttendanceRecords),
        shortfallCount: studentReports.filter((s) => s.isShortfall).length,
        distribution: {
          above75,
          between65and75,
          below65,
        },
        bySection,
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

    // Group by subject and section
    const subjectMap: Record<
      string,
      {
        subjectId?: string;
        name: string;
        code: string;
        sectionName: string;
        sessions: number;
        studentsMarked: number;
        studentsPresent: number;
      }
    > = {};

    let totalStudentsMarked = 0;
    let totalStudentsPresent = 0;

    const recentSessions: any[] = [];

    for (const session of sessions) {
      let key: string;
      let label: string;
      let code = '';
      let subId: string | undefined;
      const secName = session.schedule?.template?.section?.name || 'Section';

      if (session.schedule?.template?.subject) {
        subId = session.schedule.template.subject.id;
        code = session.schedule.template.subject.code;
        key = `${subId}_${secName}`;
        label = session.schedule.template.subject.name;
      } else if (session.activity?.activityType) {
        key = `activity_${session.activity.activityType.id}`;
        label = `Activity: ${session.activity.title || session.activity.activityType.name}`;
      } else {
        key = 'unknown';
        label = 'Class Session';
      }

      if (!subjectMap[key]) {
        subjectMap[key] = {
          subjectId: subId,
          name: label,
          code,
          sectionName: secName,
          sessions: 0,
          studentsMarked: 0,
          studentsPresent: 0,
        };
      }
      subjectMap[key].sessions += 1;
      const marked = session.records.length;
      const present = session.records.filter((r) =>
        PRESENT_STATUSES.includes(r.status as any),
      ).length;

      subjectMap[key].studentsMarked += marked;
      subjectMap[key].studentsPresent += present;
      totalStudentsMarked += marked;
      totalStudentsPresent += present;

      recentSessions.push({
        id: session.id,
        date: session.attendanceDate
          ? session.attendanceDate.toISOString().split('T')[0]
          : '—',
        subjectName: label,
        subjectCode: code,
        subjectId: subId,
        sectionName: secName,
        studentsMarked: marked,
        studentsPresent: present,
        attendanceRate: calcPercentage(present, marked),
      });
    }

    recentSessions.sort((a, b) => b.date.localeCompare(a.date));

    const bySubject = Object.entries(subjectMap).map(([, v]) => ({
      subjectId: v.subjectId,
      subject: v.name,
      code: v.code,
      sectionName: v.sectionName,
      sessionsConducted: v.sessions,
      totalStudentsMarked: v.studentsMarked,
      attendanceRate: calcPercentage(v.studentsPresent, v.studentsMarked),
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
          email: faculty.user?.email,
          departmentName: faculty.department?.name || faculty.department?.shortName || 'General',
        },
        totalSessionsConducted: sessions.length,
        totalStudentsMarked,
        averageClassAttendancePct: calcPercentage(totalStudentsPresent, totalStudentsMarked),
        bySubject,
        recentSessions: recentSessions.slice(0, 30),
        dateRange: { startDate: start ?? null, endDate: end ?? null },
      },
    };
  }

  // ── CSV Export ───────────────────────────────────────────────────────────
  async exportReportCsv(
    reportType: string,
    targetId?: string,
    departmentId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ filename: string; csv: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const headerPrefix = [
      `"INCA ACADEMIC ATTENDANCE & ANALYTICS REPORT"`,
      `"Generated At","${new Date().toISOString()}"`,
      `"Report Type","${reportType.toUpperCase()}"`,
      `"Date Range","${startDate || 'All-Time'} to ${endDate || 'Current'}"`,
      '',
    ].join('\r\n');

    if (reportType === 'overview') {
      const res = await this.getInstitutionalOverview(departmentId, startDate, endDate);
      const metrics = res.data.metrics;
      const depts = res.data.departmentSummaries;
      const shortfalls = res.data.topShortfallStudents;

      const lines: string[] = [
        headerPrefix,
        `"--- INSTITUTIONAL SUMMARY METRICS ---"`,
        `"Metric","Value"`,
        `"Total Registered Students",${this.sanitizeCsv(metrics.totalStudents)}`,
        `"Active Students",${this.sanitizeCsv(metrics.activeStudents)}`,
        `"Total Faculty",${this.sanitizeCsv(metrics.totalFaculty)}`,
        `"Active Faculty",${this.sanitizeCsv(metrics.activeFaculty)}`,
        `"Total Academic Departments",${this.sanitizeCsv(metrics.totalDepartments)}`,
        `"Total Sections",${this.sanitizeCsv(metrics.totalSections)}`,
        `"Total Subjects",${this.sanitizeCsv(metrics.totalSubjects)}`,
        `"Scheduled Classes",${this.sanitizeCsv(metrics.scheduledClassesCount)}`,
        `"Cancelled Classes",${this.sanitizeCsv(metrics.cancelledClassesCount)}`,
        `"Conducted Attendance Sessions",${this.sanitizeCsv(metrics.conductedSessionsCount)}`,
        `"Overall Attendance Rate (%)",${this.sanitizeCsv(metrics.overallAttendanceRate)}`,
        `"Total Students with Shortfall (<75%)",${this.sanitizeCsv(metrics.shortfallCount)}`,
        `"Attendance Records Audited/Modified",${this.sanitizeCsv(metrics.attendanceAuditsCount)}`,
        '',
        `"--- DEPARTMENT-WISE ATTENDANCE PERFORMANCE ---"`,
        `"Department Name","Code","Sessions Conducted","Total Evaluated Records","Present Records","Attendance Rate (%)"`,
        ...depts.map((d: any) =>
          [
            this.sanitizeCsv(d.departmentName),
            this.sanitizeCsv(d.departmentCode),
            this.sanitizeCsv(d.sessionsCount),
            this.sanitizeCsv(d.totalRecords),
            this.sanitizeCsv(d.presentRecords),
            this.sanitizeCsv(d.attendanceRate),
          ].join(','),
        ),
        '',
        `"--- STUDENTS BELOW 75% ATTENDANCE THRESHOLD ---"`,
        `"Roll Number","Student Name","Department","Section","Attended Classes","Total Classes","Attendance (%)","Severity"`,
        ...shortfalls.map((s: any) =>
          [
            this.sanitizeCsv(s.rollNumber),
            this.sanitizeCsv(s.name),
            this.sanitizeCsv(s.departmentName),
            this.sanitizeCsv(s.sectionName),
            this.sanitizeCsv(s.attended),
            this.sanitizeCsv(s.totalClasses),
            this.sanitizeCsv(s.percentage),
            this.sanitizeCsv(s.severity),
          ].join(','),
        ),
      ];

      return {
        filename: `institutional-analytics-${timestamp}.csv`,
        csv: lines.join('\r\n'),
      };
    }

    if (reportType === 'student' && targetId) {
      const res = await this.getStudentReport(targetId, startDate, endDate);
      const st = res.data.student;
      const ov = res.data.overall;
      const subjects = res.data.bySubject;
      const history = res.data.attendanceHistory;

      const lines: string[] = [
        headerPrefix,
        `"--- STUDENT PROFILE & OVERALL ATTENDANCE ---"`,
        `"Roll Number",${this.sanitizeCsv(st.rollNumber)}`,
        `"Student Name",${this.sanitizeCsv(st.name)}`,
        `"College ID",${this.sanitizeCsv(st.collegeId)}`,
        `"Department",${this.sanitizeCsv(st.departmentName)}`,
        `"Program",${this.sanitizeCsv(st.programName)}`,
        `"Section",${this.sanitizeCsv(st.sectionName)}`,
        `"Total Eligible Classes",${this.sanitizeCsv(ov.totalClasses)}`,
        `"Classes Attended",${this.sanitizeCsv(ov.attended)}`,
        `"Classes Missed",${this.sanitizeCsv(ov.missed)}`,
        `"Overall Attendance Rate (%)",${this.sanitizeCsv(ov.percentage)}`,
        `"Eligibility Status",${this.sanitizeCsv(ov.eligibilityStatus)}`,
        '',
        `"--- SUBJECT-WISE ATTENDANCE BREAKDOWN ---"`,
        `"Subject Code","Subject Name","Attended Classes","Total Classes","Missed Classes","Percentage (%)","Shortfall Status"`,
        ...subjects.map((sub: any) =>
          [
            this.sanitizeCsv(sub.subjectCode),
            this.sanitizeCsv(sub.subject),
            this.sanitizeCsv(sub.attended),
            this.sanitizeCsv(sub.totalClasses),
            this.sanitizeCsv(sub.missed),
            this.sanitizeCsv(sub.percentage),
            this.sanitizeCsv(sub.isShortfall ? 'SHORTFALL (<75%)' : 'ELIGIBLE'),
          ].join(','),
        ),
        '',
        `"--- ATTENDANCE SESSION HISTORY ---"`,
        `"Date","Subject Code","Subject Name","Faculty / Evaluator","Status","Remarks"`,
        ...history.map((h: any) =>
          [
            this.sanitizeCsv(h.date),
            this.sanitizeCsv(h.subjectCode),
            this.sanitizeCsv(h.subjectName),
            this.sanitizeCsv(h.facultyName),
            this.sanitizeCsv(h.status),
            this.sanitizeCsv(h.remarks),
          ].join(','),
        ),
      ];

      return {
        filename: `student-report-${st.rollNumber || targetId}-${timestamp}.csv`,
        csv: lines.join('\r\n'),
      };
    }

    if (reportType === 'subject' && targetId) {
      const res = await this.getSubjectReport(targetId, startDate, endDate);
      const sub = res.data.subject;
      const lines: string[] = [
        headerPrefix,
        `"--- SUBJECT PERFORMANCE OVERVIEW ---"`,
        `"Subject Code",${this.sanitizeCsv(sub.code)}`,
        `"Subject Name",${this.sanitizeCsv(sub.name)}`,
        `"Department",${this.sanitizeCsv(sub.departmentName)}`,
        `"Semester",${this.sanitizeCsv(sub.semesterNumber)}`,
        `"Course Type",${this.sanitizeCsv(sub.type)}`,
        `"Total Sessions Conducted",${this.sanitizeCsv(res.data.totalSessions)}`,
        `"Evaluated Students",${this.sanitizeCsv(res.data.enrolledStudentsCount)}`,
        `"Average Attendance Rate (%)",${this.sanitizeCsv(res.data.averageAttendancePct)}`,
        `"Students in Shortfall (<75%)",${this.sanitizeCsv(res.data.shortfallCount)}`,
        '',
        `"--- SECTION-WISE BREAKDOWN ---"`,
        `"Section Name","Sessions Conducted","Attendance Rate (%)"`,
        ...res.data.bySection.map((sec: any) =>
          [
            this.sanitizeCsv(sec.sectionName),
            this.sanitizeCsv(sec.sessionsCount),
            this.sanitizeCsv(sec.attendanceRate),
          ].join(','),
        ),
        '',
        `"--- STUDENT ATTENDANCE ROSTER ---"`,
        `"Roll Number","Student Name","Section","Classes Attended","Total Classes","Missed","Percentage (%)","Shortfall Status"`,
        ...res.data.students.map((st: any) =>
          [
            this.sanitizeCsv(st.student?.rollNumber),
            this.sanitizeCsv(st.student?.name),
            this.sanitizeCsv(st.student?.sectionName),
            this.sanitizeCsv(st.attended),
            this.sanitizeCsv(st.totalClasses),
            this.sanitizeCsv(st.missed),
            this.sanitizeCsv(st.percentage),
            this.sanitizeCsv(st.isShortfall ? 'SHORTFALL (<75%)' : 'ELIGIBLE'),
          ].join(','),
        ),
      ];

      return {
        filename: `subject-report-${sub.code || targetId}-${timestamp}.csv`,
        csv: lines.join('\r\n'),
      };
    }

    if (reportType === 'section' && targetId) {
      const res = await this.getSectionReport(targetId, startDate, endDate);
      const sec = res.data.section;
      const lines: string[] = [
        headerPrefix,
        `"--- SECTION ACADEMIC & ATTENDANCE SUMMARY ---"`,
        `"Section Name",${this.sanitizeCsv(sec.name)}`,
        `"Department",${this.sanitizeCsv(sec.departmentName)}`,
        `"Program",${this.sanitizeCsv(sec.programName)}`,
        `"Semester",${this.sanitizeCsv(sec.semesterNumber)}`,
        `"Registered Students",${this.sanitizeCsv(sec.totalRegisteredStudents)}`,
        `"Total Sessions Conducted",${this.sanitizeCsv(res.data.totalSessions)}`,
        `"Overall Section Attendance Rate (%)",${this.sanitizeCsv(res.data.overallAttendancePct)}`,
        `"Students in Shortfall (<75%)",${this.sanitizeCsv(res.data.shortfallCount)}`,
        '',
        `"--- SUBJECT-WISE ATTENDANCE COMPARISON ---"`,
        `"Subject Code","Subject Name","Conducted Sessions","Attendance Rate (%)"`,
        ...res.data.bySubject.map((s: any) =>
          [
            this.sanitizeCsv(s.code),
            this.sanitizeCsv(s.name),
            this.sanitizeCsv(s.totalSessions),
            this.sanitizeCsv(s.attendanceRate),
          ].join(','),
        ),
        '',
        `"--- SECTION STUDENT ROSTER ---"`,
        `"Roll Number","Student Name","Classes Attended","Total Classes","Missed","Percentage (%)","Status"`,
        ...res.data.students.map((s: any) =>
          [
            this.sanitizeCsv(s.student?.rollNumber),
            this.sanitizeCsv(s.student?.name),
            this.sanitizeCsv(s.overall?.attended),
            this.sanitizeCsv(s.overall?.totalClasses),
            this.sanitizeCsv(s.overall?.missed),
            this.sanitizeCsv(s.overall?.percentage),
            this.sanitizeCsv(s.isShortfall ? 'SHORTFALL (<75%)' : 'ELIGIBLE'),
          ].join(','),
        ),
      ];

      return {
        filename: `section-report-${sec.name || targetId}-${timestamp}.csv`,
        csv: lines.join('\r\n'),
      };
    }

    if (reportType === 'faculty' && targetId) {
      const res = await this.getFacultyReport(targetId, startDate, endDate);
      const fac = res.data.faculty;
      const lines: string[] = [
        headerPrefix,
        `"--- FACULTY TEACHING & ATTENDANCE SUMMARY ---"`,
        `"Employee Code",${this.sanitizeCsv(fac.employeeCode)}`,
        `"Faculty Name",${this.sanitizeCsv(fac.name)}`,
        `"Designation",${this.sanitizeCsv(fac.designation)}`,
        `"Department",${this.sanitizeCsv(fac.departmentName)}`,
        `"Total Sessions Conducted",${this.sanitizeCsv(res.data.totalSessionsConducted)}`,
        `"Total Students Evaluated",${this.sanitizeCsv(res.data.totalStudentsMarked)}`,
        `"Average Class Attendance (%)",${this.sanitizeCsv(res.data.averageClassAttendancePct)}`,
        '',
        `"--- SUBJECT & SECTION ASSIGNMENTS ---"`,
        `"Subject Code","Subject Name","Section","Sessions Conducted","Total Students Evaluated","Attendance Rate (%)"`,
        ...res.data.bySubject.map((sub: any) =>
          [
            this.sanitizeCsv(sub.code),
            this.sanitizeCsv(sub.subject),
            this.sanitizeCsv(sub.sectionName),
            this.sanitizeCsv(sub.sessionsConducted),
            this.sanitizeCsv(sub.totalStudentsMarked),
            this.sanitizeCsv(sub.attendanceRate),
          ].join(','),
        ),
        '',
        `"--- RECENT SESSIONS CONDUCTED ---"`,
        `"Date","Subject Code","Subject Name","Section","Students Present","Students Total","Attendance Rate (%)"`,
        ...res.data.recentSessions.map((rec: any) =>
          [
            this.sanitizeCsv(rec.date),
            this.sanitizeCsv(rec.subjectCode),
            this.sanitizeCsv(rec.subjectName),
            this.sanitizeCsv(rec.sectionName),
            this.sanitizeCsv(rec.studentsPresent),
            this.sanitizeCsv(rec.studentsMarked),
            this.sanitizeCsv(rec.attendanceRate),
          ].join(','),
        ),
      ];

      return {
        filename: `faculty-report-${fac.employeeCode || targetId}-${timestamp}.csv`,
        csv: lines.join('\r\n'),
      };
    }

    throw new NotFoundException(`Invalid report type or missing target ID for ${reportType}`);
  }


  // ── 5. Admin & HOD Real Dashboard Summary ───────────────────────────────
  async getAdminDashboardSummary(
    userId?: string,
    userRole?: string,
    departmentIdQuery?: string,
  ): Promise<ApiResponse<any>> {
    let targetDeptId: string | undefined = undefined;

    if (userRole === 'ADMIN' && userId) {
      const adminProfile = await this.prisma.adminProfile.findUnique({
        where: { userId },
        select: { departmentId: true },
      });
      targetDeptId = adminProfile?.departmentId;
    } else if (userRole === 'HOD' && userId) {
      const faculty = await this.prisma.faculty.findUnique({
        where: { userId },
        select: { departmentId: true },
      });
      targetDeptId = faculty?.departmentId || undefined;
    } else if (userRole === 'SUPER_ADMIN') {
      targetDeptId = departmentIdQuery || undefined;
    }

    // Today's schedule & conducted session boundaries
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todaySchedWhere: any = {
      lectureDate: { gte: todayStart, lt: todayEnd },
    };
    if (targetDeptId) {
      todaySchedWhere.template = {
        section: { semester: { program: { departmentId: targetDeptId } } },
      };
    }

    const todaySessionsWhere: any = {
      attendanceDate: { gte: todayStart, lt: todayEnd },
    };
    if (targetDeptId) {
      todaySessionsWhere.OR = [
        { schedule: { template: { section: { semester: { program: { departmentId: targetDeptId } } } } } },
        { takenBy: { departmentId: targetDeptId } },
      ];
    }

    const sessionScope: any = {
      status: 'SUBMITTED',
    };
    if (targetDeptId) {
      sessionScope.OR = [
        { schedule: { template: { section: { semester: { program: { departmentId: targetDeptId } } } } } },
        { takenBy: { departmentId: targetDeptId } },
      ];
    }

    // Execute independent dashboard metrics in parallel using Promise.all
    const [
      dept,
      activeFacultyCount,
      activeStudentsCount,
      totalDepartmentsCount,
      todaySchedulesCountRaw,
      todaySessionsCount,
      submittedSessions,
      deptStudents,
      pendingRequestsCount,
      recentSessions,
      trendSessions,
    ] = await Promise.all([
      targetDeptId
        ? this.prisma.department.findUnique({
            where: { id: targetDeptId },
            select: { id: true, code: true, name: true, shortName: true },
          })
        : Promise.resolve(null),
      this.prisma.faculty.count({
        where: {
          isActive: true,
          ...(targetDeptId ? { departmentId: targetDeptId } : {}),
        },
      }),
      this.prisma.student.count({
        where: {
          isActive: true,
          ...(targetDeptId ? { departmentId: targetDeptId } : {}),
        },
      }),
      this.prisma.department.count({
        where: { isActive: true },
      }),
      this.prisma.schedule.count({
        where: todaySchedWhere,
      }),
      this.prisma.attendanceSession.count({
        where: todaySessionsWhere,
      }),
      this.prisma.attendanceSession.findMany({
        where: sessionScope,
        select: {
          records: {
            select: { status: true },
          },
        },
      }),
      this.prisma.student.findMany({
        where: {
          isActive: true,
          ...(targetDeptId ? { departmentId: targetDeptId } : {}),
        },
        select: {
          id: true,
          attendanceRecords: {
            where: {
              attendanceSession: { status: 'SUBMITTED' },
            },
            select: { status: true },
          },
        },
      }),
      this.prisma.request.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.attendanceSession.findMany({
        where: sessionScope,
        select: {
          id: true,
          attendanceDate: true,
          status: true,
          takenBy: {
            select: { firstName: true, lastName: true },
          },
          schedule: {
            select: {
              template: {
                select: {
                  subject: { select: { name: true, code: true } },
                  section: { select: { name: true } },
                },
              },
            },
          },
          activity: {
            select: { title: true },
          },
          records: {
            select: { status: true },
          },
        },
        orderBy: { attendanceDate: 'desc' },
        take: 5,
      }),
      this.prisma.attendanceSession.findMany({
        where: sessionScope,
        select: {
          attendanceDate: true,
          records: { select: { status: true } },
        },
        orderBy: { attendanceDate: 'asc' },
        take: 20,
      }),
    ]);

    let todaySchedulesCount = todaySchedulesCountRaw;
    if (todaySchedulesCount === 0) {
      const utcToday = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), todayStart.getUTCDate()));
      const utcTomorrow = new Date(utcToday);
      utcTomorrow.setUTCDate(utcTomorrow.getUTCDate() + 1);
      const utcSchedWhere: any = { lectureDate: { gte: utcToday, lt: utcTomorrow } };
      if (targetDeptId) {
        utcSchedWhere.template = {
          section: { semester: { program: { departmentId: targetDeptId } } },
        };
      }
      todaySchedulesCount = await this.prisma.schedule.count({ where: utcSchedWhere });
    }

    let totalAttendanceRecords = 0;
    let presentAttendanceRecords = 0;
    for (const session of submittedSessions) {
      for (const rec of session.records) {
        totalAttendanceRecords++;
        if (rec.status === 'PRESENT' || rec.status === 'LATE' || rec.status === 'EXCUSED') {
          presentAttendanceRecords++;
        }
      }
    }

    const attendanceRate = totalAttendanceRecords > 0
      ? Math.round((presentAttendanceRecords / totalAttendanceRecords) * 1000) / 10
      : 0;

    // Shortfall students in department (<75% attendance)
    let shortfallCount = 0;
    for (const st of deptStudents) {
      const total = st.attendanceRecords.length;
      if (total > 0) {
        const attended = st.attendanceRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED').length;
        const pct = (attended / total) * 100;
        if (pct < 75) shortfallCount++;
      }
    }

    // Recent 5 attendance sessions
    const formattedRecent = recentSessions.map(s => {
      const total = s.records.length;
      const present = s.records.filter(r => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED').length;
      return {
        id: s.id,
        subject: s.schedule?.template?.subject?.name || s.activity?.title || 'Class Session',
        code: s.schedule?.template?.subject?.code || 'GEN',
        faculty: `${s.takenBy?.firstName} ${s.takenBy?.lastName || ''}`.trim(),
        section: s.schedule?.template?.section?.name || 'Assigned Section',
        date: s.attendanceDate ? s.attendanceDate.toISOString().split('T')[0] : 'Recent',
        present,
        total,
        status: s.status,
      };
    });

    // Attendance Trend (group submitted records by date)
    const dateMap = new Map<string, { date: string; present: number; absent: number; total: number; rate: number }>();
    for (const s of trendSessions) {
      const dStr = s.attendanceDate ? s.attendanceDate.toISOString().split('T')[0] : '';
      if (!dStr) continue;
      if (!dateMap.has(dStr)) {
        dateMap.set(dStr, { date: dStr, present: 0, absent: 0, total: 0, rate: 0 });
      }
      const item = dateMap.get(dStr)!;
      for (const r of s.records) {
        item.total++;
        if (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED') {
          item.present++;
        } else {
          item.absent++;
        }
      }
      item.rate = item.total > 0 ? Math.round((item.present / item.total) * 1000) / 10 : 0;
    }
    const attendanceTrend = Array.from(dateMap.values()).slice(-7);

    return {
      success: true,
      message: 'Admin dashboard summary retrieved successfully.',
      data: {
        department: dept,
        activeFacultyCount,
        activeStudentsCount,
        totalDepartmentsCount,
        todaySchedulesCount,
        todaySessionsCount,
        attendanceRate,
        totalAttendanceRecords,
        shortfallCount,
        pendingRequestsCount,
        recentActivity: formattedRecent,
        attendanceTrend,
      },
    };
  }

  // ── 6. Coordinator Real Dashboard Summary ───────────────────────────────
  async getCoordinatorDashboardSummary(
    userId?: string,
    userRole?: string,
    sectionIdQuery?: string,
  ): Promise<ApiResponse<any>> {
    // 1. Get all available sections with program and department info
    const availableSections = await this.prisma.section.findMany({
      where: { isActive: true },
      include: {
        semester: {
          include: {
            program: {
              include: { department: true },
            },
          },
        },
      },
      orderBy: [
        { semester: { program: { name: 'asc' } } },
        { name: 'asc' },
      ],
    });

    if (availableSections.length === 0) {
      return {
        success: true,
        message: 'No active academic sections registered.',
        data: {
          section: null,
          availableSections: [],
          totalStudents: 0,
          sectionAttendanceRate: 0,
          shortfallStudents: [],
          todaySchedules: [],
          recentSessions: [],
        },
      };
    }

    // 2. Select target section
    const targetSection = (sectionIdQuery
      ? availableSections.find(s => s.id === sectionIdQuery)
      : availableSections[0]) || availableSections[0];

    // Today's Schedules for section
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Parallelize section students, initial schedules, and recent sessions
    const [sectionStudents, initialSchedules, recentSessions] = await Promise.all([
      // 3. Students in target section
      this.prisma.student.findMany({
        where: { sectionId: targetSection.id, isActive: true },
        include: {
          attendanceRecords: {
            where: { attendanceSession: { status: 'SUBMITTED' } },
            select: { status: true },
          },
        },
        orderBy: { rollNumber: 'asc' },
      }),
      // 4. Schedules for section
      this.prisma.schedule.findMany({
        where: {
          template: { sectionId: targetSection.id },
          lectureDate: { gte: todayStart, lt: todayEnd },
        },
        include: {
          template: {
            include: {
              subject: true,
              faculty: true,
              room: true,
            },
          },
        },
        orderBy: { template: { startTime: 'asc' } },
      }),
      // 5. Recent submitted sessions for section
      this.prisma.attendanceSession.findMany({
        where: {
          schedule: { template: { sectionId: targetSection.id } },
          status: 'SUBMITTED',
        },
        include: {
          takenBy: true,
          schedule: {
            include: {
              template: {
                include: { subject: true },
              },
            },
          },
          records: {
            select: { status: true },
          },
        },
        orderBy: { attendanceDate: 'desc' },
        take: 5,
      }),
    ]);

    // Calculate Shortfall Students
    const shortfallStudents: Array<{
      id: string;
      name: string;
      roll: string;
      attendancePct: number;
      classesAttended: number;
      classesTotal: number;
      status: 'pending' | 'warned' | 'excused';
    }> = [];

    let totalSectionRecords = 0;
    let presentSectionRecords = 0;

    for (const stud of sectionStudents) {
      const total = stud.attendanceRecords.length;
      const attended = stud.attendanceRecords.filter(
        r => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED',
      ).length;
      const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;
      totalSectionRecords += total;
      presentSectionRecords += attended;

      if (total > 0 && pct < 75) {
        shortfallStudents.push({
          id: stud.id,
          name: `${stud.firstName} ${stud.lastName || ''}`.trim(),
          roll: stud.rollNumber,
          attendancePct: pct,
          classesAttended: attended,
          classesTotal: total,
          status: pct < 65 ? 'warned' : 'pending',
        });
      }
    }

    const sectionAttendanceRate = totalSectionRecords > 0
      ? Math.round((presentSectionRecords / totalSectionRecords) * 1000) / 10
      : 0;

    let schedules = initialSchedules;

    if (schedules.length === 0) {
      // Check UTC boundary
      const utcToday = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), todayStart.getUTCDate()));
      const utcTomorrow = new Date(utcToday);
      utcTomorrow.setUTCDate(utcTomorrow.getUTCDate() + 1);
      schedules = await this.prisma.schedule.findMany({
        where: {
          template: { sectionId: targetSection.id },
          lectureDate: { gte: utcToday, lt: utcTomorrow },
        },
        include: {
          template: {
            include: {
              subject: true,
              faculty: true,
              room: true,
            },
          },
        },
        orderBy: { template: { startTime: 'asc' } },
      });
    }

    // If still 0, provide recent upcoming/active schedules for section
    if (schedules.length === 0) {
      schedules = await this.prisma.schedule.findMany({
        where: {
          template: { sectionId: targetSection.id },
        },
        include: {
          template: {
            include: {
              subject: true,
              faculty: true,
              room: true,
            },
          },
        },
        orderBy: { lectureDate: 'desc' },
        take: 5,
      });
    }

    const formattedSchedules = schedules.map(sch => {
      const template = sch.template;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayIndex = sch.lectureDate ? new Date(sch.lectureDate).getDay() : (template?.dayOfWeek || 1);
      const day = dayNames[dayIndex] || 'Monday';

      return {
        id: sch.id,
        courseName: template?.subject?.name || 'Class Session',
        code: template?.subject?.code || 'GEN',
        day,
        timeSlot: `${template?.startTime || '09:00 AM'} - ${template?.endTime || '10:00 AM'}`,
        instructor: template?.faculty ? `${template.faculty.firstName} ${template.faculty.lastName || ''}`.trim() : 'Assigned Faculty',
        room: template?.room?.code || template?.room?.name || 'Room',
        status: sch.status,
      };
    });

    // 6. Format recent submitted sessions for section
    const formattedSessions = recentSessions.map(s => {
      const total = s.records.length;
      const present = s.records.filter(r => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED').length;
      return {
        id: s.id,
        course: s.schedule?.template?.subject?.name || 'Lecture Session',
        code: s.schedule?.template?.subject?.code || 'GEN',
        date: s.attendanceDate ? s.attendanceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
        present,
        total,
        instructor: s.takenBy ? `${s.takenBy.firstName} ${s.takenBy.lastName || ''}`.trim() : 'Faculty',
      };
    });

    return {
      success: true,
      message: 'Coordinator dashboard summary retrieved successfully.',
      data: {
        section: {
          id: targetSection.id,
          name: targetSection.name,
          semester: targetSection.semester?.number,
          program: targetSection.semester?.program?.name,
          department: targetSection.semester?.program?.department?.name || targetSection.semester?.program?.department?.shortName,
          displayName: `${targetSection.semester?.program?.shortName || targetSection.semester?.program?.name || 'Program'} - Sem ${targetSection.semester?.number || 1} (${targetSection.name})`,
        },
        availableSections: availableSections.map(s => ({
          id: s.id,
          name: s.name,
          semesterNumber: s.semester?.number,
          programName: s.semester?.program?.name,
          departmentName: s.semester?.program?.department?.name,
          displayName: `${s.semester?.program?.shortName || s.semester?.program?.name || 'Program'} - Sem ${s.semester?.number || 1} (${s.name})`,
        })),
        totalStudents: sectionStudents.length,
        sectionAttendanceRate,
        shortfallStudents,
        todaySchedules: formattedSchedules,
        recentSessions: formattedSessions,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Faculty-Scoped Reports & Analytics ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  private async resolveFaculty(userId: string) {
    let faculty = await this.prisma.faculty.findUnique({
      where: { userId },
      include: { department: true },
    });
    if (!faculty) {
      faculty = await this.prisma.faculty.findFirst({
        where: { id: userId },
        include: { department: true },
      });
    }
    if (!faculty) {
      faculty = await this.prisma.faculty.findFirst({
        include: { department: true },
      });
    }
    return faculty;
  }

  async getFacultyContext(userId: string): Promise<ApiResponse<any>> {
    const faculty = await this.resolveFaculty(userId);
    if (!faculty) {
      throw new NotFoundException('Faculty profile not found.');
    }

    const templates = await this.prisma.scheduleTemplate.findMany({
      where: { facultyId: faculty.id },
      include: { subject: true, section: { include: { semester: true } } },
    });

    const slots = await this.prisma.timetableSlot.findMany({
      where: { facultyId: faculty.id },
      include: {
        subject: true,
        version: { include: { section: true } },
      },
    });

    const sessions = await this.prisma.attendanceSession.findMany({
      where: { takenById: faculty.id, status: 'SUBMITTED' },
      include: {
        schedule: {
          include: {
            template: {
              include: { subject: true, section: { include: { semester: true } } },
            },
          },
        },
      },
    });

    const subjectMap = new Map<string, {
      id: string;
      code: string;
      name: string;
      sections: string[];
      totalSessionsCount: number;
    }>();

    for (const t of templates) {
      if (t.subject) {
        if (!subjectMap.has(t.subject.id)) {
          subjectMap.set(t.subject.id, {
            id: t.subject.id,
            code: t.subject.code,
            name: t.subject.name,
            sections: [],
            totalSessionsCount: 0,
          });
        }
        if (t.section?.name && !subjectMap.get(t.subject.id)!.sections.includes(t.section.name)) {
          subjectMap.get(t.subject.id)!.sections.push(t.section.name);
        }
      }
    }

    for (const s of slots) {
      if (s.subject) {
        if (!subjectMap.has(s.subject.id)) {
          subjectMap.set(s.subject.id, {
            id: s.subject.id,
            code: s.subject.code,
            name: s.subject.name,
            sections: [],
            totalSessionsCount: 0,
          });
        }
        const secName = s.batchSection || s.version?.section?.name;
        if (secName && !subjectMap.get(s.subject.id)!.sections.includes(secName)) {
          subjectMap.get(s.subject.id)!.sections.push(secName);
        }
      }
    }

    for (const sess of sessions) {
      const sub = sess.schedule?.template?.subject;
      const sec = sess.schedule?.template?.section;
      if (sub) {
        if (!subjectMap.has(sub.id)) {
          subjectMap.set(sub.id, {
            id: sub.id,
            code: sub.code,
            name: sub.name,
            sections: [],
            totalSessionsCount: 0,
          });
        }
        const item = subjectMap.get(sub.id)!;
        item.totalSessionsCount += 1;
        if (sec?.name && !item.sections.includes(sec.name)) {
          item.sections.push(sec.name);
        }
      }
    }

    return {
      success: true,
      message: 'Faculty report context loaded successfully.',
      data: {
        faculty: {
          id: faculty.id,
          name: `${faculty.firstName} ${faculty.lastName || ''}`.trim(),
          employeeCode: faculty.employeeCode,
          designation: faculty.designation,
          departmentName: faculty.department?.name || faculty.department?.shortName || 'General',
        },
        subjects: Array.from(subjectMap.values()),
      },
    };
  }

  async getFacultyStudentAttendance(
    userId: string,
    rollNumber: string,
    subjectId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<any>> {
    if (!rollNumber || !rollNumber.trim()) {
      throw new NotFoundException('Please enter a student roll number to view attendance.');
    }

    const faculty = await this.resolveFaculty(userId);
    if (!faculty) {
      throw new NotFoundException('Faculty profile not found.');
    }

    const trimmedRoll = rollNumber.trim();
    const student = await this.prisma.student.findFirst({
      where: {
        rollNumber: { equals: trimmedRoll, mode: 'insensitive' },
      },
      include: {
        user: true,
        section: {
          include: {
            semester: {
              include: {
                program: { include: { department: true } },
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`No student found with Roll Number "${trimmedRoll}". Please verify and try again.`);
    }

    const { start, end } = this.parseDates(startDate, endDate);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId: student.id,
        attendanceSession: {
          status: 'SUBMITTED',
          takenById: faculty.id,
          ...(subjectId && subjectId !== 'ALL'
            ? {
                schedule: {
                  template: { subjectId },
                },
              }
            : {}),
          ...(start || end
            ? {
                attendanceDate: {
                  ...(start ? { gte: start } : {}),
                  ...(end ? { lte: end } : {}),
                },
              }
            : {}),
        },
      },
      include: {
        attendanceSession: {
          include: {
            takenBy: true,
            schedule: {
              include: {
                template: {
                  include: { subject: true, section: true, room: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        attendanceSession: { attendanceDate: 'desc' },
      },
    });

    const subjectStatsMap: Record<string, {
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      total: number;
      attended: number;
      missed: number;
      percentage: number;
    }> = {};

    const datewiseHistory = records.map((r) => {
      const sess = r.attendanceSession;
      const tmpl = sess.schedule?.template;
      const sub = tmpl?.subject;
      const subId = sub?.id || 'unknown';
      const subCode = sub?.code || 'SUB';
      const subName = sub?.name || 'Class Session';
      const isPresent = PRESENT_STATUSES.includes(r.status);

      if (!subjectStatsMap[subId]) {
        subjectStatsMap[subId] = {
          subjectId: subId,
          subjectCode: subCode,
          subjectName: subName,
          total: 0,
          attended: 0,
          missed: 0,
          percentage: 0,
        };
      }
      subjectStatsMap[subId].total += 1;
      if (isPresent) {
        subjectStatsMap[subId].attended += 1;
      } else {
        subjectStatsMap[subId].missed += 1;
      }

      return {
        id: r.id,
        date: sess.attendanceDate ? sess.attendanceDate.toISOString().split('T')[0] : '—',
        timeSlot: tmpl ? `${tmpl.startTime} - ${tmpl.endTime}` : 'Regular Slot',
        room: tmpl?.room?.code || tmpl?.room?.name || 'Classroom',
        subjectId: subId,
        subjectCode: subCode,
        subjectName: subName,
        sectionName: tmpl?.section?.name || student.section?.name || 'A',
        status: r.status,
        remarks: r.remarks || '',
      };
    });

    Object.values(subjectStatsMap).forEach((st) => {
      st.percentage = calcPercentage(st.attended, st.total);
    });

    const totalClasses = records.length;
    const totalAttended = records.filter((r) => PRESENT_STATUSES.includes(r.status)).length;
    const totalMissed = totalClasses - totalAttended;
    const overallPct = calcPercentage(totalAttended, totalClasses);

    const program = student.section?.semester?.program;
    const department = program?.department;

    return {
      success: true,
      message: `Found ${records.length} datewise attendance records for ${student.firstName}.`,
      data: {
        student: {
          id: student.id,
          name: `${student.firstName} ${student.lastName ?? ''}`.trim(),
          collegeId: student.collegeId,
          rollNumber: student.rollNumber,
          email: student.user?.email,
          sectionName: student.section?.name || 'Unassigned',
          semesterNumber: student.section?.semester?.number,
          programName: program?.name || program?.shortName,
          departmentName: department?.name || department?.shortName,
        },
        overall: {
          totalClasses,
          attended: totalAttended,
          missed: totalMissed,
          percentage: overallPct,
          isShortfall: overallPct < 75,
          eligibilityStatus: overallPct >= 75 ? 'ELIGIBLE' : 'SHORTFALL',
        },
        bySubject: Object.values(subjectStatsMap),
        datewiseHistory,
        dateRange: { startDate: start ?? null, endDate: end ?? null },
      },
    };
  }

  async getFacultySubjectRoster(
    userId: string,
    subjectId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<any>> {
    const faculty = await this.resolveFaculty(userId);
    if (!faculty) {
      throw new NotFoundException('Faculty profile not found.');
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) {
      throw new NotFoundException(`Subject not found.`);
    }

    const { start, end } = this.parseDates(startDate, endDate);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        status: 'SUBMITTED',
        takenById: faculty.id,
        schedule: {
          template: { subjectId },
        },
        ...(start || end
          ? {
              attendanceDate: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
      },
      include: {
        schedule: {
          include: {
            template: { include: { subject: true, section: true } },
          },
        },
        records: {
          include: {
            student: {
              include: { section: true },
            },
          },
        },
      },
      orderBy: { attendanceDate: 'desc' },
    });

    const studentAggMap = new Map<string, {
      student: {
        id: string;
        name: string;
        rollNumber: string;
        sectionName: string;
      };
      attended: number;
      totalClasses: number;
      missed: number;
      percentage: number;
      isShortfall: boolean;
    }>();

    for (const sess of sessions) {
      for (const rec of sess.records) {
        const st = rec.student;
        if (!studentAggMap.has(st.id)) {
          studentAggMap.set(st.id, {
            student: {
              id: st.id,
              name: `${st.firstName} ${st.lastName ?? ''}`.trim(),
              rollNumber: st.rollNumber,
              sectionName: st.section?.name || 'General',
            },
            attended: 0,
            totalClasses: 0,
            missed: 0,
            percentage: 0,
            isShortfall: false,
          });
        }
        const item = studentAggMap.get(st.id)!;
        item.totalClasses += 1;
        if (PRESENT_STATUSES.includes(rec.status)) {
          item.attended += 1;
        } else {
          item.missed += 1;
        }
      }
    }

    const roster = Array.from(studentAggMap.values()).map((st) => {
      const pct = calcPercentage(st.attended, st.totalClasses);
      return {
        ...st,
        percentage: pct,
        isShortfall: pct < 75,
      };
    });

    roster.sort((a, b) => a.student.rollNumber.localeCompare(b.student.rollNumber));

    const totalStudents = roster.length;
    const shortfallCount = roster.filter((r) => r.isShortfall).length;
    const avgPercentage =
      totalStudents > 0
        ? parseFloat((roster.reduce((sum, r) => sum + r.percentage, 0) / totalStudents).toFixed(2))
        : 0;

    return {
      success: true,
      message: 'Subject roster loaded successfully.',
      data: {
        subject: {
          id: subject.id,
          code: subject.code,
          name: subject.name,
        },
        totalSessions: sessions.length,
        totalStudents,
        shortfallCount,
        averageAttendancePct: avgPercentage,
        students: roster,
      },
    };
  }

  async exportFacultyStudentCsv(
    userId: string,
    rollNumber: string,
    subjectId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ filename: string; csv: string }> {
    const res = await this.getFacultyStudentAttendance(userId, rollNumber, subjectId, startDate, endDate);
    const faculty = await this.resolveFaculty(userId);
    const st = res.data.student;
    const ov = res.data.overall;
    const history = res.data.datewiseHistory;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const lines: string[] = [
      `"INCA FACULTY ATTENDANCE REPORT"`,
      `"Faculty","Prof. ${faculty?.firstName || ''} ${faculty?.lastName || ''} (${faculty?.employeeCode || 'FAC'})"`,
      `"Student Name",${this.sanitizeCsv(st.name)}`,
      `"Roll Number",${this.sanitizeCsv(st.rollNumber)}`,
      `"College ID",${this.sanitizeCsv(st.collegeId)}`,
      `"Section",${this.sanitizeCsv(st.sectionName)}`,
      `"Program / Dept",${this.sanitizeCsv(`${st.programName || ''} - ${st.departmentName || ''}`)}`,
      `"Total Classes Conducted",${this.sanitizeCsv(ov.totalClasses)}`,
      `"Classes Attended",${this.sanitizeCsv(ov.attended)}`,
      `"Classes Missed",${this.sanitizeCsv(ov.missed)}`,
      `"Attendance Rate (%)",${this.sanitizeCsv(ov.percentage)}`,
      `"Eligibility Status",${this.sanitizeCsv(ov.eligibilityStatus)}`,
      '',
      `"--- DATEWISE CLASSROOM ATTENDANCE RECORDS ---"`,
      `"Date","Time Slot","Subject Code","Subject Name","Room","Status","Remarks"`,
      ...history.map((h: any) =>
        [
          this.sanitizeCsv(h.date),
          this.sanitizeCsv(h.timeSlot),
          this.sanitizeCsv(h.subjectCode),
          this.sanitizeCsv(h.subjectName),
          this.sanitizeCsv(h.room),
          this.sanitizeCsv(h.status),
          this.sanitizeCsv(h.remarks),
        ].join(','),
      ),
    ];

    return {
      filename: `student-attendance-${st.rollNumber}-${timestamp}.csv`,
      csv: lines.join('\r\n'),
    };
  }

  async exportFacultySubjectCsv(
    userId: string,
    subjectId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ filename: string; csv: string }> {
    const res = await this.getFacultySubjectRoster(userId, subjectId, startDate, endDate);
    const faculty = await this.resolveFaculty(userId);
    const sub = res.data.subject;
    const roster = res.data.students;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const lines: string[] = [
      `"INCA FACULTY OVERALL SUBJECT ATTENDANCE ROSTER"`,
      `"Faculty","Prof. ${faculty?.firstName || ''} ${faculty?.lastName || ''} (${faculty?.employeeCode || 'FAC'})"`,
      `"Subject Code",${this.sanitizeCsv(sub.code)}`,
      `"Subject Name",${this.sanitizeCsv(sub.name)}`,
      `"Total Sessions Conducted",${this.sanitizeCsv(res.data.totalSessions)}`,
      `"Total Students Evaluated",${this.sanitizeCsv(res.data.totalStudents)}`,
      `"Average Attendance Rate (%)",${this.sanitizeCsv(res.data.averageAttendancePct)}`,
      `"Students in Shortfall (<75%)",${this.sanitizeCsv(res.data.shortfallCount)}`,
      '',
      `"--- ENROLLED STUDENTS ATTENDANCE SUMMARY ---"`,
      `"Roll Number","Student Name","Section","Classes Attended","Total Classes","Attendance (%)","Shortfall Status"`,
      ...roster.map((r: any) =>
        [
          this.sanitizeCsv(r.student.rollNumber),
          this.sanitizeCsv(r.student.name),
          this.sanitizeCsv(r.student.sectionName),
          this.sanitizeCsv(r.attended),
          this.sanitizeCsv(r.totalClasses),
          this.sanitizeCsv(r.percentage),
          this.sanitizeCsv(r.isShortfall ? 'SHORTFALL (<75%)' : 'ELIGIBLE'),
        ].join(','),
      ),
    ];

    return {
      filename: `subject-roster-${sub.code || subjectId}-${timestamp}.csv`,
      csv: lines.join('\r\n'),
    };
  }
}
