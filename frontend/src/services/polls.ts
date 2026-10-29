import api from '@/api/axios';
import type {
  PollItem,
  CreatePollInput,
  SubmitVoteInput,
  VoterReportResponse,
  AcademicScopesResponse,
} from '@/types/polls';

export interface PollsQueryParams {
  tab?: 'ALL' | 'ACTIVE' | 'MY_POLLS' | 'PARTICIPATED' | 'CLOSED';
  search?: string;
  page?: number;
  limit?: number;
}

export interface PollsResponse {
  items: PollItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const pollsApi = {
  getPolls: async (params?: PollsQueryParams): Promise<PollsResponse> => {
    const res = await api.get<PollsResponse>('/polls', { params });
    return res.data;
  },

  getPollById: async (id: string): Promise<PollItem> => {
    const res = await api.get<PollItem>(`/polls/${id}`);
    return res.data;
  },

  createPoll: async (payload: CreatePollInput): Promise<PollItem> => {
    const res = await api.post<PollItem>('/polls', payload);
    return res.data;
  },

  submitVote: async (pollId: string, payload: SubmitVoteInput): Promise<PollItem> => {
    const res = await api.post<PollItem>(`/polls/${pollId}/vote`, payload);
    return res.data;
  },

  getVoterReport: async (pollId: string): Promise<VoterReportResponse> => {
    const res = await api.get<VoterReportResponse>(`/polls/${pollId}/voters`);
    return res.data;
  },

  deletePoll: async (pollId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete<{ success: boolean; message: string }>(`/polls/${pollId}`);
    return res.data;
  },

  getAcademicScopes: async (): Promise<AcademicScopesResponse> => {
    const res = await api.get<AcademicScopesResponse>('/polls/academic-scopes');
    return res.data;
  },
};

