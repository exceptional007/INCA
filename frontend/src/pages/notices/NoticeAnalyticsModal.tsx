import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { NoticeAnalytics } from '@/types/notice';
import { noticeApi } from '@/services/notice';
import {
  Eye,
  CheckCircle2,
  Users,
  Search,
  Loader2,
  Check,
  FileBarChart,
} from 'lucide-react';

interface NoticeAnalyticsModalProps {
  noticeId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NoticeAnalyticsModal: React.FC<NoticeAnalyticsModalProps> = ({
  noticeId,
  isOpen,
  onClose,
}) => {
  const [analytics, setAnalytics] = useState<NoticeAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (isOpen && noticeId) {
      loadData(noticeId);
    } else {
      setAnalytics(null);
      setError(null);
      setSearchFilter('');
    }
  }, [isOpen, noticeId]);

  const loadData = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await noticeApi.getNoticeAnalytics(id);
      setAnalytics(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load read analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredReaders = (analytics?.recentReaders || []).filter((r) => {
    const q = searchFilter.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.rollNumber && r.rollNumber.toLowerCase().includes(q)) ||
      (r.department && r.department.toLowerCase().includes(q))
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {analytics?.status || 'STATUS'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {analytics?.priority || 'NORMAL'}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FileBarChart className="size-3.5 text-primary" />
              Audience Read Statistics
            </span>
          </div>

          <DialogTitle className="text-lg font-bold tracking-tight text-foreground mt-2">
            {analytics?.title || 'Announcement Read Analytics'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Persisted audience delivery, reads, and formal acknowledgement records.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-sm">{error}</div>
        ) : analytics ? (
          <div className="p-6 space-y-6">
            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-card border rounded-xl shadow-2xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  Target Audience
                </span>
                <div className="text-2xl font-black text-foreground">
                  {analytics.totalIntendedRecipients.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground">Estimated eligible members</p>
              </div>

              <div className="p-4 bg-card border rounded-xl shadow-2xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="size-3.5 text-blue-600" />
                  Read Receipts
                </span>
                <div className="text-2xl font-black text-foreground flex items-baseline gap-1.5">
                  <span>{analytics.readCount}</span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    ({analytics.readPercentage}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mt-1">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${analytics.readPercentage}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-card border rounded-xl shadow-2xs space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  Acknowledgements
                </span>
                <div className="text-2xl font-black text-foreground flex items-baseline gap-1.5">
                  <span>{analytics.acknowledgementCount}</span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    ({analytics.acknowledgementPercentage}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mt-1">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${analytics.acknowledgementPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Read Log Table */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Recipient Read Log ({filteredReaders.length})
                </h4>

                <div className="relative w-full sm:w-60">
                  <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search reader name or roll..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-lg"
                  />
                </div>
              </div>

              {filteredReaders.length === 0 ? (
                <div className="text-center py-10 bg-muted/20 border border-dashed rounded-xl p-4 text-xs text-muted-foreground">
                  No recipient read records match your search filter.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden shadow-2xs divide-y max-h-64 overflow-y-auto">
                  {filteredReaders.map((r) => (
                    <div
                      key={r.userId}
                      className="p-3 text-xs flex items-center justify-between gap-3 bg-card hover:bg-muted/30 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                          {r.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.role} {r.rollNumber ? `• ${r.rollNumber}` : ''}{' '}
                            {r.department ? `• ${r.department}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="text-[11px] text-muted-foreground">
                          Read {new Date(r.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {r.acknowledgedAt && (
                          <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 justify-end">
                            <Check className="size-3" />
                            Acknowledged
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="p-4 border-t bg-muted/20 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Analytics
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
