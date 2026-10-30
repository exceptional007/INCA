import api from '@/api/axios';
import { io, type Socket } from 'socket.io-client';
import type {
  MarketplaceListing,
  MarketplaceConversation,
  MarketplaceMessage,
  MarketplaceOffer,
  MarketplaceTransaction,
  MarketplaceReview,
  MarketplaceReport,
  MarketplaceCategory,
  ProductCondition,
  ListingStatus,
  ReportStatus,
} from '@/types/marketplace';

// Socket connection singleton
let socket: Socket | null = null;

export const getMarketplaceSocket = (): Socket => {
  const token = localStorage.getItem('inca_token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
  const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');

  if (!socket) {
    socket = io(`${baseUrl}/marketplace`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  } else if (!socket.connected && token) {
    socket.auth = { token };
    socket.connect();
  }

  return socket;
};

export const disconnectMarketplaceSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Universal delivery URL resolver for Cloudflare R2 marketplace images.
 */
export const getMarketplaceImageUrl = (urlOrKey: string | null | undefined): string => {
  if (!urlOrKey) return '';
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    return urlOrKey;
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
  const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');

  if (urlOrKey.startsWith('/api/')) {
    return `${baseUrl}${urlOrKey}`;
  }

  return `${baseUrl}/api/v1/marketplace/images/stream?key=${encodeURIComponent(urlOrKey)}`;
};

export interface ListingQueryParams {
  search?: string;
  category?: MarketplaceCategory | string;
  condition?: ProductCondition | string;
  status?: ListingStatus | string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'createdAt' | 'price' | 'views';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const marketplaceApi = {
  // LISTINGS
  getListings: async (params?: ListingQueryParams) => {
    const res = await api.get<{
      items: MarketplaceListing[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/marketplace/listings', { params });
    return res.data;
  },

  getListingById: async (id: string) => {
    const res = await api.get<MarketplaceListing>(`/marketplace/listings/${id}`);
    return res.data;
  },

  getMyListings: async () => {
    const res = await api.get<MarketplaceListing[]>('/marketplace/listings/my-listings');
    return res.data;
  },

  createListing: async (data: {
    title: string;
    description: string;
    price: number;
    category: MarketplaceCategory;
    condition: ProductCondition;
    visibility?: string;
    pickupLocation?: string;
  }) => {
    const res = await api.post<MarketplaceListing>('/marketplace/listings', data);
    return res.data;
  },

  uploadListingImages: async (listingId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const res = await api.post(`/marketplace/listings/${listingId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  deleteListingImage: async (listingId: string, imageId: string) => {
    const res = await api.delete(`/marketplace/listings/${listingId}/images/${imageId}`);
    return res.data;
  },

  updateListing: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      price: number;
      category: MarketplaceCategory;
      condition: ProductCondition;
      visibility: string;
      pickupLocation: string;
      status: ListingStatus;
    }>,
  ) => {
    const res = await api.patch<MarketplaceListing>(`/marketplace/listings/${id}`, data);
    return res.data;
  },

  markAsSold: async (id: string) => {
    const res = await api.patch(`/marketplace/listings/${id}/sold`);
    return res.data;
  },

  deleteListing: async (id: string) => {
    const res = await api.delete(`/marketplace/listings/${id}`);
    return res.data;
  },

  // CHAT & CONVERSATIONS
  getOrCreateConversation: async (listingId: string) => {
    const res = await api.post<MarketplaceConversation>('/marketplace/conversations', { listingId });
    return res.data;
  },

  getUserConversations: async () => {
    const res = await api.get<MarketplaceConversation[]>('/marketplace/conversations');
    return res.data;
  },

  getConversationMessages: async (conversationId: string) => {
    const res = await api.get<{
      conversation: MarketplaceConversation;
      messages: MarketplaceMessage[];
      activeOffer: MarketplaceOffer | null;
      activeTransaction: MarketplaceTransaction | null;
    }>(`/marketplace/conversations/${conversationId}`);
    return res.data;
  },

  sendMessage: async (conversationId: string, content: string, messageType = 'TEXT', metadata?: any) => {
    const res = await api.post<MarketplaceMessage>(
      `/marketplace/conversations/${conversationId}/messages`,
      { conversationId, content, messageType, metadata },
    );
    return res.data;
  },

  getUnreadCount: async () => {
    const res = await api.get<{ unreadCount: number }>('/marketplace/conversations/unread-count');
    return res.data;
  },

  // OFFERS & NEGOTIATION
  createOffer: async (listingId: string, amount: number) => {
    const res = await api.post<MarketplaceOffer>('/marketplace/offers', { listingId, amount });
    return res.data;
  },

  getListingOffers: async (listingId: string) => {
    const res = await api.get<MarketplaceOffer[]>(`/marketplace/offers/listing/${listingId}`);
    return res.data;
  },

  respondOffer: async (
    offerId: string,
    action: 'ACCEPT' | 'REJECT' | 'COUNTER' | 'CANCEL',
    counterAmount?: number,
  ) => {
    const res = await api.patch<MarketplaceOffer>(`/marketplace/offers/${offerId}/respond`, {
      action,
      counterAmount,
    });
    return res.data;
  },

  // TRANSACTIONS & OTP
  initiateTransaction: async (
    listingId: string,
    offerId?: string,
    schedule?: { location?: string; date?: string; time?: string },
  ) => {
    const res = await api.post<MarketplaceTransaction>('/marketplace/transactions', {
      listingId,
      offerId,
      ...schedule,
    });
    return res.data;
  },

  confirmSchedule: async (
    transactionId: string,
    data: { location: string; date: string; time: string },
  ) => {
    const res = await api.post<MarketplaceTransaction>(
      `/marketplace/transactions/${transactionId}/schedule`,
      data,
    );
    return res.data;
  },

  getMyDeals: async () => {
    const res = await api.get<{ purchases: MarketplaceTransaction[]; sales: MarketplaceTransaction[] }>(
      '/marketplace/transactions/my-deals',
    );
    return res.data;
  },

  getTransactionById: async (id: string) => {
    const res = await api.get<MarketplaceTransaction>(`/marketplace/transactions/${id}`);
    return res.data;
  },

  regenerateOtp: async (transactionId: string) => {
    const res = await api.post<MarketplaceTransaction>(
      `/marketplace/transactions/${transactionId}/regenerate-otp`,
    );
    return res.data;
  },

  verifyHandover: async (transactionId: string, otp: string) => {
    const res = await api.post<{ success: boolean; message: string; transaction: MarketplaceTransaction }>(
      `/marketplace/transactions/${transactionId}/verify-handover`,
      { otp },
    );
    return res.data;
  },

  cancelTransaction: async (transactionId: string, reason?: string) => {
    const res = await api.post<MarketplaceTransaction>(
      `/marketplace/transactions/${transactionId}/cancel`,
      { reason },
    );
    return res.data;
  },

  // REVIEWS & RATINGS
  createReview: async (
    dataOrTxId: { transactionId: string; rating: number; comment?: string } | string,
    rating?: number,
    comment?: string,
  ) => {
    const payload =
      typeof dataOrTxId === 'string'
        ? { transactionId: dataOrTxId, rating: rating || 5, comment }
        : dataOrTxId;
    const res = await api.post<MarketplaceReview>('/marketplace/reviews', payload);
    return res.data;
  },

  getSellerReviews: async (sellerId: string) => {
    const res = await api.get<{
      summary: { averageRating: number; totalReviews: number; completedSales: number };
      reviews: MarketplaceReview[];
    }>(`/marketplace/sellers/${sellerId}/reviews`);
    return res.data;
  },

  // MODERATION & REPORTS
  createReport: async (data: {
    listingId?: string;
    reportedUserId?: string;
    transactionId?: string;
    reason: string;
    description: string;
  }) => {
    const res = await api.post<MarketplaceReport>('/marketplace/reports', data);
    return res.data;
  },

  getModerationReports: async (status?: ReportStatus) => {
    const res = await api.get<MarketplaceReport[]>('/marketplace/moderation/reports', {
      params: { status },
    });
    return res.data;
  },

  resolveReport: async (
    reportId: string,
    data: {
      status: ReportStatus;
      resolutionNote?: string;
      removeListing?: boolean;
      action?: 'NONE' | 'REMOVE_LISTING' | 'WARN_USER' | 'SUSPEND_USER';
    },
  ) => {
    const res = await api.patch<MarketplaceReport>(
      `/marketplace/moderation/reports/${reportId}/resolve`,
      data,
    );
    return res.data;
  },
};
