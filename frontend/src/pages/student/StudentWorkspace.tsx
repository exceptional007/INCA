import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const message = (error: any) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong. Please try again.";
const selectClass =
  "w-full min-w-0 rounded-xl border bg-background p-3 text-sm";
function useStudentData(path: string, params?: Record<string, any>) {
  const { user } = useAuth();
  return useQuery<any>({
    queryKey: ["student-portal", user?.id, path, params],
    queryFn: async () =>
      (await api.get(`/student-portal/${path}`, { params })).data,
    staleTime: 15_000,
  });
}
function Feedback({ query }: { query: any }) {
  return query.isPending ? (
    <p role="status" className="p-5 text-muted-foreground">
      Loading your records…
    </p>
  ) : query.isError ? (
    <div role="alert" className="rounded-xl border border-destructive/30 p-4">
      <p>{message(query.error)}</p>
      <Button variant="outline" onClick={() => query.refetch()}>
        Try again
      </Button>
    </div>
  ) : null;
}
function Identity({ data }: { data: any }) {
  return data ? (
    <p className="text-sm text-muted-foreground break-words">
      {data.name} · {data.rollNumber}
      {data.section
        ? ` · ${data.section.program}, semester ${data.section.semester}, ${data.section.name}`
        : ""}
    </p>
  ) : null;
}
export function LectureRows({
  items,
  onObject,
}: {
  items: any[];
  onObject: (item: any) => void;
}) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article
          key={item.recordId || item.scheduleId}
          className="rounded-2xl border bg-card p-4 sm:p-5 min-w-0"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {item.date} · {item.startTime}–{item.endTime}
              </p>
              <h3 className="font-semibold break-words">
                {item.subject?.name}
              </h3>
              <p className="text-sm text-muted-foreground break-words">
                {item.subject?.code} · {item.faculty}{" "}
                {item.room && `· ${item.room}`}
              </p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
              {(item.lectureStatus === "CANCELLED"
                ? "CANCELLED"
                : item.attendanceStatus
              ).replaceAll("_", " ")}
            </span>
          </div>
          {item.objection && (
            <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">
              <p>Objection: {item.objection.status.toLowerCase()}</p>
              {item.objection.reviewRemark && (
                <p className="mt-1 break-words">
                  Reviewer remark: {item.objection.reviewRemark}
                </p>
              )}
            </div>
          )}
          {item.canObject && (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => onObject(item)}
            >
              Raise an objection
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}
function ObjectionDialog({
  lecture,
  close,
}: {
  lecture: any;
  close: () => void;
}) {
  const [reason, setReason] = useState("");
  const [requestedStatus, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/student-portal/objections", {
        sessionId: lecture.sessionId,
        reason: reason.trim(),
        ...(requestedStatus ? { requestedStatus } : {}),
      });
      await client.invalidateQueries({ queryKey: ["student-portal"] });
      toast.success("Objection sent to Admin/HOD for review.");
      close();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raise an attendance objection</DialogTitle>
          <DialogDescription>
            {lecture.subject?.name} · {lecture.date}. Your Admin or department
            HOD will review your request.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">
            Requested correction
            <select
              className={`${selectClass} mt-2`}
              value={requestedStatus}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Review only — no status change requested</option>
              {["PRESENT", "ABSENT", "LATE", "EXCUSED"].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Reason (required)
            <textarea
              required
              minLength={3}
              maxLength={2000}
              rows={4}
              className={`${selectClass} mt-2 resize-y`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what happened during this lecture…"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </Button>
            <Button disabled={busy || reason.trim().length < 3}>
              {busy ? "Sending…" : "Send objection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function ObjectionHistory() {
  const query = useStudentData("objections");
  return (
    <details className="rounded-2xl border p-4">
      <summary className="cursor-pointer font-semibold">
        My objection history
      </summary>
      <div className="mt-4 space-y-3">
        <Feedback query={query} />
        {query.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You have not submitted any objections.
          </p>
        )}
        {query.data?.map((item: any) => (
          <div key={item.id} className="rounded-xl bg-muted/50 p-3 text-sm">
            <p className="font-medium">
              {item.attendanceSession?.schedule?.template?.subject?.name} ·{" "}
              {item.attendanceSession?.attendanceDate?.slice(0, 10)} ·{" "}
              {item.status}
            </p>
            <p className="mt-1 break-words">{item.reason}</p>
            {item.reviewRemark && (
              <p className="mt-2 break-words">
                Reviewer remark: {item.reviewRemark}
              </p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
export function StudentTimetablePage() {
  const [date, setDate] = useState(today);
  const [weekday, setWeekday] = useState("Monday");
  const [lecture, setLecture] = useState<any>(null);
  const context = useStudentData("context"),
    timetable = useStudentData("timetable", { date });
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">My timetable & attendance</h1>
        <Identity data={context.data} />
        <p className="mt-2 text-sm text-muted-foreground">
          View your lectures and each day’s submitted attendance. Raise an
          objection from a lecture if something needs review.
        </p>
      </header>
      <Feedback query={context} />
      <Feedback query={timetable} />
      {timetable.data && (
        <>
          {!timetable.data.sectionAssigned && (
            <p
              role="status"
              className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"
            >
              Your section has not been assigned. Contact an Admin to link your
              timetable. Any existing attendance history remains available in My
              attendance.
            </p>
          )}
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Daily lectures & attendance
              </h2>
              <label className="text-sm">
                Select date
                <Input
                  aria-label="Lecture date"
                  type="date"
                  required
                  value={date}
                  onInput={(event) => {
                    if (event.currentTarget.value) setDate(event.currentTarget.value);
                  }}
                  className="mt-1 w-auto"
                />
              </label>
            </div>
            <LectureRows
              items={timetable.data.lectures}
              onObject={setLecture}
            />
            {!timetable.data.lectures.length && (
              <p className="rounded-xl border p-5 text-sm text-muted-foreground">
                No dated lectures are available for this day. Attendance appears
                after the faculty submits it.
              </p>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Current weekly timetable</h2>
            <p className="text-sm text-muted-foreground">
              Your assigned section’s published weekly plan. Daily changes
              appear above.
            </p>
            <label className="block max-w-xs text-sm">
              Day
              <select
                className={`${selectClass} mt-1`}
                value={weekday}
                onChange={(event) => setWeekday(event.target.value)}
              >
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => (
                  <option key={day}>{day}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {timetable.data.weekly
                .filter(
                  (slot: any) =>
                    slot.day.toLowerCase() === weekday.toLowerCase(),
                )
                .map((slot: any) => (
                  <div key={slot.id} className="rounded-xl border p-4">
                    <p className="text-xs text-muted-foreground">
                      {slot.startTime}–{slot.endTime}
                    </p>
                    <h3 className="font-semibold break-words">
                      {slot.subject.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {slot.faculty} · {slot.room}
                    </p>
                  </div>
                ))}
            </div>
            {!timetable.data.weekly.some(
              (slot: any) => slot.day.toLowerCase() === weekday.toLowerCase(),
            ) && (
              <p className="text-sm text-muted-foreground">
                No published classes for {weekday}.
              </p>
            )}
          </section>
        </>
      )}
      <ObjectionHistory />
      {lecture && (
        <ObjectionDialog
          key={lecture.sessionId}
          lecture={lecture}
          close={() => setLecture(null)}
        />
      )}
    </div>
  );
}
export function StudentAttendancePage() {
  const [mode, setMode] = useState("all"),
    [date, setDate] = useState(today),
    [startDate, setStart] = useState(today),
    [endDate, setEnd] = useState(today),
    [subjectId, setSubject] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [page, setPage] = useState(1),
    [lecture, setLecture] = useState<any>(null);
  const context = useStudentData("context"),
    report = useStudentData("attendance", { ...filters, page });
  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "range" && startDate > endDate) {
      toast.error("Start date must be before the end date.");
      return;
    }
    setPage(1);
    setFilters({
      ...(subjectId ? { subjectId } : {}),
      ...(mode === "date"
        ? { date }
        : mode === "range"
          ? { startDate, endDate }
          : {}),
    });
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">My attendance</h1>
        <Identity data={context.data} />
        <p className="mt-2 text-sm text-muted-foreground">
          Explore your submitted attendance by subject, date, or date range.
        </p>
      </header>
      <Feedback query={context} />
      <form
        onSubmit={apply}
        className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2"
      >
        <label className="text-sm">
          Subject
          <select
            className={`${selectClass} mt-1`}
            value={subjectId}
            onChange={(event) => setSubject(event.target.value)}
          >
            <option value="">All subjects & activities</option>
            {context.data?.subjects.map((subject: any) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} — {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Period
          <select
            className={`${selectClass} mt-1`}
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="all">All time</option>
            <option value="date">Single date</option>
            <option value="range">Date range</option>
          </select>
        </label>
        {mode === "date" && (
          <label className="text-sm">
            Date
            <Input
              type="date"
              required
              value={date}
              onInput={(event) => setDate(event.currentTarget.value)}
            />
          </label>
        )}
        {mode === "range" && (
          <>
            <label className="text-sm">
              From
              <Input
                type="date"
                required
                value={startDate}
                onInput={(event) => setStart(event.currentTarget.value)}
              />
            </label>
            <label className="text-sm">
              To
              <Input
                type="date"
                required
                min={startDate}
                value={endDate}
                onInput={(event) => setEnd(event.currentTarget.value)}
              />
            </label>
          </>
        )}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button>Apply filters</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMode("all");
              setSubject("");
              setFilters({});
              setPage(1);
            }}
          >
            Reset
          </Button>
        </div>
      </form>
      <Feedback query={report} />
      {report.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Total lectures", report.data.summary.total],
              ["Attended", report.data.summary.attended],
              ["Absent", report.data.summary.ABSENT],
              [
                "Attendance",
                report.data.summary.percentage === null
                  ? "—"
                  : `${report.data.summary.percentage}%`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Attended includes Present, Late, and Excused. Only submitted
            attendance is counted.
          </p>
          <LectureRows items={report.data.items} onObject={setLecture} />
          {!report.data.items.length && (
            <p className="rounded-xl border p-5 text-muted-foreground">
              No attendance matches these filters.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Page {page} of {report.data.pagination.totalPages} ·{" "}
              {report.data.pagination.total} records
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= report.data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
      <ObjectionHistory />
      {lecture && (
        <ObjectionDialog
          key={lecture.sessionId}
          lecture={lecture}
          close={() => setLecture(null)}
        />
      )}
    </div>
  );
}
