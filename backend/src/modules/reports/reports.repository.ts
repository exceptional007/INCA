import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryCacheService } from '../../common/cache/memory-cache.service';

@Injectable()
export class ReportsRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: MemoryCacheService,
  ) {}

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
            takenBy: true,
            schedule: {
              include: {
                template: { include: { subject: true, section: true, faculty: true } },
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
        takenBy: true,
        schedule: {
          include: {
            template: { include: { subject: true, faculty: true } },
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
        takenBy: true,
        schedule: {
          include: {
            template: { include: { subject: true, section: true, faculty: true } },
          },
        },
        records: { include: { student: { include: { section: true } } } },
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
        records: { include: { student: true } },
      },
    });
  }

  // ── Student lookup ────────────────────────────────────────────────────────
  async getStudent(studentId: string) {
    return this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: { id: true, email: true, isActive: true },
        },
        section: {
          include: {
            semester: {
              include: {
                program: {
                  include: { department: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async getFaculty(facultyId: string) {
    return this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: {
        department: true,
        user: {
          select: { id: true, email: true, isActive: true },
        },
      },
    });
  }

  async getSubject(subjectId: string) {
    return this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        semester: {
          include: {
            program: {
              include: { department: true },
            },
          },
        },
      },
    });
  }

  async getSection(sectionId: string) {
    return this.prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        semester: {
          include: {
            program: {
              include: { department: true },
            },
          },
        },
        students: {
          where: { isActive: true },
          select: {
            id: true,
            rollNumber: true,
            firstName: true,
            lastName: true,
            collegeId: true,
            isActive: true,
          },
        },
      },
    });
  }

  // ── Filter Options Discovery ─────────────────────────────────────────────
  async getFilterOptions(departmentId?: string, programId?: string, semesterId?: string) {
    const key = `reports:filter-options:${departmentId || 'all'}:${programId || 'all'}:${semesterId || 'all'}`;

    const loader = async () => {
      const [departments, programs, semesters, sections, subjects, faculty, students] =
        await Promise.all([
          this.prisma.department.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true, shortName: true },
            orderBy: { name: 'asc' },
          }),
          this.prisma.program.findMany({
            where: {
              isActive: true,
              ...(departmentId ? { departmentId } : {}),
            },
            select: { id: true, code: true, name: true, shortName: true, departmentId: true },
            orderBy: { name: 'asc' },
          }),
          this.prisma.semester.findMany({
            where: {
              isActive: true,
              ...(programId ? { programId } : {}),
              ...(departmentId && !programId
                ? { program: { departmentId } }
                : {}),
            },
            select: { id: true, number: true, programId: true },
            orderBy: { number: 'asc' },
          }),
          this.prisma.section.findMany({
            where: {
              isActive: true,
              ...(semesterId ? { semesterId } : {}),
              ...(programId && !semesterId ? { semester: { programId } } : {}),
              ...(departmentId && !programId && !semesterId
                ? { semester: { program: { departmentId } } }
                : {}),
            },
            include: {
              semester: {
                include: {
                  program: {
                    select: { id: true, name: true, shortName: true, departmentId: true },
                  },
                },
              },
            },
            orderBy: { name: 'asc' },
          }),
          this.prisma.subject.findMany({
            where: {
              isActive: true,
              ...(semesterId ? { semesterId } : {}),
              ...(programId && !semesterId ? { semester: { programId } } : {}),
              ...(departmentId && !programId && !semesterId
                ? { semester: { program: { departmentId } } }
                : {}),
            },
            include: {
              semester: {
                include: {
                  program: {
                    select: { id: true, name: true, shortName: true, departmentId: true },
                  },
                },
              },
            },
            orderBy: { name: 'asc' },
          }),
          this.prisma.faculty.findMany({
            where: {
              isActive: true,
              ...(departmentId ? { departmentId } : {}),
            },
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              departmentId: true,
              department: { select: { id: true, name: true, shortName: true } },
            },
            orderBy: { firstName: 'asc' },
          }),
          this.prisma.student.findMany({
            where: {
              isActive: true,
              ...(departmentId ? { departmentId } : {}),
              ...(semesterId ? { section: { semesterId } } : {}),
            },
            select: {
              id: true,
              rollNumber: true,
              firstName: true,
              lastName: true,
              collegeId: true,
              sectionId: true,
              section: {
                select: {
                  id: true,
                  name: true,
                  semester: {
                    select: {
                      number: true,
                      program: { select: { name: true, shortName: true } },
                    },
                  },
                },
              },
            },
            orderBy: { rollNumber: 'asc' },
            take: 200,
          }),
        ]);

      return {
        departments,
        programs,
        semesters,
        sections: sections.map((s) => ({
          id: s.id,
          name: s.name,
          semesterId: s.semesterId,
          semesterNumber: s.semester?.number,
          programName: s.semester?.program?.name,
          programShortName: s.semester?.program?.shortName,
          departmentId: s.semester?.program?.departmentId,
          displayName: `${s.semester?.program?.shortName || s.semester?.program?.name || 'Prog'} Sem ${s.semester?.number} (${s.name})`,
        })),
        subjects: subjects.map((sub) => ({
          id: sub.id,
          code: sub.code,
          name: sub.name,
          type: sub.isLab ? 'LAB' : 'THEORY',
          isLab: sub.isLab,
          semesterId: sub.semesterId,
          semesterNumber: sub.semester?.number,
          programName: sub.semester?.program?.name,
          programShortName: sub.semester?.program?.shortName,
          departmentId: sub.semester?.program?.departmentId,
          displayName: `${sub.name} (${sub.code})`,
        })),
        faculty: faculty.map((f) => ({
          id: f.id,
          employeeCode: f.employeeCode,
          name: `${f.firstName} ${f.lastName ?? ''}`.trim(),
          designation: f.designation,
          departmentId: f.departmentId,
          departmentName: f.department?.name || f.department?.shortName || 'General',
          displayName: `${f.firstName} ${f.lastName ?? ''}`.trim() + (f.employeeCode ? ` [${f.employeeCode}]` : ''),
        })),
        students: students.map((st) => ({
          id: st.id,
          rollNumber: st.rollNumber,
          collegeId: st.collegeId,
          name: `${st.firstName} ${st.lastName ?? ''}`.trim(),
          sectionId: st.sectionId,
          sectionName: st.section?.name,
          displayName: `${st.rollNumber} - ${st.firstName} ${st.lastName ?? ''}`.trim(),
        })),
      };
    };

    return this.cache ? this.cache.getOrSet(key, 300, loader) : loader();
  }

  // ── Institutional Overview Data Aggregation ──────────────────────────────
  async getInstitutionalOverviewData(
    departmentId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const studentWhere: any = {
      ...(departmentId ? { departmentId } : {}),
    };

    const facultyWhere: any = {
      ...(departmentId ? { departmentId } : {}),
    };

    const [
      totalStudents,
      activeStudents,
      totalFaculty,
      activeFaculty,
      totalDepartments,
      totalSections,
      totalSubjects,
      attendanceAuditsCount,
    ] = await Promise.all([
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.student.count({ where: { ...studentWhere, isActive: true } }),
      this.prisma.faculty.count({ where: facultyWhere }),
      this.prisma.faculty.count({ where: { ...facultyWhere, isActive: true } }),
      this.prisma.department.count({ where: { isActive: true } }),
      this.prisma.section.count({
        where: {
          isActive: true,
          ...(departmentId ? { semester: { program: { departmentId } } } : {}),
        },
      }),
      this.prisma.subject.count({
        where: {
          isActive: true,
          ...(departmentId ? { semester: { program: { departmentId } } } : {}),
        },
      }),
      this.prisma.attendanceAudit.count(),
    ]);

    // Scheduled vs Cancelled classes in date range
    const scheduleWhere: any = {
      ...(startDate || endDate
        ? {
            lectureDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
      ...(departmentId
        ? {
            template: {
              section: { semester: { program: { departmentId } } },
            },
          }
        : {}),
    };

    const [scheduledClassesCount, cancelledClassesCount] = await Promise.all([
      this.prisma.schedule.count({
        where: { ...scheduleWhere, status: { not: 'CANCELLED' } },
      }),
      this.prisma.schedule.count({
        where: { ...scheduleWhere, status: 'CANCELLED' },
      }),
    ]);

    // Submitted sessions in date range
    const sessionWhere: any = {
      status: 'SUBMITTED',
      ...(startDate || endDate
        ? {
            attendanceDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
      ...(departmentId
        ? {
            OR: [
              {
                schedule: {
                  template: {
                    section: { semester: { program: { departmentId } } },
                  },
                },
              },
              { takenBy: { departmentId } },
            ],
          }
        : {}),
    };

    const submittedSessions = await this.prisma.attendanceSession.findMany({
      where: sessionWhere,
      include: {
        schedule: {
          include: {
            template: {
              include: {
                subject: true,
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
            },
          },
        },
        records: {
          select: {
            id: true,
            studentId: true,
            status: true,
          },
        },
      },
      orderBy: { attendanceDate: 'asc' },
    });

    return {
      counts: {
        totalStudents,
        activeStudents,
        inactiveStudents: totalStudents - activeStudents,
        totalFaculty,
        activeFaculty,
        inactiveFaculty: totalFaculty - activeFaculty,
        totalDepartments,
        totalSections,
        totalSubjects,
        scheduledClassesCount,
        cancelledClassesCount,
        conductedSessionsCount: submittedSessions.length,
        attendanceAuditsCount,
      },
      submittedSessions,
    };
  }
}

