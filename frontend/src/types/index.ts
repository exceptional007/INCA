export type RoleCode = 'SUPER_ADMIN' | 'ADMIN' | 'HOD' | 'FACULTY' | 'COORDINATOR' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  roleId: string;
  role: {
    id: string;
    code: RoleCode;
    name: string;
  };
  isActive: boolean;
  mustChangePassword?: boolean;
  faculty?: Faculty;
  student?: Student;
}

export interface Faculty {
  id: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName?: string;
  gender: string;
  designation: string;
  phone?: string;
  photoKey?: string;
  user?: User;
}

export interface Student {
  id: string;
  userId: string;
  collegeId: string;
  rollNumber: string;
  enrollmentNumber: string;
  firstName: string;
  lastName?: string;
  gender: string;
  phone?: string;
  photoKey?: string;
  user?: User;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  description?: string;
  isActive: boolean;
}

export interface Program {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  shortName?: string;
  durationYears: number;
  isActive: boolean;
  department?: Department;
}

export interface Section {
  id: string;
  batchId: string;
  semesterId: string;
  name: string;
  isActive: boolean;
}

export interface Subject {
  id: string;
  programId: string;
  semesterId: string;
  code: string;
  name: string;
  credits: number;
  isLab: boolean;
  isActive: boolean;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  building?: string;
  floor?: number;
  capacity?: number;
  isLab: boolean;
  isActive: boolean;
}

export interface ScheduleTemplate {
  id: string;
  sectionId: string;
  subjectId: string;
  facultyId: string;
  roomId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo?: string;
  section?: Section;
  subject?: Subject;
  faculty?: Faculty;
  room?: Room;
}

export type ScheduleStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export interface Schedule {
  id: string;
  templateId: string;
  lectureDate: string;
  status: ScheduleStatus;
  remarks?: string;
  template?: ScheduleTemplate;
  exceptions?: ScheduleException[];
}

export interface ScheduleException {
  id: string;
  scheduleId: string;
  exceptionType: string;
  reason?: string;
  newFacultyId?: string;
  newRoomId?: string;
  newStartTime?: string;
  newEndTime?: string;
  newFaculty?: Faculty;
  newRoom?: Room;
}

export interface ActivityType {
  id: string;
  name: string;
  description?: string;
  _count?: { activities: number };
}

export interface Activity {
  id: string;
  activityTypeId: string;
  title: string;
  description?: string;
  facultyId: string;
  roomId?: string;
  startTime: string;
  endTime: string;
  attendanceRequired: boolean;
  activityType?: ActivityType;
  faculty?: Faculty;
  room?: Room;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceSession {
  id: string;
  scheduleId?: string;
  activityId?: string;
  takenById: string;
  attendanceDate: string;
  status: 'OPEN' | 'SUBMITTED';
  submittedAt?: string;
  schedule?: Schedule;
  activity?: Activity;
  takenBy?: Faculty;
  records?: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: string;
  attendanceSessionId: string;
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
  student?: Student;
  audits?: AttendanceAudit[];
}

export interface AttendanceAudit {
  id: string;
  attendanceRecordId: string;
  oldStatus: string;
  newStatus: string;
  editedById: string;
  editedAt: string;
  reason?: string;
  editedBy?: User;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
