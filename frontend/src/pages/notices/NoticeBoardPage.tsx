import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import type {
  Notice,
  CriticalAlert,
} from '@/types/notice';
import { noticeApi, type NoticeQueryParams } from '@/services/notice';
import { NoticeDetailModal } from './NoticeDetailModal';
import { CreateNoticeModal } from './CreateNoticeModal';
import { NoticeAnalyticsModal } from './NoticeAnalyticsModal';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Bell,
  Plus,
  Search,
  FileText,
  ShieldAlert,
  AlertTriangle,
  Pin,
  Calendar,
  Clock,
  Eye,
  BarChart3,
  Archive,
  Trash2,
  Loader2,
  Check,
} from 'lucide-react';

const CATEGORIES: { label: string; value: string }[] = [
  { label: 'All Notices', value: 'ALL' },
  { label: 'Academic & Courses', value: 'ACADEMIC' },
  { label: 'Examinations', value: 'EXAMINATION' },
  { label: 'Placements & Jobs', value: 'PLACEMENT' },
  { label: 'Events & Seminars', value: 'EVENT' },
  { label: 'Official Circulars', value: 'CIRCULAR' },
  { label: 'Administrative', value: 'ADMINISTRATIVE' },
  { label: 'Holidays', value: 'HOLIDAY' },
  { label: 'Urgent Notices', value: 'URGENT' },
];

