export type LostFoundType = 'LOST' | 'FOUND';

export type LostFoundCategory =
  | 'ELECTRONICS'
  | 'DOCUMENTS_IDS'
  | 'BOOKS_STATIONERY'
  | 'KEYS'
  | 'BAGS_WALLETS'
  | 'CLOTHING_ACCESSORIES'
  | 'LAB_EQUIPMENT'
  | 'CARDS'
  | 'OTHER';

export type LostFoundStatus = 'OPEN' | 'CLAIM_PENDING' | 'RESOLVED' | 'CANCELLED' | 'HANDED_OVER';

export type MatchStatus = 'PENDING_REVIEW' | 'VERIFIED_MATCH' | 'REJECTED' | 'RESOLVED';

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'VERIFIED_HANDOVER' | 'CANCELLED';

export interface LostFoundImage {
  id: string;
  reportId: string;
  storageKey: string;
  url: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface LostFoundUser {
  id: string;
  email: string;
  role?: { code: string; name: string };
  student?: {
    firstName: string;
    lastName: string | null;
    rollNumber: string;
    department?: { code: string; name: string };
  };
  faculty?: {
    firstName: string;
    lastName: string | null;
    department?: { code: string; name: string };
  };
}

export interface LostFoundReport {
  id: string;
  type: LostFoundType;
  title: string;
  description: string;
  category: LostFoundCategory;
  location: string;
  approximateDate: string;
  approximateTime: string | null;
  distinguishingFeatures: string | null;
  contactPreference: string | null;
  status: LostFoundStatus;
  reporterId: string;
  reporter?: LostFoundUser;
  reporterName?: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: LostFoundImage[];
  claims?: LostFoundClaim[];
  lostMatches?: LostFoundMatch[];
  foundMatches?: LostFoundMatch[];
  _count?: {
    claims: number;
    lostMatches?: number;
    foundMatches?: number;
  };
}

export interface LostFoundMatch {
  id: string;
  lostReportId: string;
  foundReportId: string;
  matchingScore: number;
  matchReason: string | null;
  status: MatchStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lostReport?: LostFoundReport;
  foundReport?: LostFoundReport;
}

export interface LostFoundClaim {
  id: string;
  reportId: string;
  claimantId: string;
  claimDetails: string;
  proofImageUrl: string | null;
  verificationCode?: string;
  status: ClaimStatus;
  staffNote: string | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  claimant?: LostFoundUser;
  claimantName?: string;
  report?: LostFoundReport;
}

export interface LostFoundNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  reportId: string | null;
  matchId: string | null;
  claimId: string | null;
  type: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface LostFoundContribution {
  id: string;
  userId: string;
  reportId: string | null;
  points: number;
  actionType: string;
  badge: string | null;
  createdAt: string;
}

export interface UserStats {
  totalPoints: number;
  badge: 'Helper' | 'Top Contributor' | 'Campus Guardian' | 'Newcomer';
  badgeInfo: {
    badge: 'Helper' | 'Top Contributor' | 'Campus Guardian' | 'Newcomer';
    points: number;
    nextTierPoints: number;
    progressPercent: number;
  };
  itemsReported: number;
  itemsReturned: number;
  history: LostFoundContribution[];
}

export interface LeaderboardUser {
  rank: number;
  userId: string;
  name: string;
  email?: string;
  role: string;
  department: string;
  points: number;
  badge: string;
}

export interface PaginatedReports {
  items: LostFoundReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

