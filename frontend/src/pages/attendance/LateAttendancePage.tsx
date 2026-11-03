import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

const field = "w-full rounded-xl border bg-background p-3 text-sm";
const errorText = (error: any) => {
  const message =
    error?.response?.data?.message || error?.message || "Please retry.";
  return Array.isArray(message) ? message.join(" ") : message;
};
const stamp = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
export default function LateAttendancePage() {
  const { user } = useAuth();
  const faculty = user?.role.code === "FACULTY";
  const [params] = useSearchParams();
  const [scheduleId, setSchedule] = useState(params.get("scheduleId") || ""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [decision, setDecision] = useState<any>(null),
    [remark, setRemark] = useState(""),
    [filter, setFilter] = useState("PENDING");
  const requests = useQuery<any[]>({
    queryKey: ["late-attendance", user?.id, faculty],
    queryFn: async () => {
      const response = await api.get(
        `/attendance/late-requests/${faculty ? "mine" : "queue"}`,
      );
      const items = faculty ? response.data.items : response.data;
      if (!Array.isArray(items))
        throw new Error("Could not read approval requests.");
      return items;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const schedules = useQuery<any[]>({
    queryKey: ["late-lectures", user?.id],
    enabled: faculty,
    queryFn: async () => (await api.get("/schedules")).data.data || [],
  });
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      await requests.refetch();
      toast.success(message);
      return true;
    } catch (error) {
      toast.error(errorText(error));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const visible =
    requests.data?.filter(
      (item) =>
        filter === "ALL" ||
        (filter === "PENDING"
          ? item.status === "PENDING"
          : item.effectiveStatus === filter),
    ) || [];
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">Late attendance approvals</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {faculty
            ? "Your lecture attendance remains available until 15 minutes after it ends. After that, request permission from your department Admin/HOD."
            : "Review faculty requests in your department. Approval permits one lecture submission within 24 hours and does not reopen a locked session."}
        </p>
      </header>
      {faculty && (
        <form
          className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await run(
                () =>
                  api.post("/attendance/late-requests", {
                    scheduleId,
                    reason: reason.trim(),
                  }),
                "Request sent to your department reviewers.",
              )
            ) {
              setReason("");
              setFilter("PENDING");
            }
          }}
        >
          <h2 className="font-semibold">Request late attendance</h2>
          {schedules.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorText(schedules.error)}
            </p>
          )}
          <label className="block text-sm">
            Lecture
            <select
              required
              className={`${field} mt-2`}
              value={scheduleId}
              onChange={(event) => setSchedule(event.target.value)}
            >
              <option value="">Select your lecture</option>
              {schedules.data?.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.lectureDate?.slice(0, 10)} ·{" "}
                  {schedule.template?.subject?.name} ·{" "}
                  {schedule.template?.startTime}–{schedule.template?.endTime}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Reason (required)
            <textarea
              required
              minLength={3}
              maxLength={2000}
              rows={3}
              className={`${field} mt-2 resize-y`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why attendance could not be submitted in time…"
            />
          </label>
          <Button disabled={busy || !scheduleId || reason.trim().length < 3}>
            {busy ? "Sending…" : "Send approval request"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Approval belongs to you and this exact lecture. If the lecture or
            faculty assignment changes, a new request is required.
          </p>
        </form>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm">
          Show
          <select
            className={`${field} mt-1`}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {[
              ["PENDING", "Pending review"],
              ["APPROVED", "Valid approvals"],
              ["REJECTED", "Rejected"],
              ["USED", "Used"],
              ["EXPIRED", "Expired"],
              ["ALL", "All requests"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={requests.isFetching}
          onClick={() => requests.refetch()}
        >
          Refresh requests
        </Button>
      </div>
      {requests.isPending && <p role="status">Loading approval requests…</p>}
      {requests.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-4"
        >
          {errorText(requests.error)}
        </div>
      )}
      {!requests.isPending && !requests.isError && !visible.length && (
        <p className="rounded-xl border p-6 text-sm text-muted-foreground">
          No requests in this view.
        </p>
      )}
      {visible.map((item) => (
        <article
          key={item.id}
          className="min-w-0 space-y-3 rounded-2xl border bg-card p-4 sm:p-5"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold break-words">
                {item.snapshot.subject} ({item.snapshot.code})
              </h2>
              <p className="text-sm text-muted-foreground">
                {item.snapshot.date} · {item.snapshot.startTime}–
                {item.snapshot.endTime}
              </p>
              <p className="text-xs text-muted-foreground break-words">
                {item.snapshot.program} · Semester {item.snapshot.semester} ·
                Section {item.snapshot.section}
              </p>
              {item.requester && (
                <p className="mt-2 text-sm break-all">
                  Requested by {item.requester.email}
                </p>
              )}
            </div>
            <span className="h-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              {item.effectiveStatus}
            </span>
          </div>
          <p className="rounded-xl bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">
            {item.reason}
          </p>
          {item.reviewRemark && (
            <p className="text-sm break-words">
              Reviewer remark: {item.reviewRemark}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Requested {stamp(item.createdAt)}
            {item.reviewer && ` · Reviewed by ${item.reviewer.email}`}
            {item.expiresAt && ` · Permission expires ${stamp(item.expiresAt)}`}
            {item.usedAt && ` · Used ${stamp(item.usedAt)}`}
          </p>
          {["STALE", "LOCKED"].includes(item.effectiveStatus) && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {item.effectiveStatus === "LOCKED"
                ? "Attendance is already submitted. This request cannot reopen it."
                : "The lecture or faculty assignment changed. Cancel/reject this request and submit a fresh one if needed."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {faculty && item.effectiveStatus === "APPROVED" && (
              <Button asChild>
                <Link
                  to={`/attendance/mark?scheduleId=${encodeURIComponent(item.scheduleId)}`}
                >
                  Mark approved lecture
                </Link>
              </Button>
            )}
            {faculty && item.canCancel && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      api.post(`/attendance/late-requests/${item.id}/cancel`),
                    "Request cancelled.",
                  )
                }
              >
                Cancel request
              </Button>
            )}
            {!faculty && item.status === "PENDING" && (
              <>
                <Button
                  disabled={busy || item.effectiveStatus !== "PENDING"}
                  onClick={() => {
                    setRemark("");
                    setDecision({ item, status: "APPROVED" });
                  }}
                >
                  Approve for 24 hours
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setRemark("");
                    setDecision({ item, status: "REJECTED" });
                  }}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
          {item.events && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Audit history</summary>
              <ul className="mt-2 space-y-1">
                {item.events.map((event: any) => (
                  <li key={event.id}>
                    {stamp(event.createdAt)} · {event.action} ·{" "}
                    {event.actor?.email}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </article>
      ))}
      {decision && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setDecision(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {decision.status === "APPROVED"
                  ? "Approve late attendance"
                  : "Reject request"}
              </DialogTitle>
              <DialogDescription>
                {decision.item.snapshot.subject} · {decision.item.snapshot.date}
                .{" "}
                {decision.status === "APPROVED"
                  ? "The assigned faculty can submit this lecture once within 24 hours."
                  : "The faculty member will see your decision."}
              </DialogDescription>
            </DialogHeader>
            <label className="text-sm">
              Remark (optional)
              <textarea
                rows={3}
                maxLength={2000}
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                className={`${field} mt-2 resize-y`}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => setDecision(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (
                    await run(
                      () =>
                        api.post(
                          `/attendance/late-requests/${decision.item.id}/review`,
                          { decision: decision.status, remark },
                        ),
                      "Decision saved and faculty notified.",
                    )
                  )
                    setDecision(null);
                }}
              >
                {busy ? "Saving…" : "Confirm decision"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
