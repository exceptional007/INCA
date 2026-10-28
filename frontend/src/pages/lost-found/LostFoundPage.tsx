import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { lostFoundApi } from '@/services/lost-found';
import type {
  LostFoundReport,
  LostFoundMatch,
  LostFoundClaim,
  LostFoundNotification,
  UserStats,
  LeaderboardUser,
  LostFoundType,
  LostFoundCategory,
  LostFoundStatus,
} from '@/types/lost-found';
import { ItemCard } from './ItemCard';
import { SearchFilterBar } from './SearchFilterBar';
import { ReportModal } from './ReportModal';
import { ClaimModal } from './ClaimModal';
import { HandoverVerifyModal } from './HandoverVerifyModal';
import { AiMatchesModal } from './AiMatchesModal';
import { ItemDetailModal } from './ItemDetailModal';
import { LeaderboardView } from './LeaderboardView';
import {
  Search,
  Sparkles,
  PlusCircle,
  Bell,
  Package,
  Layers,
  Trophy,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const LostFoundPage: React.FC = () => {
  const { user } = useAuth();

  // Tab State: 'browse' | 'my-items' | 'matches' | 'leaderboard'
  const [activeTab, setActiveTab] = useState<'browse' | 'my-items' | 'matches' | 'leaderboard'>(
    'browse',
  );

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<LostFoundType | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<LostFoundCategory | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<LostFoundStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  // Data States
  const [reports, setReports] = useState<LostFoundReport[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // My Reports & My Claims
  const [myReports, setMyReports] = useState<LostFoundReport[]>([]);
  const [myClaims, setMyClaims] = useState<LostFoundClaim[]>([]);
  const [isLoadingMyItems, setIsLoadingMyItems] = useState(false);

  // Stats & Leaderboard
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<LostFoundNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalDefaultType, setReportModalDefaultType] = useState<LostFoundType>('LOST');

  const [selectedItemForDetails, setSelectedItemForDetails] = useState<LostFoundReport | null>(null);
  const [selectedItemForClaim, setSelectedItemForClaim] = useState<LostFoundReport | null>(null);
  const [selectedClaimForHandover, setSelectedClaimForHandover] = useState<LostFoundClaim | null>(null);
  const [activeMatches, setActiveMatches] = useState<LostFoundMatch[]>([]);
  const [isMatchesModalOpen, setIsMatchesModalOpen] = useState(false);

  // 1. Fetch Registry Reports
  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await lostFoundApi.getReports({
        search: searchQuery || undefined,
        type: selectedType === 'ALL' ? undefined : selectedType,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        page,
        limit: 12,
      });
      setReports(res.items);
      setTotalResults(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Failed to fetch lost & found reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedType, selectedCategory, selectedStatus, page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // 2. Fetch User Stats and Notifications
  const fetchUserData = useCallback(async () => {
    try {
      const [stats, notifs] = await Promise.all([
        lostFoundApi.getMyContributionStats().catch(() => null),
        lostFoundApi.getNotifications().catch(() => []),
      ]);
      if (stats) setUserStats(stats);
      if (notifs) {
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.isRead).length);
      }
    } catch (err) {
      console.error('Error loading user lost & found data:', err);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // 3. Fetch My Items (Reports & Claims)
  const fetchMyItems = useCallback(async () => {
    try {
      setIsLoadingMyItems(true);
      const [reportsData, claimsData] = await Promise.all([
        lostFoundApi.getMyReports().catch(() => []),
        lostFoundApi.getMyClaims().catch(() => []),
      ]);
      setMyReports(reportsData);
      setMyClaims(claimsData);
    } catch (err) {
      console.error('Failed to fetch my items:', err);
    } finally {
      setIsLoadingMyItems(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'my-items') {
      fetchMyItems();
    }
  }, [activeTab, fetchMyItems]);

  // 4. Fetch Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoadingLeaderboard(true);
      const data = await lostFoundApi.getLeaderboard(15);
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab, fetchLeaderboard]);

  const handleOpenMatches = async (item: LostFoundReport) => {
    try {
      const matches = await lostFoundApi.getMatchesForReport(item.id);
      setActiveMatches(matches);
      setIsMatchesModalOpen(true);
    } catch (err) {
      console.error('Failed to load matches:', err);
    }
  };

  const handleReviewClaim = async (claimId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await lostFoundApi.reviewClaim(claimId, { status });
      if (selectedItemForDetails) {
        const refreshed = await lostFoundApi.getReportById(selectedItemForDetails.id);
        setSelectedItemForDetails(refreshed);
      }
      fetchMyItems();
      fetchReports();
    } catch (err) {
      console.error('Failed to review claim:', err);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await lostFoundApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await lostFoundApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('ALL');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-canvas-parchment py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header Banner */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-action-blue uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Gemini AI-Powered Campus Recovery
            </span>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
              Live Registry
            </Badge>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Campus Lost & Found
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Report misplaced belongings, discover candidate items matched with Google Gemini semantic
            intelligence, and verify handovers securely using anti-fraud OTPs.
          </p>
        </div>

        {/* Action Controls & Notifications */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
              className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotificationDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-border rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-900">
                    Notifications ({notifications.length})
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllNotificationsRead}
                      className="text-[11px] text-action-blue hover:underline font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No notifications yet.</p>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkNotificationRead(notif.id)}
                        className={`pt-2 pb-1 text-xs space-y-1 cursor-pointer transition-colors ${
                          !notif.isRead ? 'bg-blue-50/50 p-2 rounded-lg' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{notif.title}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Report Found Item Button */}
          <Button
            size="sm"
            onClick={() => {
              setReportModalDefaultType('FOUND');
              setIsReportModalOpen(true);
            }}
            className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Report Found Item (+10 Pts)
          </Button>

          {/* Report Lost Item Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setReportModalDefaultType('LOST');
              setIsReportModalOpen(true);
            }}
            className="text-xs h-9 border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            Report Lost Item
          </Button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('browse')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'browse'
              ? 'border-action-blue text-action-blue bg-white/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Browse Registry
        </button>

        <button
          onClick={() => setActiveTab('my-items')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'my-items'
              ? 'border-action-blue text-action-blue bg-white/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          My Reports & Claims
          {(myReports.length > 0 || myClaims.length > 0) && (
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
              {myReports.length + myClaims.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'leaderboard'
              ? 'border-action-blue text-action-blue bg-white/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Campus Leaderboard & Badges
          {userStats && (
            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full border border-amber-200">
              {userStats.totalPoints} pts
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Browse Registry */}
      {activeTab === 'browse' && (
        <div className="space-y-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setPage(1);
            }}
            selectedType={selectedType}
            onTypeChange={(t) => {
              setSelectedType(t);
              setPage(1);
            }}
            selectedCategory={selectedCategory}
            onCategoryChange={(c) => {
              setSelectedCategory(c);
              setPage(1);
            }}
            selectedStatus={selectedStatus}
            onStatusChange={(s) => {
              setSelectedStatus(s);
              setPage(1);
            }}
            onReset={handleResetFilters}
            totalResults={totalResults}
          />

          {isLoading ? (
            <div className="text-center py-20 text-xs text-slate-400">
              Loading campus lost and found items...
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-12 text-center space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No items match your query</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try searching with fewer keywords, clearing category filters, or report a lost item to
                let our AI notify you when found.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs h-8"
              >
                Reset All Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {reports.map((report) => (
                <ItemCard
                  key={report.id}
                  item={report}
                  currentUserId={user?.id}
                  onViewDetails={(item) => setSelectedItemForDetails(item)}
                  onClaim={(item) => setSelectedItemForClaim(item)}
                  onViewMatches={(item) => handleOpenMatches(item)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-xs h-8"
              >
                Previous
              </Button>
              <span className="text-xs text-slate-600 px-3">
                Page <b className="text-slate-900">{page}</b> of <b>{totalPages}</b>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="text-xs h-8"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Reports & Claims */}
      {activeTab === 'my-items' && (
        <div className="space-y-8">
          {/* Sub-section A: Items I Reported */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Items You Reported ({myReports.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Track status, incoming ownership claims, and verify in-person handovers.
                </p>
              </div>
            </div>

            {isLoadingMyItems ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading your items...</div>
            ) : myReports.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-8 text-center space-y-2">
                <p className="text-xs text-slate-500">You haven't reported any lost or found items yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myReports.map((report) => (
                  <div key={report.id} className="relative">
                    <ItemCard
                      item={report}
                      currentUserId={user?.id}
                      onViewDetails={(item) => setSelectedItemForDetails(item)}
                      onViewMatches={(item) => handleOpenMatches(item)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-section B: Ownership Claims You Submitted */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ownership Claims You Submitted ({myClaims.length})
              </h2>
              <p className="text-xs text-slate-500">
                Present your 6-digit OTP code to the finder when meeting on campus.
              </p>
            </div>

            {isLoadingMyItems ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading your claims...</div>
            ) : myClaims.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-8 text-center space-y-2">
                <p className="text-xs text-slate-500">You haven't filed any ownership claims yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-4 bg-white rounded-xl border border-border shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">
                        {claim.report?.title || 'Claimed Item'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {claim.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">
                      <b>Your proof details:</b> {claim.claimDetails}
                    </p>

                    {/* 6-Digit OTP display for claimant */}
                    {claim.verificationCode && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                            Your Handover OTP Code
                          </span>
                          <span className="font-mono text-xl font-black text-emerald-950 tracking-widest">
                            {claim.verificationCode}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-700 max-w-[180px] text-right">
                          Present this code to the finder upon collecting item.
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span>Submitted: {new Date(claim.createdAt).toLocaleDateString()}</span>
                      {claim.report && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-action-blue"
                          onClick={() => setSelectedItemForDetails(claim.report!)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View Item
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Leaderboard */}
      {activeTab === 'leaderboard' && (
        <LeaderboardView
          stats={userStats}
          leaderboard={leaderboard}
          isLoading={isLoadingLeaderboard}
        />
      )}

      {/* Modals */}
      {isReportModalOpen && (
        <ReportModal
          isOpen={isReportModalOpen}
          defaultType={reportModalDefaultType}
          onClose={() => setIsReportModalOpen(false)}
          onSuccess={() => {
            fetchReports();
            fetchMyItems();
            fetchUserData();
          }}
        />
      )}

      {selectedItemForDetails && (
        <ItemDetailModal
          isOpen={!!selectedItemForDetails}
          item={selectedItemForDetails}
          currentUserId={user?.id}
          onClose={() => setSelectedItemForDetails(null)}
          onOpenClaim={(item) => {
            setSelectedItemForDetails(null);
            setSelectedItemForClaim(item);
          }}
          onOpenMatches={(item) => handleOpenMatches(item)}
          onVerifyHandover={(claim) => {
            setSelectedClaimForHandover(claim);
          }}
          onReviewClaim={handleReviewClaim}
        />
      )}

      {selectedItemForClaim && (
        <ClaimModal
          isOpen={!!selectedItemForClaim}
          report={selectedItemForClaim}
          onClose={() => setSelectedItemForClaim(null)}
          onClaimSuccess={() => {
            fetchReports();
            fetchMyItems();
          }}
        />
      )}

      {selectedClaimForHandover && (
        <HandoverVerifyModal
          isOpen={!!selectedClaimForHandover}
          claim={selectedClaimForHandover}
          onClose={() => setSelectedClaimForHandover(null)}
          onSuccess={() => {
            fetchMyItems();
            fetchReports();
            fetchUserData();
            if (selectedItemForDetails) {
              lostFoundApi
                .getReportById(selectedItemForDetails.id)
                .then((r) => setSelectedItemForDetails(r))
                .catch(() => {});
            }
          }}
        />
      )}

      {isMatchesModalOpen && (
        <AiMatchesModal
          isOpen={isMatchesModalOpen}
          matches={activeMatches}
          onClose={() => setIsMatchesModalOpen(false)}
          onMatchUpdated={() => {
            fetchReports();
            fetchMyItems();
          }}
        />
      )}
    </div>
  );
};

