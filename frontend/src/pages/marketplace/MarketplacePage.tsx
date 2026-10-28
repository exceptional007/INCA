import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import type {
  MarketplaceListing,
  MarketplaceCategory,
  ProductCondition,
  MarketplaceConversation,
  MarketplaceTransaction,
} from '@/types/marketplace';
import { marketplaceApi, type ListingQueryParams } from '@/services/marketplace';
import { CreateListingModal } from './CreateListingModal';
import { ListingDetailModal } from './ListingDetailModal';
import { ChatDealModal } from './ChatDealModal';
import { ReviewModal } from './ReviewModal';
import { ReportModal } from './ReportModal';
import { ModerationQueue } from './ModerationQueue';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Store,
  Plus,
  Search,
  MessageSquare,
  Package,
  ShoppingBag,
  ShieldAlert,
  Star,
  MapPin,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

const CATEGORIES: { label: string; value: MarketplaceCategory | 'ALL' }[] = [
  { label: 'All Items', value: 'ALL' },
  { label: 'Textbooks & Notes', value: 'BOOKS_AND_STUDY' },
  { label: 'Electronics', value: 'ELECTRONICS' },
  { label: 'Lab Equipment', value: 'LAB_EQUIPMENT' },
  { label: 'Hostel & Dorm', value: 'HOSTEL_DORM' },
  { label: 'Furniture', value: 'FURNITURE' },
  { label: 'Stationery', value: 'STATIONERY' },
  { label: 'Sports & Fitness', value: 'SPORTS_FITNESS' },
  { label: 'Clothing & Accessories', value: 'CLOTHING_ACCESSORIES' },
  { label: 'Other', value: 'OTHER' },
];

