export type MarketplaceCategory =
  | 'BOOKS_AND_STUDY'
  | 'ELECTRONICS'
  | 'LAB_EQUIPMENT'
  | 'HOSTEL_DORM'
  | 'FURNITURE'
  | 'STATIONERY'
  | 'SPORTS_FITNESS'
  | 'CLOTHING_ACCESSORIES'
  | 'OTHER';

export type ProductCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'FOR_PARTS';
export type ListingVisibility = 'ALL' | 'FACULTY_ONLY';
export type ListingStatus = 'ACTIVE' | 'RESERVED' | 'SOLD' | 'ARCHIVED' | 'REMOVED';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type TransactionStatus =
  | 'INITIATED'
  | 'PRICE_AGREED'
  | 'HANDOVER_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';
export type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED' | 'RESOLVED';
export type ReportReason =
  | 'SUSPECTED_SCAM'
  | 'MISLEADING_DESCRIPTION'
  | 'PROHIBITED_ITEM'
  | 'HARASSMENT'
  | 'SUSPICIOUS_TRANSACTION'
  | 'INAPPROPRIATE_CONTENT'
  | 'OTHER';

export interface MarketplaceImage {
  id: string;
  listingId: string;
  storageKey: string;
  url: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface SellerProfile {
  id: string;
  email: string;
  student?: {
    firstName: string;
    lastName: string | null;
    rollNumber?: string;
    phone?: string | null;
    photoKey?: string | null;
    department?: { name: string; code: string } | null;
  } | null;
  faculty?: {
    firstName: string;
    lastName: string | null;
    designation?: string;
    phone?: string | null;
    photoKey?: string | null;
    department?: { name: string; code: string } | null;
  } | null;
  adminProfile?: {
    name: string;
  } | null;
}

export interface SellerReputation {
  averageRating: number;
  totalReviews: number;
  completedSales: number;
}

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: MarketplaceCategory;
  condition: ProductCondition;
  visibility: ListingVisibility;
  status: ListingStatus;
  preferredLocation: string | null;
  sellerId: string;
  seller?: SellerProfile;
  buyer?: SellerProfile | null;
  sellerReputation?: SellerReputation;
  images: MarketplaceImage[];
  createdAt: string;
  updatedAt: string;
  soldAt?: string | null;
  sellerOffers?: MarketplaceOffer[] | null;
  activeTransaction?: MarketplaceTransaction | null;
  transactions?: MarketplaceTransaction[];
  _count?: {
    offers: number;
    conversations: number;
  };
}

export interface MarketplaceMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  metadata?: any;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  sender?: {
    id: string;
    email?: string;
    student?: { firstName: string; lastName: string | null; photoKey?: string | null } | null;
    faculty?: { firstName: string; lastName: string | null; photoKey?: string | null } | null;
    adminProfile?: { name: string } | null;
  };
}

export interface MarketplaceConversation {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  lastMessageAt: string;
  createdAt: string;
  listing?: {
    id: string;
    title: string;
    price: number;
    status: ListingStatus;
    preferredLocation?: string | null;
    sellerId?: string;
    images: MarketplaceImage[];
  };
  buyer?: SellerProfile;
  seller?: SellerProfile;
  otherParty?: SellerProfile;
  unreadCount?: number;
  lastMessage?: MarketplaceMessage | null;
  messages?: MarketplaceMessage[];
}

export interface MarketplaceOffer {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: OfferStatus;
  counterAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  buyer?: SellerProfile;
  listing?: {
    id: string;
    title: string;
    price: number;
  };
}

export interface MarketplaceTransaction {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  agreedPrice: number;
  offerId?: string | null;
  handoverLocation?: string | null;
  handoverDate?: string | null;
  handoverTime?: string | null;
  status: TransactionStatus;
  handoverOtp?: string | null;
  handoverOtpExpiresAt?: string | null;
  handoverOtpAttempts?: number;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  buyerConfirmedAt?: string | null;
  sellerConfirmedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  listing?: MarketplaceListing;
  buyer?: SellerProfile;
  seller?: SellerProfile;
  review?: MarketplaceReview | null;
}

export interface MarketplaceReview {
  id: string;
  transactionId: string;
  listingId: string;
  reviewerId: string;
  sellerId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  reviewer?: SellerProfile;
  listing?: {
    id: string;
    title: string;
    price: number;
  };
}

export interface MarketplaceReport {
  id: string;
  reporterId: string;
  listingId?: string | null;
  transactionId?: string | null;
  reportedUserId?: string | null;
  departmentId?: string | null;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  resolutionNote?: string | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  reporter?: SellerProfile;
  listing?: MarketplaceListing | null;
  reportedUser?: SellerProfile | null;
  transaction?: MarketplaceTransaction | null;
  resolvedBy?: { id: string; email: string } | null;
}

