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
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
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

export interface Semester {
  id: string;
  programId: string;
  number: number;
  name?: string;
  isActive: boolean;
  program?: Program;
}

export interface Section {
  id: string;
  semesterId: string;
  name: string;
  isActive: boolean;
  semester?: Semester;
}

export interface Subject {
  id: string;
  year: number;
  semesterId: string;
  code: string;
  name: string;
  isLab: boolean;
  isActive: boolean;
  semester?: Semester;
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

export type NoteSourceType = 'FILE' | 'DRIVE';
export type NoteStatus = 'DRAFT' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'ARCHIVED';

export interface LearningNote {
  id: string;
  title: string;
  description?: string;
  sourceType: NoteSourceType;
  storageKey?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;
  driveUrl?: string;
  drivePermissionNote?: string;
  subjectId: string;
  subject: {
    id: string;
    code: string;
    name: string;
  };
  facultyId: string;
  faculty?: {
    id: string;
    firstName: string;
    lastName?: string;
    employeeCode: string;
  };
  semesterNumber?: number;
  status: NoteStatus;
  aiReady: boolean;
  processingError?: string;
  documentVersion: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  programs: Array<{
    program: {
      id: string;
      code: string;
      name: string;
      shortName?: string;
    };
  }>;
  _count?: {
    chunks?: number;
    quizzes?: number;
    conversations?: number;
  };
}

export interface GroundedSource {
  chunkId: string;
  chunkIndex: number;
  pageNumber: number | null;
  snippet: string;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: GroundedSource[];
  createdAt: string;
}

export interface TutorConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: TutorMessage[];
  _count?: {
    messages: number;
  };
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  options: string[];
}

export interface QuizAttemptReview {
  id: string;
  question: string;
  options: string[];
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  sourceSnippet?: string;
}

export interface QuizResult {
  attemptId: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  passed: boolean;
  completedAt: string;
  review: QuizAttemptReview[];
}