export const NoticeBoardPage: React.FC = () => {
  const { user } = useAuth();
  const userRole = (user?.role?.code || 'STUDENT').toUpperCase();
  const isPublisher = ['FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(userRole);

  // Active Main Tab: 'feed' (Audience Feed) or 'management' (Publisher Dashboard)
  const [activeTab, setActiveTab] = useState<'feed' | 'management'>('feed');

  // Feed State
  const [notices, setNotices] = useState<Notice[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hasAttachment, setHasAttachment] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Publisher Management State
  const [managedNotices, setManagedNotices] = useState<Notice[]>([]);
  const [loadingManagement, setLoadingManagement] = useState(false);
  const [managementStatusFilter, setManagementStatusFilter] = useState('ALL');
  const [managementPage, setManagementPage] = useState(1);
  const [managementTotalPages, setManagementTotalPages] = useState(1);

  // Modals State
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [analyticsNoticeId, setAnalyticsNoticeId] = useState<string | null>(null);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);

  // Load Recipient Feed
  const loadFeed = async () => {
    try {
      setLoadingFeed(true);
      const params: NoticeQueryParams = {
        search: searchQuery.trim() || undefined,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        priority: selectedPriority === 'ALL' ? undefined : selectedPriority,
        unreadOnly: unreadOnly || undefined,
        hasAttachment: hasAttachment || undefined,
        page,
        limit: 10,
      };
      const res = await noticeApi.getRecipientNotices(params);
      setNotices(res.items);
      setCriticalAlerts(res.criticalAlerts || []);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Failed to load notices feed', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  // Load Management Notices
  const loadManagedNotices = async () => {
    if (!isPublisher) return;
    try {
      setLoadingManagement(true);
      const params: NoticeQueryParams = {
        status: managementStatusFilter === 'ALL' ? undefined : managementStatusFilter,
        page: managementPage,
        limit: 12,
      };
      const res = await noticeApi.getManagedNotices(params);
      setManagedNotices(res.items);
      setManagementTotalPages(res.totalPages);
    } catch (err) {
      console.error('Failed to load managed notices', err);
    } finally {
      setLoadingManagement(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'feed') {
      loadFeed();
    } else {
      loadManagedNotices();
    }
  }, [activeTab, page, selectedCategory, selectedPriority, unreadOnly, hasAttachment, managementStatusFilter, managementPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadFeed();
  };

  const handleOpenNotice = async (notice: Notice) => {
    setSelectedNotice(notice);
    setDetailModalOpen(true);
    // Auto-mark as read locally & on backend
    if (!notice.isRead) {
      noticeApi.markAsRead(notice.id).catch(() => {});
      setNotices((prev) =>
        prev.map((n) => (n.id === notice.id ? { ...n, isRead: true } : n)),
      );
    }
  };

  const handleWithdrawNotice = async (noticeId: string) => {
    const reason = prompt('Please state the reason for withdrawing this notice:');
    if (!reason || !reason.trim()) return;

    try {
      await noticeApi.withdrawNotice(noticeId, reason.trim());
      loadManagedNotices();
      loadFeed();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to withdraw notice');
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (!confirm('Are you sure you want to delete this notice? This action cannot be undone.')) {
      return;
    }
    try {
      await noticeApi.deleteNotice(noticeId);
      loadManagedNotices();
      loadFeed();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete notice');
    }
  };

  const handleArchiveNotice = async (noticeId: string) => {
    try {
      await noticeApi.archiveNotice(noticeId);
      loadManagedNotices();
      loadFeed();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to archive notice');
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || '').toUpperCase();
    if (p === 'CRITICAL' || p === 'URGENT') {
      return (
        <Badge variant="destructive" className="text-[10px] uppercase font-bold gap-1 shadow-2xs">
          <ShieldAlert className="size-3" />
          Critical
        </Badge>
      );
    }
    if (p === 'HIGH') {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] uppercase font-semibold gap-1 shadow-2xs">
          <AlertTriangle className="size-3" />
          High
        </Badge>
      );
    }
    if (p === 'LOW') {
      return (
        <Badge variant="secondary" className="text-[10px] text-muted-foreground uppercase">
          Routine
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] uppercase font-medium">
        Standard
      </Badge>
    );
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Bell className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Digital Notice Board
                <Badge variant="outline" className="text-xs font-semibold">
                  Official Campus Circulars
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Official announcements, examination circulars, timetable changes, and deadlines targeted to your academic program.
              </p>
            </div>
          </div>
        </div>

        {isPublisher && (
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2 shadow-xs">
            <Plus className="size-4" />
            Publish Notice
          </Button>
        )}
      </div>

      {/* Primary Navigation Tabs (Feed vs Publisher Management) */}
      <div className="flex overflow-x-auto gap-2 pb-1 border-b">
        <Button
          variant={activeTab === 'feed' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('feed')}
          className="gap-2 shrink-0 font-medium text-xs"
        >
          <Bell className="size-3.5" />
          Announcements Feed
          {totalCount > 0 && (
            <span className="ml-1 text-[11px] opacity-80">({totalCount})</span>
          )}
        </Button>

        {isPublisher && (
          <Button
            variant={activeTab === 'management' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('management')}
            className="gap-2 shrink-0 font-medium text-xs"
          >
            <BarChart3 className="size-3.5" />
            Manage Notices & Readership
          </Button>
        )}
      </div>

      {/* CRITICAL / URGENT ALERTS BANNER */}
      {activeTab === 'feed' && criticalAlerts.length > 0 && (
        <div className="space-y-2">
          {criticalAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => {
                const fullNotice = notices.find((n) => n.id === alert.id);
                if (fullNotice) handleOpenNotice(fullNotice);
              }}
              className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:bg-red-500/15 transition shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-red-600 text-white rounded-lg shrink-0 animate-pulse">
                  <ShieldAlert className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600">
                      URGENT CAMPUS ALERT
                    </span>
                    {!alert.isRead && (
                      <span className="size-2 bg-blue-600 rounded-full" title="Unread notice" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground truncate">
                    {alert.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {alert.requiresAcknowledgement && !alert.isAcknowledged && (
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px]">
                    Acknowledgement Required
                  </Badge>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs bg-background">
                  Read Notice
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: RECIPIENT ANNOUNCEMENTS FEED                       */}
      {/* ======================================================== */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {/* Search & Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-3 rounded-xl border shadow-2xs">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search official announcements by title or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9 bg-background"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {/* Priority filter */}
              <select
                value={selectedPriority}
                onChange={(e) => {
                  setSelectedPriority(e.target.value);
                  setPage(1);
                }}
                className="text-xs h-9 rounded-md border border-input bg-background px-2.5 font-medium"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical / Urgent</option>
                <option value="HIGH">High Priority</option>
                <option value="NORMAL">Standard</option>
                <option value="LOW">Routine</option>
              </select>

              {/* Unread toggle */}
              <Button
                variant={unreadOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setUnreadOnly(!unreadOnly);
                  setPage(1);
                }}
                className="h-9 text-xs"
              >
                Unread Only
              </Button>

              {/* Attachments toggle */}
              <Button
                variant={hasAttachment ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setHasAttachment(!hasAttachment);
                  setPage(1);
                }}
                className="h-9 text-xs gap-1"
              >
                <FileText className="size-3" />
                With PDF
              </Button>
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

          {/* Notices Feed List */}
          {loadingFeed ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : notices.length === 0 ? (
            <div className="text-center py-16 bg-card border rounded-2xl p-6">
              <Bell className="size-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold text-foreground text-base">No announcements found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                There are currently no active official notices matching your search and audience filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => {
                const isUrgent = ['CRITICAL', 'URGENT'].includes(notice.priority.toUpperCase());

                return (
                  <Card
                    key={notice.id}
                    onClick={() => handleOpenNotice(notice)}
                    className={`p-4 sm:p-5 transition hover:shadow-md cursor-pointer border relative overflow-hidden group ${
                      !notice.isRead ? 'border-l-4 border-l-primary bg-primary/2' : ''
                    } ${isUrgent ? 'border-red-500/30' : ''}`}
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Meta Tags */}
                        <div className="flex flex-wrap items-center gap-2">
                          {!notice.isRead && (
                            <span className="size-2 bg-primary rounded-full animate-pulse" title="Unread" />
                          )}
                          {getPriorityBadge(notice.priority)}
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                            {notice.category}
                          </Badge>
                          {notice.isPinned && (
                            <Badge className="bg-primary/10 text-primary text-[10px] gap-1">
                              <Pin className="size-2.5" />
                              Pinned
                            </Badge>
                          )}
                          {notice.targetScope !== 'ALL' && (
                            <Badge variant="secondary" className="text-[10px]">
                              {notice.targetScope}
                            </Badge>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition leading-snug">
                          {notice.title}
                        </h3>

                        {/* Content Preview */}
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {notice.aiSummary || notice.content}
                        </p>

                        {/* Author & Date Footer */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                          <span className="font-medium text-foreground">
                            {notice.author.name}
                            {notice.author.department ? ` (${notice.author.department})` : ''}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(notice.publishAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {notice.expiresAt && (
                            <>
                              <span>•</span>
                              <span className="text-amber-700 flex items-center gap-1">
                                <Clock className="size-3" />
                                Valid until {new Date(notice.expiresAt).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Action Chips */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                        {notice.attachments && notice.attachments.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-md">
                            <FileText className="size-3" />
                            <span>PDF Document ({notice.attachments.length})</span>
                          </div>
                        )}

                        {notice.requiresAcknowledgement && (
                          notice.isAcknowledged ? (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                              <Check className="size-3" />
                              Acknowledged
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                              <AlertTriangle className="size-3" />
                              Must Acknowledge
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Feed Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PUBLISHER NOTICE MANAGEMENT & READERSHIP           */}
      {/* ======================================================== */}
      {activeTab === 'management' && isPublisher && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Notice Management & Publishing Control
              </h2>
              <p className="text-xs text-muted-foreground">
                Track reader reach, formal acknowledgements, draft announcements, and publication schedules.
              </p>
            </div>

            <Button onClick={() => setCreateModalOpen(true)} size="sm" className="gap-1.5 shadow-xs">
              <Plus className="size-3.5" />
              New Announcement
            </Button>
          </div>

          {/* Status Sub-Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { label: 'All Notices', value: 'ALL' },
              { label: 'Published & Active', value: 'PUBLISHED' },
              { label: 'Scheduled', value: 'SCHEDULED' },
              { label: 'Drafts', value: 'DRAFT' },
              { label: 'Withdrawn', value: 'WITHDRAWN' },
              { label: 'Expired / Archived', value: 'EXPIRED' },
            ].map((st) => (
              <button
                key={st.value}
                onClick={() => {
                  setManagementStatusFilter(st.value);
                  setManagementPage(1);
                }}
                className={`text-xs px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-all border ${
                  managementStatusFilter === st.value
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-muted-foreground border-border/80 hover:bg-muted'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Management List */}
          {loadingManagement ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : managedNotices.length === 0 ? (
            <div className="text-center py-16 bg-card border rounded-2xl p-6">
              <FileText className="size-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-semibold text-foreground text-sm">No notices in this filter</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can draft announcements in advance or schedule them for automatic publication.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {managedNotices.map((item) => (
                <Card key={item.id} className="p-4 bg-card border shadow-2xs hover:shadow-sm transition">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            item.status === 'PUBLISHED'
                              ? 'default'
                              : item.status === 'SCHEDULED'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-[10px] font-bold uppercase"
                        >
                          {item.status}
                        </Badge>
                        {getPriorityBadge(item.priority)}
                        <Badge variant="outline" className="text-[10px]">
                          {item.category}
                        </Badge>
                        {item.targetScope !== 'ALL' && (
                          <Badge variant="secondary" className="text-[10px]">
                            {item.targetScope}
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-foreground truncate">
                        {item.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>Created {new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>
                          {item.status === 'SCHEDULED' ? 'Scheduled for: ' : 'Published: '}
                          {new Date(item.publishAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {item.expiresAt && (
                          <>
                            <span>•</span>
                            <span>Expires: {new Date(item.expiresAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAnalyticsNoticeId(item.id);
                          setAnalyticsModalOpen(true);
                        }}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Eye className="size-3.5 text-blue-600" />
                        <span>{item.readCount || 0} Reads</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedNotice(item);
                          setDetailModalOpen(true);
                        }}
                        className="h-8 text-xs"
                      >
                        Preview
                      </Button>

                      {item.status === 'PUBLISHED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleWithdrawNotice(item.id)}
                          className="h-8 text-xs text-amber-700 hover:bg-amber-50"
                        >
                          Withdraw
                        </Button>
                      )}

                      {['PUBLISHED', 'EXPIRED'].includes(item.status) && !item.isArchived && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchiveNotice(item.id)}
                          className="h-8 text-xs text-muted-foreground"
                          title="Archive notice"
                        >
                          <Archive className="size-3.5" />
                        </Button>
                      )}

                      {['DRAFT', 'WITHDRAWN'].includes(item.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteNotice(item.id)}
                          className="h-8 text-xs text-red-600 hover:bg-red-50"
                          title="Delete notice"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Management Pagination */}
          {managementTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
              <span>Page {managementPage} of {managementTotalPages}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={managementPage <= 1}
                  onClick={() => setManagementPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={managementPage >= managementTotalPages}
                  onClick={() => setManagementPage((p) => Math.min(managementTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <NoticeDetailModal
        notice={selectedNotice}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onNoticeUpdated={() => {
          loadFeed();
          loadManagedNotices();
        }}
      />

      <CreateNoticeModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          loadFeed();
          loadManagedNotices();
        }}
        userRole={userRole}
      />

      <NoticeAnalyticsModal
        noticeId={analyticsNoticeId}
        isOpen={analyticsModalOpen}
        onClose={() => setAnalyticsModalOpen(false)}
      />
    </div>
  );
};

export default NoticeBoardPage;
