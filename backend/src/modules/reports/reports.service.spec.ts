import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';

describe('ReportsService Unit Tests', () => {
  let service: ReportsService;
  let repoMock: any;
  let prismaMock: any;

  beforeEach(async () => {
    repoMock = {
      getFilterOptions: jest.fn(),
      getInstitutionalOverviewData: jest.fn(),
      getStudent: jest.fn(),
      getStudentRecords: jest.fn(),
      getSection: jest.fn(),
      getSectionSessions: jest.fn(),
      getSubject: jest.fn(),
      getSubjectSessions: jest.fn(),
      getFaculty: jest.fn(),
      getFacultySessions: jest.fn(),
    };

    prismaMock = {
      student: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: ReportsRepository, useValue: repoMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('getFilterOptions', () => {
    it('returns available departments, programs, semesters, sections, subjects, faculty, and students', async () => {
      const mockOptions = {
        departments: [{ id: 'dept-1', name: 'Computer Science', code: 'CSE' }],
        programs: [{ id: 'prog-1', name: 'B.Tech CSE', departmentId: 'dept-1' }],
        semesters: [{ id: 'sem-1', number: 6, programId: 'prog-1' }],
        sections: [{ id: 'sec-1', name: 'Section A', semesterId: 'sem-1' }],
        subjects: [{ id: 'sub-1', name: 'Operating Systems', code: 'CS301' }],
        faculty: [{ id: 'fac-1', name: 'Dr. Alan Turing', employeeCode: 'EMP001' }],
        students: [{ id: 'stu-1', name: 'Alice Smith', rollNumber: 'CS2026-001' }],
      };
      repoMock.getFilterOptions.mockResolvedValue(mockOptions);

      const res = await service.getFilterOptions('dept-1');
      expect(res.success).toBe(true);
      expect(res.data.departments).toHaveLength(1);
      expect(res.data.faculty[0].name).toBe('Dr. Alan Turing');
      expect(repoMock.getFilterOptions).toHaveBeenCalledWith('dept-1', undefined, undefined);
    });
  });

  describe('getInstitutionalOverview', () => {
    it('accurately aggregates institutional metrics, attendance percentage, and identifies shortfalls', async () => {
      repoMock.getInstitutionalOverviewData.mockResolvedValue({
        counts: {
          totalStudents: 100,
          activeStudents: 95,
          inactiveStudents: 5,
          totalFaculty: 20,
          activeFaculty: 18,
          inactiveFaculty: 2,
          totalDepartments: 4,
          totalSections: 10,
          totalSubjects: 30,
          scheduledClassesCount: 250,
          cancelledClassesCount: 10,
          conductedSessionsCount: 240,
          attendanceAuditsCount: 8,
        },
        submittedSessions: [
          {
            attendanceDate: new Date('2026-03-01'),
            schedule: {
              template: {
                section: {
                  semester: {
                    program: {
                      department: { id: 'dept-1', name: 'Computer Science', code: 'CSE' },
                    },
                  },
                },
              },
            },
            records: [
              { id: 'rec-1', studentId: 'stu-1', status: AttendanceStatus.PRESENT },
              { id: 'rec-2', studentId: 'stu-2', status: AttendanceStatus.ABSENT },
              { id: 'rec-3', studentId: 'stu-3', status: AttendanceStatus.LATE },
              { id: 'rec-4', studentId: 'stu-4', status: AttendanceStatus.EXCUSED },
            ],
          },
        ],
      });

      // stu-1 (100%), stu-2 (0%), stu-3 (70%)
      prismaMock.student.findMany.mockResolvedValue([
        {
          id: 'stu-1',
          rollNumber: 'CS01',
          firstName: 'Alice',
          lastName: 'Walker',
          department: { name: 'Computer Science' },
          section: { name: 'A' },
          attendanceRecords: [{ status: AttendanceStatus.PRESENT }],
        },
        {
          id: 'stu-2',
          rollNumber: 'CS02',
          firstName: 'Bob',
          lastName: 'Marley',
          department: { name: 'Computer Science' },
          section: { name: 'A' },
          attendanceRecords: [{ status: AttendanceStatus.ABSENT }],
        },
        {
          id: 'stu-3',
          rollNumber: 'CS03',
          firstName: 'Charlie',
          lastName: 'Brown',
          department: { name: 'Computer Science' },
          section: { name: 'A' },
          attendanceRecords: [
            { status: AttendanceStatus.PRESENT },
            { status: AttendanceStatus.PRESENT },
            { status: AttendanceStatus.ABSENT },
          ], // 66.67% -> moderate shortfall
        },
      ]);

      const res = await service.getInstitutionalOverview('dept-1', '2026-03-01', '2026-03-31');

      expect(res.success).toBe(true);
      // Present = 3 (PRESENT, LATE, EXCUSED), Total = 4. 3/4 = 75%
      expect(res.data.metrics.overallAttendanceRate).toBe(75);
      expect(res.data.metrics.totalEvaluatedRecords).toBe(4);
      expect(res.data.metrics.presentRecords).toBe(3);
      expect(res.data.metrics.absentRecords).toBe(1);

      // stu-2 is 0% (<65% -> critical), stu-3 is 66.67% (65-74% -> moderate), stu-1 is 100% (>=75%)
      expect(res.data.distribution.above75).toBe(1);
      expect(res.data.distribution.between65and75).toBe(1);
      expect(res.data.distribution.below65).toBe(1);
      expect(res.data.metrics.shortfallCount).toBe(2);
      expect(res.data.topShortfallStudents).toHaveLength(2);
      expect(res.data.topShortfallStudents[0].rollNumber).toBe('CS02'); // lowest attendance first
    });

    it('handles zero eligible classes / empty dataset without NaN or division by zero', async () => {
      repoMock.getInstitutionalOverviewData.mockResolvedValue({
        counts: {
          totalStudents: 0,
          activeStudents: 0,
          inactiveStudents: 0,
          totalFaculty: 0,
          activeFaculty: 0,
          inactiveFaculty: 0,
          totalDepartments: 0,
          totalSections: 0,
          totalSubjects: 0,
          scheduledClassesCount: 0,
          cancelledClassesCount: 0,
          conductedSessionsCount: 0,
          attendanceAuditsCount: 0,
        },
        submittedSessions: [],
      });
      prismaMock.student.findMany.mockResolvedValue([]);

      const res = await service.getInstitutionalOverview();
      expect(res.success).toBe(true);
      expect(res.data.metrics.overallAttendanceRate).toBe(0);
      expect(res.data.metrics.totalEvaluatedRecords).toBe(0);
      expect(res.data.distribution.above75).toBe(0);
      expect(res.data.topShortfallStudents).toEqual([]);
    });
  });

  describe('getStudentReport', () => {
    it('throws NotFoundException when student does not exist', async () => {
      repoMock.getStudent.mockResolvedValue(null);
      await expect(service.getStudentReport('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('calculates student attendance percentage correctly with 75% threshold shortfall flag', async () => {
      repoMock.getStudent.mockResolvedValue({
        id: 'stu-1',
        firstName: 'John',
        lastName: 'Doe',
        rollNumber: 'CS-001',
        collegeId: 'COL-001',
        sectionId: 'sec-1',
        section: {
          name: 'Section A',
          semester: {
            number: 4,
            program: {
              name: 'Computer Science and Engineering',
              shortName: 'CSE',
              department: { name: 'School of Engineering' },
            },
          },
        },
      });

      repoMock.getStudentRecords.mockResolvedValue([
        {
          id: 'rec-1',
          status: AttendanceStatus.PRESENT,
          remarks: 'On time',
          attendanceSession: {
            attendanceDate: new Date('2026-03-01'),
            takenBy: { firstName: 'Prof', lastName: 'X' },
            schedule: {
              template: {
                subject: { id: 'sub-1', name: 'Database Systems', code: 'CS302' },
              },
            },
          },
        },
        {
          id: 'rec-2',
          status: AttendanceStatus.ABSENT,
          remarks: 'Uninformed',
          attendanceSession: {
            attendanceDate: new Date('2026-03-02'),
            takenBy: { firstName: 'Prof', lastName: 'X' },
            schedule: {
              template: {
                subject: { id: 'sub-1', name: 'Database Systems', code: 'CS302' },
              },
            },
          },
        },
      ]);

      const res = await service.getStudentReport('stu-1');
      expect(res.success).toBe(true);
      expect(res.data.student.name).toBe('John Doe');
      expect(res.data.student.departmentName).toBe('School of Engineering');
      expect(res.data.overall.totalClasses).toBe(2);
      expect(res.data.overall.attended).toBe(1);
      expect(res.data.overall.missed).toBe(1);
      expect(res.data.overall.percentage).toBe(50);
      expect(res.data.overall.isShortfall).toBe(true);
      expect(res.data.overall.eligibilityStatus).toBe('SHORTFALL');
      expect(res.data.bySubject[0].subjectCode).toBe('CS302');
      expect(res.data.attendanceHistory).toHaveLength(2);
    });
  });

  describe('getSubjectReport', () => {
    it('calculates subject stats and categorizes student distribution correctly', async () => {
      repoMock.getSubject.mockResolvedValue({
        id: 'sub-1',
        name: 'Computer Networks',
        code: 'CS401',
        isLab: false,
        semester: {
          number: 5,
          program: { department: { name: 'Computer Science' } },
        },
      });

      repoMock.getSubjectSessions.mockResolvedValue([
        {
          id: 'sess-1',
          schedule: {
            template: {
              section: { id: 'sec-1', name: 'Section A' },
            },
          },
          records: [
            {
              studentId: 'stu-1',
              status: AttendanceStatus.PRESENT,
              student: { id: 'stu-1', firstName: 'Alice', rollNumber: 'CS01' },
            },
            {
              studentId: 'stu-2',
              status: AttendanceStatus.ABSENT,
              student: { id: 'stu-2', firstName: 'Bob', rollNumber: 'CS02' },
            },
          ],
        },
      ]);

      const res = await service.getSubjectReport('sub-1');
      expect(res.success).toBe(true);
      expect(res.data.subject.name).toBe('Computer Networks');
      expect(res.data.subject.type).toBe('THEORY');
      expect(res.data.totalSessions).toBe(1);
      expect(res.data.enrolledStudentsCount).toBe(2);
      expect(res.data.averageAttendancePct).toBe(50);
      expect(res.data.shortfallCount).toBe(1); // Bob is at 0%
      expect(res.data.bySection[0].sectionName).toBe('Section A');
    });
  });

  describe('getFacultyReport', () => {
    it('groups sessions by subject and computes average student attendance', async () => {
      repoMock.getFaculty.mockResolvedValue({
        id: 'fac-1',
        firstName: 'Alan',
        lastName: 'Turing',
        employeeCode: 'FAC-007',
        designation: 'Professor',
        department: { name: 'Computer Science' },
      });

      repoMock.getFacultySessions.mockResolvedValue([
        {
          id: 'sess-1',
          attendanceDate: new Date('2026-03-10'),
          schedule: {
            template: {
              subject: { id: 'sub-1', name: 'Theory of Computation', code: 'CS501' },
              section: { name: 'Batch 1' },
            },
          },
          records: [
            { studentId: 'stu-1', status: AttendanceStatus.PRESENT },
            { studentId: 'stu-2', status: AttendanceStatus.PRESENT },
            { studentId: 'stu-3', status: AttendanceStatus.ABSENT },
          ],
        },
      ]);

      const res = await service.getFacultyReport('fac-1');
      expect(res.success).toBe(true);
      expect(res.data.faculty.name).toBe('Alan Turing');
      expect(res.data.totalSessionsConducted).toBe(1);
      expect(res.data.totalStudentsMarked).toBe(3);
      expect(res.data.averageClassAttendancePct).toBe(66.67);
      expect(res.data.bySubject[0].subject).toBe('Theory of Computation');
    });
  });

  describe('exportReportCsv', () => {
    it('sanitizes potential formula injection characters (=, +, -, @) safely', async () => {
      repoMock.getStudent.mockResolvedValue({
        id: 'stu-malicious',
        firstName: '=cmd|',
        lastName: '+SUM(A1:A10)',
        rollNumber: '-999',
        collegeId: '@COL',
        section: { name: 'Sec A', semester: { number: 1, program: { name: 'Eng' } } },
      });

      repoMock.getStudentRecords.mockResolvedValue([]);

      const result = await service.exportReportCsv('student', 'stu-malicious');
      expect(result.csv).toBeDefined();
      expect(result.filename).toContain('student-report');
      // Values starting with =, +, -, @ must be escaped with a single quote prefix
      expect(result.csv).toContain(`"'=cmd| +SUM(A1:A10)"`);
      expect(result.csv).toContain(`"'-999"`);
      expect(result.csv).toContain(`"'@COL"`);
    });
  });
});
