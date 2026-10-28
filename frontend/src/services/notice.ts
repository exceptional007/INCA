import api from '@/api/axios';
import type {
  Notice,
  NoticeFeedResponse,
  NoticeAnalytics,
  AcademicScopeData,
  NoticeCategory,
  NoticePriority,
  NoticeTargetScope,
  NoticeStatus,
  TargetAudienceConfig,
} from '@/types/notice';

export interface NoticeQueryParams {
  search?: string;
  category?: string;
  priority?: string;
  departmentId?: string;
  unreadOnly?: boolean;
  hasAttachment?: boolean;
  isArchived?: boolean;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CreateNoticePayload {
  title: string;
  content: string;
  aiSummary?: string;
  category?: NoticeCategory | string;
  priority?: NoticePriority | string;
  targetScope?: NoticeTargetScope | string;
  departmentId?: string;
  programId?: string;
  targetYear?: number;
  targetSemester?: number;
  targetAudience?: TargetAudienceConfig;
  requiresAcknowledgement?: boolean;
  isPinned?: boolean;
  publishAt?: string;
  expiresAt?: string;
  status?: NoticeStatus | string;
}

export const noticeApi = {
  // 1. RECIPIENT NOTICES FEED
  getRecipientNotices: async (params?: NoticeQueryParams): Promise<NoticeFeedResponse> => {
    const res = await api.get<NoticeFeedResponse>('/notices', { params });
    return res.data;
  },

  // 2. ACADEMIC SCOPES
  getAcademicScopes: async (): Promise<AcademicScopeData> => {
    const res = await api.get<AcademicScopeData>('/notices/academic-scopes');
    return res.data;
  },

  // 3. NOTICE DETAILS
  getNoticeById: async (id: string): Promise<Notice> => {
    const res = await api.get<Notice>(`/notices/${id}`);
    return res.data;
  },

  // 4. READ TRACKING
  markAsRead: async (id: string): Promise<{ success: boolean; readAt: string }> => {
    const res = await api.post<{ success: boolean; readAt: string }>(`/notices/${id}/read`);
    return res.data;
  },

  // 5. ACKNOWLEDGE
  acknowledgeNotice: async (id: string): Promise<{ success: boolean; acknowledgedAt: string }> => {
    const res = await api.post<{ success: boolean; acknowledgedAt: string }>(
      `/notices/${id}/acknowledge`,
    );
    return res.data;
  },

  // 6. MANAGEMENT: MY NOTICES
  getManagedNotices: async (
    params?: NoticeQueryParams,
  ): Promise<{ items: Notice[]; total: number; page: number; limit: number; totalPages: number }> => {
    const res = await api.get<{
      items: Notice[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/notices/management/my-notices', { params });
    return res.data;
  },

  // 7. CREATE NOTICE
  createNotice: async (payload: CreateNoticePayload): Promise<Notice> => {
    const res = await api.post<Notice>('/notices', payload);
    return res.data;
  },

  // 8. UPDATE NOTICE
  updateNotice: async (id: string, payload: Partial<CreateNoticePayload>): Promise<Notice> => {
    const res = await api.put<Notice>(`/notices/${id}`, payload);
    return res.data;
  },

  // 9. WITHDRAW NOTICE
  withdrawNotice: async (id: string, reason?: string): Promise<Notice> => {
    const res = await api.patch<Notice>(`/notices/${id}/withdraw`, { reason });
    return res.data;
  },

  // 10. ARCHIVE NOTICE
  archiveNotice: async (id: string): Promise<Notice> => {
    const res = await api.patch<Notice>(`/notices/${id}/archive`);
    return res.data;
  },

  // 11. DELETE NOTICE
  deleteNotice: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete<{ success: boolean }>(`/notices/${id}`);
    return res.data;
  },

  // 12. NOTICE ANALYTICS
  getNoticeAnalytics: async (id: string): Promise<NoticeAnalytics> => {
    const res = await api.get<NoticeAnalytics>(`/notices/${id}/analytics`);
    return res.data;
  },

  // 13. ATTACHMENT UPLOAD (PDF)
  uploadAttachment: async (noticeId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    // Don't set explicit Content-Type header so browser sets multipart boundary automatically
    const res = await api.post(`/notices/${noticeId}/attachments`, formData);
    return res.data;
  },

  // 14. ATTACHMENT DELETE
  deleteAttachment: async (noticeId: string, attachmentId: string): Promise<{ success: boolean }> => {
    const res = await api.delete<{ success: boolean }>(
      `/notices/${noticeId}/attachments/${attachmentId}`,
    );
    return res.data;
  },

  // 15. ATTACHMENT STREAM URL
  getAttachmentStreamUrl: (noticeId: string, attachmentId: string): string => {
    return `/api/v1/notices/${noticeId}/attachments/${attachmentId}/stream`;
  },
};