export const MarketplacePage: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role?.code || 'STUDENT';
  const currentUserId = user?.id || '';
  const isModerator = ['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(userRole.toUpperCase());

  // Active Tab
  const [activeTab, setActiveTab] = useState<'explore' | 'my-listings' | 'chats' | 'deals' | 'moderation'>(
    'explore',
  );

  // Explore State
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | 'ALL'>('ALL');
  const [selectedCondition, setSelectedCondition] = useState<ProductCondition | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'createdAt' | 'price'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // My Listings State
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [loadingMyListings, setLoadingMyListings] = useState(false);

  // Conversations State
  const [conversations, setConversations] = useState<MarketplaceConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Deals State
  const [myDeals, setMyDeals] = useState<{
    purchases: MarketplaceTransaction[];
    sales: MarketplaceTransaction[];
  }>({ purchases: [], sales: [] });
  const [loadingDeals, setLoadingDeals] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Chat / Deal Modal
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [activeChatConvId, setActiveChatConvId] = useState<string | null>(null);
  const [activeChatListing, setActiveChatListing] = useState<MarketplaceListing | null>(null);

  // Review Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTransactionId, setReviewTransactionId] = useState<string | null>(null);

  // Report Modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportTargetType, setReportTargetType] = useState<'listing' | 'user' | 'transaction'>('listing');

  // Load Explore Listings
  const loadListings = async () => {
    try {
      setLoadingListings(true);
      const params: ListingQueryParams = {
        search: searchQuery.trim() || undefined,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        condition: selectedCondition === 'ALL' ? undefined : selectedCondition,
        sortBy,
        sortOrder,
        page,
        limit: 12,
      };
      const res = await marketplaceApi.getListings(params);
      setListings(res.items);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Failed to load listings', err);
    } finally {
      setLoadingListings(false);
    }
  };

  // Load My Listings
  const loadMyListings = async () => {
    try {
      setLoadingMyListings(true);
      const res = await marketplaceApi.getMyListings();
      setMyListings(res);
    } catch (err) {
      console.error('Failed to load my listings', err);
    } finally {
      setLoadingMyListings(false);
    }
  };

  // Load Conversations
  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const res = await marketplaceApi.getUserConversations();
      setConversations(res);
      const unreadRes = await marketplaceApi.getUnreadCount();
      setUnreadCount(unreadRes.unreadCount);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Load Deals
  const loadMyDeals = async () => {
    try {
      setLoadingDeals(true);
      const res = await marketplaceApi.getMyDeals();
      setMyDeals(res);
    } catch (err) {
      console.error('Failed to load deals', err);
    } finally {
      setLoadingDeals(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'explore') loadListings();
    else if (activeTab === 'my-listings') loadMyListings();
    else if (activeTab === 'chats') loadConversations();
    else if (activeTab === 'deals') loadMyDeals();
  }, [activeTab, page, selectedCategory, selectedCondition, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadListings();
  };

  const handleOpenDetail = (listing: MarketplaceListing) => {
    setSelectedListing(listing);
    setDetailModalOpen(true);
  };

  const handleStartChat = async (listing: MarketplaceListing) => {
    try {
      setDetailModalOpen(false);
      const conv = await marketplaceApi.getOrCreateConversation(listing.id);
      setActiveChatConvId(conv.id);
      setActiveChatListing(listing);
      setChatModalOpen(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to start conversation');
    }
  };

  const handleInitiateBuy = async (listing: MarketplaceListing) => {
    try {
      setDetailModalOpen(false);
      const conv = await marketplaceApi.getOrCreateConversation(listing.id);
      await marketplaceApi.initiateTransaction(listing.id);
      setActiveChatConvId(conv.id);
      setActiveChatListing(listing);
      setChatModalOpen(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to initiate purchase');
    }
  };

  const handleOpenReport = (listing: MarketplaceListing) => {
    setReportTargetId(listing.id);
    setReportTargetType('listing');
    setReportModalOpen(true);
  };

  const handleMarkSold = async (listingId: string) => {
    try {
      await marketplaceApi.markAsSold(listingId);
      setDetailModalOpen(false);
      loadListings();
      loadMyListings();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to mark sold');
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!confirm('Are you sure you want to archive this listing?')) return;
    try {
      await marketplaceApi.deleteListing(listingId);
      setDetailModalOpen(false);
      loadListings();
      loadMyListings();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to remove listing');
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Store className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Campus Marketplace
                <Badge variant="outline" className="text-xs font-semibold">
                  INR Verified
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Peer-to-peer campus exchange for textbooks, dorm supplies, electronics, and lab gear with in-person OTP verification.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={() => setCreateModalOpen(true)} className="gap-2 shadow-xs">
          <Plus className="size-4" />
          List an Item
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-1 border-b">
        <Button
          variant={activeTab === 'explore' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('explore')}
          className="gap-2 shrink-0 font-medium text-xs"
        >
          <Search className="size-3.5" />
          Browse Catalog
        </Button>
        <Button
          variant={activeTab === 'my-listings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('my-listings')}
          className="gap-2 shrink-0 font-medium text-xs"
        >
          <Package className="size-3.5" />
          My Listings
        </Button>
        <Button
          variant={activeTab === 'chats' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('chats')}
          className="gap-2 shrink-0 font-medium text-xs relative"
        >
          <MessageSquare className="size-3.5" />
          Deals & Messages
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[10px] size-4.5 rounded-full flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
        <Button
          variant={activeTab === 'deals' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('deals')}
          className="gap-2 shrink-0 font-medium text-xs"
        >
          <ShoppingBag className="size-3.5" />
          My Purchases & Orders
        </Button>
        {isModerator && (
          <Button
            variant={activeTab === 'moderation' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('moderation')}
            className="gap-2 shrink-0 font-medium text-xs text-amber-700 hover:text-amber-800"
          >
            <ShieldAlert className="size-3.5 text-amber-600" />
            Moderation Queue
          </Button>
        )}
      </div>

      {/* TAB 1: EXPLORE CATALOG */}
      {activeTab === 'explore' && (
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search textbooks, calculators, dorm chairs, lab kits..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm" className="h-9">
                Search
              </Button>
            </form>

            <div className="flex items-center gap-2">
              <select
                value={selectedCondition}
                onChange={(e) => {
                  setSelectedCondition(e.target.value as any);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs"
              >
                <option value="ALL">All Conditions</option>
                <option value="NEW">Brand New</option>
                <option value="LIKE_NEW">Like New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="FOR_PARTS">For Parts</option>
              </select>

              <select
                value={`${sortBy}_${sortOrder}`}
                onChange={(e) => {
                  const [by, order] = e.target.value.split('_');
                  setSortBy(by as any);
                  setSortOrder(order as any);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs"
              >
                <option value="createdAt_desc">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Category Pills Bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => {
                  setSelectedCategory(cat.value);
                  setPage(1);
                }}
                className={`text-xs px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-all border ${
                  selectedCategory === cat.value
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-muted-foreground border-border/80 hover:bg-muted'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Listings Grid */}
          {loadingListings ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16 bg-card border rounded-2xl p-6">
              <Package className="size-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold text-foreground text-base">No items found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                No active listings match your current filters. Try expanding your search or be the first to list an item in this category!
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateModalOpen(true)}
                className="mt-4 gap-2"
              >
                <Plus className="size-3.5" />
                Post Item
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map((item) => {
                const coverImage = item.images?.[0]?.url || item.images?.[0]?.storageKey;
                const sellerName = item.seller?.student
                  ? `${item.seller.student.firstName} ${item.seller.student.lastName || ''}`.trim()
                  : item.seller?.faculty
                  ? `${item.seller.faculty.firstName} ${item.seller.faculty.lastName || ''}`.trim()
                  : 'Campus Member';

                return (
                  <Card
                    key={item.id}
                    onClick={() => handleOpenDetail(item)}
                    className="overflow-hidden hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between border-border/80"
                  >
                    <div>
                      <div className="aspect-4/3 bg-muted relative overflow-hidden flex items-center justify-center">
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <ShoppingBag className="size-10 text-muted-foreground/40" />
                        )}

                        {item.status === 'SOLD' && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Badge variant="destructive" className="font-bold">
                              SOLD
                            </Badge>
                          </div>
                        )}

                        {item.status === 'RESERVED' && (
                          <div className="absolute top-2 left-2">
                            <Badge className="bg-amber-500 text-white font-semibold text-[10px]">
                              Pending Handover
                            </Badge>
                          </div>
                        )}

                        {item.visibility === 'FACULTY_ONLY' && (
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-amber-100 text-amber-800 text-[10px] border-amber-300">
                              Faculty Only
                            </Badge>
                          </div>
                        )}
                      </div>

                      <CardContent className="p-3.5 space-y-2">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-lg font-bold text-foreground">
                            ₹{item.price.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium bg-muted px-1.5 py-0.5 rounded">
                            {item.condition.replace('_', ' ')}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-foreground line-clamp-1 leading-snug">
                          {item.title}
                        </h3>

                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="size-3 text-primary shrink-0" />
                          <span className="truncate">{item.preferredLocation || 'Campus Center'}</span>
                        </div>
                      </CardContent>
                    </div>

                    <div className="px-3.5 py-2.5 bg-muted/20 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[120px] font-medium">{sellerName}</span>
                      {item.sellerReputation && item.sellerReputation.totalReviews > 0 ? (
                        <span className="flex items-center gap-1 text-amber-600 font-bold">
                          <Star className="size-3 fill-amber-500 text-amber-500" />
                          {item.sellerReputation.averageRating}
                        </span>
                      ) : (
                        <span className="text-[10px]">Campus Verified</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-xs font-semibold flex items-center px-3">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY LISTINGS */}
      {activeTab === 'my-listings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Items You're Selling</h2>
            <Button size="sm" onClick={() => setCreateModalOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              New Listing
            </Button>
          </div>

          {loadingMyListings ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : myListings.length === 0 ? (
            <div className="text-center py-16 bg-card border rounded-2xl p-6 text-muted-foreground">
              <Package className="size-10 mx-auto mb-2" />
              <p className="font-semibold text-foreground text-sm">You have no active listings</p>
              <p className="text-xs mt-1">Start selling your old books, gear, or dorm items to students.</p>
              <Button onClick={() => setCreateModalOpen(true)} size="sm" className="mt-4 gap-1.5">
                <Plus className="size-3.5" />
                List Your First Item
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {myListings.map((item) => (
                <Card
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className="overflow-hidden hover:shadow-md transition cursor-pointer border flex flex-col justify-between"
                >
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={item.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className="text-xs font-semibold"
                      >
                        {item.status}
                      </Badge>
                      <span className="text-base font-bold text-foreground">
                        ₹{item.price.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  </div>

                  <div className="px-4 py-2.5 bg-muted/30 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item._count?.offers || 0} Offers</span>
                    <span>{item._count?.conversations || 0} Chats</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONVERSATIONS & ACTIVE DEALS */}
      {activeTab === 'chats' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground">Direct Chats & In-Progress Deals</h2>

          {loadingConversations ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-16 bg-card border rounded-2xl p-6 text-muted-foreground">
              <MessageSquare className="size-10 mx-auto mb-2 text-primary/60" />
              <p className="font-semibold text-foreground text-sm">No active conversations</p>
              <p className="text-xs mt-1">
                When you click "Chat & Negotiate" on a listing, your direct messages will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {conversations.map((conv) => {
                const other = conv.otherParty;
                const otherName = other?.student
                  ? `${other.student.firstName} ${other.student.lastName || ''}`.trim()
                  : other?.faculty
                  ? `${other.faculty.firstName} ${other.faculty.lastName || ''}`.trim()
                  : 'Campus Member';

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveChatConvId(conv.id);
                      setActiveChatListing((conv.listing as any) || null);
                      setChatModalOpen(true);
                    }}
                    className="p-4 bg-card border rounded-xl hover:shadow-md transition cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="size-11 rounded-full bg-primary/10 border text-primary font-bold flex items-center justify-center text-sm">
                          {otherName.substring(0, 2).toUpperCase()}
                        </div>
                        {(conv.unreadCount || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] size-4 rounded-full flex items-center justify-center font-bold">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">
                          {otherName}
                        </div>
                        <div className="text-xs text-primary font-medium truncate">
                          {conv.listing?.title} (₹{conv.listing?.price.toLocaleString('en-IN')})
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {conv.lastMessage?.content || 'No messages yet'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {conv.listing?.status}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(conv.lastMessageAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MY PURCHASES & SALES */}
      {activeTab === 'deals' && (
        <div className="space-y-6">
          {loadingDeals ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Purchases Section */}
              <div className="space-y-3">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShoppingBag className="size-4 text-primary" />
                  Items You Purchased
                </h2>

                {myDeals.purchases.length === 0 ? (
                  <p className="text-xs text-muted-foreground bg-card p-4 rounded-xl border">
                    You haven't initiated any purchases yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {myDeals.purchases.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-4 bg-card border rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-foreground">
                              {tx.listing?.title}
                            </h3>
                            <Badge
                              variant={tx.status === 'COMPLETED' ? 'default' : 'outline'}
                              className="text-[10px]"
                            >
                              {tx.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Agreed Price:{' '}
                            <strong className="text-foreground">
                              ₹{tx.agreedPrice.toLocaleString('en-IN')}
                            </strong>{' '}
                            • Handover:{' '}
                            {tx.listing?.preferredLocation || 'Campus Center'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {tx.status === 'HANDOVER_PENDING' && tx.handoverOtp && (
                            <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20">
                              <span className="text-xs font-semibold">Your Handover OTP:</span>
                              <span className="font-mono font-bold text-base tracking-widest">
                                {tx.handoverOtp}
                              </span>
                            </div>
                          )}

                          {tx.status === 'COMPLETED' && !tx.review && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setReviewTransactionId(tx.id);
                                setReviewModalOpen(true);
                              }}
                              className="gap-1.5 h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                            >
                              <Star className="size-3 fill-white" />
                              Rate & Review
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sales Section */}
              <div className="space-y-3 pt-4 border-t">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Package className="size-4 text-emerald-600" />
                  Your Sales & Completed Orders
                </h2>

                {myDeals.sales.length === 0 ? (
                  <p className="text-xs text-muted-foreground bg-card p-4 rounded-xl border">
                    You have no sales transactions recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {myDeals.sales.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-4 bg-card border rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-foreground">
                              {tx.listing?.title}
                            </h3>
                            <Badge
                              variant={tx.status === 'COMPLETED' ? 'default' : 'outline'}
                              className="text-[10px]"
                            >
                              {tx.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Agreed Price:{' '}
                            <strong className="text-foreground">
                              ₹{tx.agreedPrice.toLocaleString('en-IN')}
                            </strong>
                          </div>
                        </div>

                        {tx.status === 'COMPLETED' && (
                          <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="size-4 text-emerald-600" />
                            Completed on {new Date(tx.completedAt || tx.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 5: MODERATION QUEUE (HOD / ADMIN ONLY) */}
      {activeTab === 'moderation' && isModerator && <ModerationQueue />}

      {/* MODALS */}
      <CreateListingModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          loadListings();
          loadMyListings();
        }}
        userRole={userRole}
      />

      <ListingDetailModal
        listing={selectedListing}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        currentUserId={currentUserId}
        onOpenChat={handleStartChat}
        onInitiateBuy={handleInitiateBuy}
        onReport={handleOpenReport}
        onMarkSold={handleMarkSold}
        onDeleteListing={handleDeleteListing}
      />

      <ChatDealModal
        conversationId={activeChatConvId}
        listing={activeChatListing}
        isOpen={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        currentUserId={currentUserId}
        onOpenReviewModal={(txId) => {
          setReviewTransactionId(txId);
          setReviewModalOpen(true);
        }}
        onDealCompleted={() => {
          loadListings();
          loadMyListings();
          loadMyDeals();
        }}
      />

      <ReviewModal
        transactionId={reviewTransactionId}
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onReviewed={() => {
          loadMyDeals();
        }}
      />

      <ReportModal
        targetId={reportTargetId}
        targetType={reportTargetType}
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onReported={() => {
          alert('Report submitted to department moderation. Thank you for keeping campus safe.');
        }}
      />
    </div>
  );
};

export default MarketplacePage;
