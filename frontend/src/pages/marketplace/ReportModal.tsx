import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { ReportReason } from '@/types/marketplace';
import { marketplaceApi } from '@/services/marketplace';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ReportModalProps {
  targetId: string | null;
  targetType: 'listing' | 'user' | 'transaction';
  isOpen: boolean;
  onClose: () => void;
  onReported?: () => void;
}

const REASONS: { label: string; value: ReportReason }[] = [
  { label: 'Suspected Scam or Fraudulent Activity', value: 'SUSPECTED_SCAM' },
  { label: 'Misleading Description or Counterfeit Item', value: 'MISLEADING_DESCRIPTION' },
  { label: 'Prohibited or Hazardous Campus Item', value: 'PROHIBITED_ITEM' },
  { label: 'Harassment, Abuse, or Offensive Behavior', value: 'HARASSMENT' },
  { label: 'Suspicious Off-Campus or Delivery Request', value: 'SUSPICIOUS_TRANSACTION' },
  { label: 'Inappropriate or Explicit Images/Text', value: 'INAPPROPRIATE_CONTENT' },
  { label: 'Other Concern', value: 'OTHER' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  targetId,
  targetType,
  isOpen,
  onClose,
  onReported,
}) => {
  const [reason, setReason] = useState<ReportReason>('MISLEADING_DESCRIPTION');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId || !description.trim()) {
      setError('Please provide a brief explanation of the issue');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: any = {
        reason,
        description: description.trim(),
      };
      if (targetType === 'listing') payload.listingId = targetId;
      else if (targetType === 'user') payload.reportedUserId = targetId;
      else if (targetType === 'transaction') payload.transactionId = targetId;

      await marketplaceApi.createReport(payload);
      setDescription('');
      onReported?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" />
            <span>Report to Campus Moderation</span>
          </DialogTitle>
          <DialogDescription>
            Reports are forwarded to Department HODs and campus administrators for safety and compliance review.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Violation Reason *
            </Label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:ring-1 focus:ring-primary"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="desc" className="text-xs font-semibold uppercase text-muted-foreground">
              Explanation & Evidence *
            </Label>
            <textarea
              id="desc"
              rows={4}
              placeholder="Describe what occurred, any specific discrepancy or policy violation..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full mt-1.5 rounded-md border border-input bg-background p-2.5 text-sm shadow-xs focus:ring-1 focus:ring-primary"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={loading || !description.trim()}
              className="gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Submit Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
