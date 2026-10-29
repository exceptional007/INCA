export type PollVotingMode = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
export type PollResultVisibility = 'ALWAYS_PUBLIC' | 'AFTER_EXPIRY';
export type PollStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

export interface PollOptionItem {
  id: string;
  text: string;
  displayOrder: number;
  voteCount?: number;
  percentage?: number;
  isSelectedByMe?: boolean;
}

export interface PollItem {
  id: string;
  question: string;
  description?: string | null;
  votingMode: PollVotingMode;
  isAnonymous: boolean;
  resultVisibility: PollResultVisibility;
  status: PollStatus;
  expiresAt: string;
  resultsPublishAt?: string | null;
  targetScope: string;
  department?: { id: string; name: string; code: string } | null;
  program?: { id: string; name: string; code: string } | null;
  targetYear?: number | null;
  targetSemester?: number | null;
  targetBatch?: string | null;
  creator: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  createdAt: string;
  totalVotes: number;
  hasVoted: boolean;
  canViewResults: boolean;
  isExpired: boolean;
  userVotedOptionIds: string[];
  options: PollOptionItem[];
}

export interface CreatePollInput {
  question: string;
  description?: string;
  options: string[];
  votingMode: PollVotingMode;
  isAnonymous: boolean;
  resultVisibility: PollResultVisibility;
  expiresAt: string;
  resultsPublishAt?: string;
  targetScope?: string;
  departmentId?: string;
  programId?: string;
  targetYear?: number;
  targetSemester?: number;
  targetBatch?: string;
}

export interface SubmitVoteInput {
  optionIds: string[];
}

export interface VoterReportRecord {
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  department: string;
  idNumber: string;
  votedAt: string;
  selectedOptions: string[];
}

export interface VoterReportResponse {
  pollId: string;
  question: string;
  totalVoters: number;
  voters: VoterReportRecord[];
}

export interface AcademicScopesResponse {
  departments: Array<{ id: string; name: string; code: string }>;
  programs: Array<{ id: string; name: string; code: string; departmentId: string }>;
  semesters: number[];
}

