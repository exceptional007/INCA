import api from '@/api/axios';
import type {
  LostFoundReport,
  LostFoundMatch,
  LostFoundClaim,
  LostFoundNotification,
  UserStats,
  LeaderboardUser,
  PaginatedReports,
  LostFoundCategory,
  LostFoundType,
  LostFoundStatus,
  MatchStatus,
  ClaimStatus,
} from '@/types/lost-found';

export interface ReportQueryParams {
  search?: string;
  type?: LostFoundType;
  category?: LostFoundCategory;
  status?: LostFoundStatus;
  location?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const lostFoundApi = {
  // Reports
  getReports: async (params?: ReportQueryParams): Promise<PaginatedReports> => {
    const res = await api.get<PaginatedReports>('/lost-found/reports', { params });
    return res.data;
  },

  getReportById: async (id: string): Promise<LostFoundReport> => {
    const res = await api.get<LostFoundReport>(`/lost-found/reports/${id}`);
    return res.data;
  },

  createReport: async (formData: FormData): Promise<LostFoundReport> => {
    const res = await api.post<LostFoundReport>('/lost-found/reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  updateReport: async (id: string, data: Partial<LostFoundReport>): Promise<LostFoundReport> => {
    const res = await api.put<LostFoundReport>(`/lost-found/reports/${id}`, data);
    return res.data;
  },

  deleteReport: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`/lost-found/reports/${id}`);
    return res.data;
  },

  getMyReports: async (): Promise<LostFoundReport[]> => {
    const res = await api.get<LostFoundReport[]>('/lost-found/reports/my-reports');
    return res.data;
  },

  // AI Matching
  getMatchesForReport: async (reportId: string): Promise<LostFoundMatch[]> => {
    const res = await api.get<LostFoundMatch[]>(`/lost-found/reports/${reportId}/matches`);
    return res.data;
  },

  reviewMatch: async (matchId: string, status: MatchStatus): Promise<LostFoundMatch> => {
    const res = await api.put<LostFoundMatch>(`/lost-found/matches/${matchId}/review`, { status });
    return res.data;
  },

  // Claims & Handover OTP
  submitClaim: async (
    reportId: string,
    data: { claimDetails: string; proofImageUrl?: string },
  ): Promise<LostFoundClaim> => {
    const res = await api.post<LostFoundClaim>(`/lost-found/reports/${reportId}/claims`, data);
    return res.data;
  },

  getClaimsForReport: async (reportId: string): Promise<LostFoundClaim[]> => {
    const res = await api.get<LostFoundClaim[]>(`/lost-found/reports/${reportId}/claims`);
    return res.data;
  },

  getMyClaims: async (): Promise<LostFoundClaim[]> => {
    const res = await api.get<LostFoundClaim[]>('/lost-found/claims/my-claims');
    return res.data;
  },

  reviewClaim: async (
    claimId: string,
    data: { status: ClaimStatus; staffNote?: string },
  ): Promise<LostFoundClaim> => {
    const res = await api.put<LostFoundClaim>(`/lost-found/claims/${claimId}/review`, data);
    return res.data;
  },

  verifyClaimHandover: async (
    claimId: string,
    verificationCode: string,
  ): Promise<LostFoundClaim> => {
    const res = await api.post<LostFoundClaim>(`/lost-found/claims/${claimId}/verify-handover`, {
      verificationCode,
    });
    return res.data;
  },

  // Contributions & Leaderboard
  getMyContributionStats: async (): Promise<UserStats> => {
    const res = await api.get<UserStats>('/lost-found/contributions/my-stats');
    return res.data;
  },

  getLeaderboard: async (limit = 10): Promise<LeaderboardUser[]> => {
    const res = await api.get<LeaderboardUser[]>('/lost-found/contributions/leaderboard', {
      params: { limit },
    });
    return res.data;
  },

  // Notifications
  getNotifications: async (unreadOnly = false): Promise<LostFoundNotification[]> => {
    const res = await api.get<LostFoundNotification[]>('/lost-found/notifications', {
      params: { unreadOnly },
    });
    return res.data;
  },

  markNotificationRead: async (id: string): Promise<void> => {
    await api.put(`/lost-found/notifications/${id}/read`);
  },

  markAllNotificationsRead: async (): Promise<void> => {
    await api.put('/lost-found/notifications/read-all');
  },
};

