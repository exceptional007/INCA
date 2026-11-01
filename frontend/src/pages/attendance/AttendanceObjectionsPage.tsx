import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/axios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AttendanceObjectionsPage() {
  const { user } = useAuth();
  const query = useQuery<any[]>({
    queryKey: ["attendance-objections", user?.id],
    queryFn: async () => (await api.get("/attendance/objections")).data,
    refetchInterval: 30_000,
  });
  const [selection, setSelection] = useState<any>(null),
    [remark, setRemark] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("PENDING");
  async function decide() {
    setBusy(true);
    try {
      await api.post(`/attendance/objections/${selection.item.id}/review`, {
        decision: selection.decision,
        remark,
      });
      toast.success("Decision saved. The student has been notified.");
      setSelection(null);
      await query.refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not save decision.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">Attendance objections</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user?.role.code === "ADMIN"
            ? "Campus-wide student requests."
            : "Requests from students in your department."}{" "}
          Approving a requested status correction updates attendance and records
          an audit entry.
        </p>
      </header>
      <label className="block max-w-xs text-sm">
        Show
        <select
          className="mt-1 w-full rounded-xl border bg-background p-3"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="PENDING">Pending review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </label>
      {query.isPending && <p role="status">Loading objections…</p>}
      {query.isError && (
        <div role="alert">
          <p>Could not load requests.</p>
          <Button onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {query.data
        ?.filter((item) => item.status === status)
        .map((item) => (
          <article
            key={item.id}
            className="space-y-3 rounded-2xl border p-4 sm:p-5"
          >
            <div>
              <h2 className="font-semibold break-words">
                {item.student.firstName} {item.student.lastName} ·{" "}
                {item.student.rollNumber}
              </h2>
              <p className="text-sm text-muted-foreground break-words">
                {item.student.department?.name ||
                  item.student.section?.semester?.program?.departmentId}{" "}
                · {item.student.user.email}
              </p>
              <p className="mt-2 text-sm">
                {item.attendanceSession.attendanceDate.slice(0, 10)} ·{" "}
                {item.attendanceSession.schedule?.template?.subject?.name}
              </p>
            </div>
            <p className="text-sm">
              Recorded: <strong>{item.originalStatus || "Not recorded"}</strong>{" "}
              · Requested:{" "}
              <strong>{item.requestedStatus || "Review only"}</strong>
            </p>
            <p className="whitespace-pre-wrap break-words rounded-xl bg-muted/50 p-3 text-sm">
              {item.reason}
            </p>
            {item.reviewRemark && (
              <p className="text-sm break-words">Remark: {item.reviewRemark}</p>
            )}
            {item.status === "PENDING" && (
              <div className="flex flex-wrap gap-2">
                {["APPROVED", "REJECTED"].map((decision) => (
                  <Button
                    key={decision}
                    variant={decision === "REJECTED" ? "outline" : "default"}
                    onClick={() => {
                      setRemark("");
                      setSelection({ item, decision });
                    }}
                  >
                    {decision === "APPROVED" ? "Approve" : "Reject"}
                  </Button>
                ))}
              </div>
            )}
          </article>
        ))}
      {query.data && !query.data.some((item) => item.status === status) && (
        <p className="rounded-xl border p-5 text-muted-foreground">
          No {status.toLowerCase()} objections.
        </p>
      )}
      {selection && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setSelection(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selection.decision === "APPROVED"
                  ? "Approve objection"
                  : "Reject objection"}
              </DialogTitle>
              <DialogDescription>
                {selection.decision === "APPROVED" &&
                selection.item.requestedStatus
                  ? `Attendance will change to ${selection.item.requestedStatus}. This correction will be audited.`
                  : "The student will be notified of your decision."}
              </DialogDescription>
            </DialogHeader>
            <label className="text-sm">
              Remark (optional)
              <textarea
                rows={4}
                maxLength={2000}
                className="mt-2 w-full resize-y rounded-xl border bg-background p-3"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setSelection(null)}
              >
                Cancel
              </Button>
              <Button disabled={busy} onClick={decide}>
                {busy ? "Saving…" : "Confirm decision"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
