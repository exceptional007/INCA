export type NoticeCategory =
  | 'ACADEMIC'
  | 'EXAMINATION'
  | 'PLACEMENT'
  | 'EVENT'
  | 'CIRCULAR'
  | 'ADMINISTRATIVE'
  | 'HOLIDAY'
  | 'URGENT'
  | 'GENERAL';

export type NoticePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type NoticeTargetScope =
  | 'ALL'
  | 'STUDENTS'
  | 'FACULTY'
  | 'DEPARTMENT'
  | 'PROGRAM'
  | 'CUSTOM';

export type NoticeStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'EXPIRED'
  | 'WITHDRAWN'
  | 'ARCHIVED';

export interface NoticeAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  streamUrl?: string;
}

export interface TargetAudienceConfig {
  roles?: string[];
  departmentIds?: string[];
  programIds?: string[];
  targetYears?: number[];
  targetSemesters?: number[];
  sectionIds?: string[];
  userIds?: string[];
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  aiSummary?: string | null;
  category: NoticeCategory | string;
  priority: NoticePriority | string;
  status: NoticeStatus | string;
  targetScope: NoticeTargetScope | string;
  department?: { id: string; name: string; code: string } | null;
  program?: { id: string; name: string; code: string } | null;
  targetYear?: number | null;
  targetSemester?: number | null;
  targetAudience?: TargetAudienceConfig | null;
  requiresAcknowledgement: boolean;
  isPinned: boolean;
  publishAt: string;
  expiresAt?: string | null;
  isArchived?: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
    designation?: string | null;
    department?: string | null;
  };
  attachments: NoticeAttachment[];
  isRead?: boolean;
  readAt?: string | null;
  isAcknowledged?: boolean;
  acknowledgedAt?: string | null;
  totalReads?: number;
  readCount?: number;
}

export interface CriticalAlert {
  id: string;
  title: string;
  priority: string;
  publishAt: string;
  expiresAt?: string | null;
  requiresAcknowledgement: boolean;
  isRead: boolean;
  isAcknowledged: boolean;
}

export interface NoticeFeedResponse {
  items: Notice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  criticalAlerts: CriticalAlert[];
}

export interface NoticeAnalytics {
  noticeId: string;
  title: string;
  status: string;
  priority: string;
  publishAt: string;
  expiresAt?: string | null;
  requiresAcknowledgement: boolean;
  totalIntendedRecipients: number;
  readCount: number;
  unreadCount: number;
  readPercentage: number;
  acknowledgementCount: number;
  acknowledgementPercentage: number;
  recentReaders: {
    userId: string;
    name: string;
    role: string;
    rollNumber?: string | null;
    department?: string | null;
    readAt: string;
    acknowledgedAt?: string | null;
  }[];
}

export interface AcademicScopeData {
  departments: { id: string; name: string; code: string; shortName?: string }[];
  programs: {
    id: string;
    name: string;
    code: string;
    departmentId: string;
    durationYears: number;
    semesters: { id: string; number: number; name: string }[];
  }[];
  academicSessions: { id: string; name: string; isActive: boolean }[];
}

