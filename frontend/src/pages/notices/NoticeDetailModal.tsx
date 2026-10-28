import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Notice } from '@/types/notice';
import { noticeApi } from '@/services/notice';
import {
  FileText,
  Download,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Building,
  User,
  Check,
  Loader2,
} from 'lucide-react';

interface NoticeDetailModalProps {
  notice: Notice | null;
  isOpen: boolean;
  onClose: () => void;
  onNoticeUpdated?: () => void;
}

export const NoticeDetailModal: React.FC<NoticeDetailModalProps> = ({
  notice,
  isOpen,
  onClose,
  onNoticeUpdated,
}) => {
  const [acknowledging, setAcknowledging] = useState(false);
  const [isAcked, setIsAcked] = useState(notice?.isAcknowledged || false);
  const [ackedAt, setAckedAt] = useState<string | null>(notice?.acknowledgedAt || null);

  if (!notice) return null;

  const handleAcknowledge = async () => {
    try {
      setAcknowledging(true);
      const res = await noticeApi.acknowledgeNotice(notice.id);
      setIsAcked(true);
      setAckedAt(res.acknowledgedAt);
      onNoticeUpdated?.();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to acknowledge notice');
    } finally {
      setAcknowledging(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = priority.toUpperCase();
    if (p === 'CRITICAL' || p === 'URGENT') {
      return (
        <Badge variant="destructive" className="gap-1 font-bold text-xs uppercase shadow-xs">
          <ShieldAlert className="size-3.5" />
          Critical Notice
        </Badge>
      );
    }
    if (p === 'HIGH') {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 font-semibold text-xs shadow-2xs">
          <AlertTriangle className="size-3.5" />
          High Priority
        </Badge>
      );
    }
    if (p === 'LOW') {
      return (
        <Badge variant="secondary" className="text-xs text-muted-foreground">
          Routine
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs font-medium">
        Standard
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header Header */}
        <div className="p-6 border-b bg-muted/20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {getPriorityBadge(notice.priority)}
              <Badge variant="outline" className="font-semibold text-xs uppercase tracking-wide">
                {notice.category}
              </Badge>
              {notice.isPinned && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                  Pinned
                </Badge>
              )}
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                {new Date(notice.publishAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {notice.expiresAt && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-700">
                    <Clock className="size-3.5" />
                    Expires {new Date(notice.expiresAt).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
            {notice.title}
          </DialogTitle>

          {/* Publisher Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <User className="size-3.5 text-primary" />
              <span>{notice.author.name}</span>
              {notice.author.designation && (
                <span className="text-muted-foreground font-normal">
                  ({notice.author.designation})
                </span>
              )}
            </div>

            {notice.author.department && (
              <div className="flex items-center gap-1.5">
                <Building className="size-3.5" />
                <span>{notice.author.department}</span>
              </div>
            )}

            {notice.targetScope !== 'ALL' && (
              <div className="flex items-center gap-1.5 text-primary/80">
                <span>Audience: <strong>{notice.targetScope}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* AI Summary Highlight if available */}
          {notice.aiSummary && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <span>Summary Highlights</span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {notice.aiSummary}
              </p>
            </div>
          )}

          {/* Main Notice Body */}
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap leading-relaxed font-sans text-[14.5px]">
            {notice.content}
          </div>

          {/* Formal Acknowledgement Banner */}
          {notice.requiresAcknowledgement && (
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isAcked
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  {isAcked ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 text-amber-600" />
                  )}
                  <span>
                    {isAcked
                      ? 'Notice Formally Acknowledged'
                      : 'Formal Recipient Acknowledgement Required'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">
                  {isAcked
                    ? `You recorded your formal acknowledgement on ${new Date(
                        ackedAt || notice.acknowledgedAt || Date.now(),
                      ).toLocaleString()}.`
                    : 'The publisher requires all intended recipients to confirm they have read and understood this official announcement.'}
                </p>
              </div>

              {!isAcked && (
                <Button
                  size="sm"
                  onClick={handleAcknowledge}
                  disabled={acknowledging}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shrink-0 shadow-xs"
                >
                  {acknowledging ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Confirm & Acknowledge
                </Button>
              )}
            </div>
          )}

          {/* Attachments Section */}
          {notice.attachments && notice.attachments.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3.5" />
                <span>Supporting Official Documents ({notice.attachments.length})</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {notice.attachments.map((att) => {
                  const streamUrl =
                    att.streamUrl ||
                    noticeApi.getAttachmentStreamUrl(notice.id, att.id);

                  return (
                    <div
                      key={att.id}
                      className="p-3 bg-card border rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-primary/40 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 bg-red-500/10 text-red-600 rounded-lg shrink-0">
                          <FileText className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate" title={att.fileName}>
                            {att.fileName}
                          </p>
                          <span className="text-[11px] text-muted-foreground">
                            {formatFileSize(att.fileSize)} • Official PDF
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs gap-1"
                          onClick={() => window.open(streamUrl, '_blank')}
                          title="Preview in new tab"
                        >
                          <ExternalLink className="size-3.5" />
                          <span className="hidden sm:inline">Preview</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          asChild
                          title="Download document"
                        >
                          <a href={streamUrl} download={att.fileName}>
                            <Download className="size-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/20 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Announcement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
