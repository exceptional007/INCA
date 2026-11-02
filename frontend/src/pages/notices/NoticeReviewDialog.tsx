import { useState } from "react";
import type { Notice } from "@/types/notice";
import { noticeApi } from "@/services/notice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const NoticeReviewDialog = ({
  notice,
  action,
  onClose,
  onReviewed,
}: {
  notice: Notice;
  action: "approve" | "reject";
  onClose: () => void;
  onReviewed: () => void;
}) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!notice.updatedAt) {
      setError("Reload the review queue before reviewing this notice.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (action === "approve")
        await noticeApi.approveNotice(notice.id, notice.updatedAt);
      else
        await noticeApi.rejectNotice(
          notice.id,
          notice.updatedAt,
          reason.trim(),
        );
      onReviewed();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Could not save the review. Please retry.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {action === "approve" ? "Approve notice" : "Reject notice"}
          </DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? "Approval publishes this revision now or schedules it for the selected time."
              : "Explain what the publisher must correct before resubmitting."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <h3 className="font-semibold">{notice.title}</h3>
          <p className="text-xs text-muted-foreground">
            Audience: {notice.targetScope} · Publication:{" "}
            {new Date(notice.publishAt).toLocaleString()}
          </p>
          <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm border rounded-lg p-3">
            {notice.content}
          </p>
          {!!notice.attachments?.length && (
            <p className="text-xs">
              Attachments:{" "}
              {notice.attachments.map((a) => a.fileName).join(", ")}. Use
              Preview in the review queue to inspect documents before approving.
            </p>
          )}
          {action === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="notice-rejection-reason">Rejection reason</Label>
              <textarea
                id="notice-rejection-reason"
                className="w-full min-h-24 border rounded-lg p-3 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={action === "reject" ? "destructive" : "default"}
            onClick={submit}
            disabled={
              saving || (action === "reject" && reason.trim().length < 3)
            }
          >
            {saving
              ? "Saving…"
              : action === "approve"
                ? "Confirm approval"
                : "Confirm rejection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
