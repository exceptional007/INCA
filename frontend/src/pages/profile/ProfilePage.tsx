import { useEffect, useState, useRef } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { Link } from "react-router-dom";
import {
  Camera,
  Check,
  Clock,
  ShieldCheck,
  UserRound,
  Pencil,
  ArrowRight,
  Loader2,
  Monitor,
  RefreshCw,
} from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Values = Record<string, string | null>;
interface Profile {
  id: string;
  email: string;
  role: string;
  roleName: string;
  values: Values;
  revision: string;
  editableFields: string[];
  department: { name: string; code: string } | null;
  academic: Values | null;
  joinedAt: string;
}
interface ChangeRequest {
  id: string;
  changes: Values;
  previous: Values;
  photoKey: string | null;
  status: string;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewer?: { email: string } | null;
  profile?: Profile;
}
interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}
const label = (v: string) =>
  v.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const display = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "Not provided"
    : String(v).replace(/_/g, " ");
const stamp = (v: string) => new Date(v).toLocaleString();
function Photo({
  url,
  alt,
  className = "size-24",
}: {
  url?: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    setSrc("");
    if (!url) return;
    const controller = new AbortController();
    let objectUrl = "";
    api
      .get(url, { responseType: "blob", signal: controller.signal })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (!controller.signal.aborted) setSrc(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return src ? (
    <img
      src={src}
      alt={alt}
      onError={() => setSrc('')}
      className={`${className} object-cover rounded-2xl`}
    />
  ) : (
    <div
      className={`${className} rounded-2xl bg-primary/10 text-primary grid place-items-center`}
    >
      <UserRound className="size-10" />
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${value === "APPROVED" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : value === "PENDING" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : value === "REJECTED" ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" : "bg-muted text-muted-foreground"}`}
    >
      {value === "APPROVED" ? (
        <Check className="size-3" />
      ) : (
        <Clock className="size-3" />
      )}
      {value === "PENDING" ? "Awaiting approval" : label(value.toLowerCase())}
    </span>
  );
}
function Diff({ request }: { request: ChangeRequest }) {
  return (
    <dl className="space-y-3">
      {Object.entries(request.changes).map(([key, value]) => (
        <div
          key={key}
          className="grid gap-1 sm:grid-cols-[140px_1fr_1fr] text-sm"
        >
          <dt className="text-muted-foreground">{label(key)}</dt>
          <dd className="text-muted-foreground line-through break-words">
            {display(request.previous[key])}
          </dd>
          <dd className="font-medium break-words">{display(value)}</dd>
        </div>
      ))}
      {request.photoKey && (
        <div className="border-t pt-4 flex items-center gap-4">
          <Photo
            url={`/profile/requests/${request.id}/photo`}
            alt="Proposed profile photo"
            className="size-20"
          />
          <div>
            <p className="font-medium text-sm">New profile photo</p>
            <p className="text-xs text-muted-foreground">
              Visible on your profile after approval.
            </p>
          </div>
        </div>
      )}
    </dl>
  );
}

export default function ProfilePage() {
  const profileCache = useQueryClient();
  const loadId = useRef(0);
  const { user, logout } = useAuth();
  const reviewer = ["HOD", "ADMIN", "SUPER_ADMIN"].includes(
    user?.role.code || "",
  );
  const [profile, setProfile] = useState<Profile | null>(null),
    [requests, setRequests] = useState<ChangeRequest[]>([]),
    [queue, setQueue] = useState<ChangeRequest[]>([]),
    [sessions, setSessions] = useState<Session[]>([]);
  const [tab, setTab] = useState("overview"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Values>({}),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState("");
  const [review, setReview] = useState<ChangeRequest | null>(null),
    [reason, setReason] = useState("");
  const load = async () => {
    const requestId = ++loadId.current;
    setError("");
    try {
      const responses = await Promise.all([
        api.get("/profile"),
        api.get("/profile/requests"),
        api.get("/auth/sessions"),
        ...(reviewer ? [api.get("/profile/review-queue")] : []),
      ]);
      if (requestId !== loadId.current) return;
      setProfile(responses[0].data);
      profileCache.setQueryData(['profile-identity', user?.id], responses[0].data);
      setRequests(responses[1].data);
      setSessions(responses[2].data);
      if (reviewer) setQueue(responses[3].data);
    } catch (e: any) {
      if (requestId !== loadId.current) return;
      setError(
        e.response?.data?.message ||
          "Could not load your profile. Please retry.",
      );
    } finally {
      if (requestId === loadId.current) setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    return () => {
      loadId.current++;
    };
  }, [user?.id, reviewer]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const perform = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
      setSuccess(message);
      await load();
      return true;
    } catch (e: any) {
      const m = e.response?.data?.message;
      setError(
        Array.isArray(m) ? m.join(" ") : m || "Could not save your request.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const changes: Values = {};
    for (const key of profile.editableFields) {
      const value = draft[key]?.trim() || null;
      if (value !== profile.values[key]) changes[key] = value;
    }
    const form = new FormData();
    form.append("changes", JSON.stringify(changes));
    form.append("revision", profile.revision);
    if (file) form.append("photo", file);
    if (
      await perform(
        () =>
          api.post("/profile/requests", form, {
            headers: { "Content-Type": "multipart/form-data" },
          }),
        "Update request submitted. Your current profile stays live until approval.",
      )
    ) {
      setEditing(false);
      setFile(null);
      setTab("requests");
    }
  };
  const decide = async (decision: "approve" | "reject") => {
    if (!review) return;
    if (
      await perform(
        () =>
          api.post(
            `/profile/requests/${review.id}/${decision}`,
            decision === "reject" ? { reason } : {},
          ),
        decision === "approve"
          ? "Profile changes approved and applied."
          : "Request rejected with feedback.",
      )
    )
      setReview(null);
  };
  if (loading)
    return (
      <div className="p-12 flex items-center gap-3">
        <Loader2 className="animate-spin size-5" />
        Loading your campus identity…
      </div>
    );
  if (!profile)
    return (
      <div className="p-8 space-y-4">
        <p role="alert">{error}</p>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    );
  const name =
    profile.values.name ||
    [profile.values.firstName, profile.values.lastName]
      .filter(Boolean)
      .join(" ") ||
    profile.email.split("@")[0];
  const pending = requests.some((r) => r.status === "PENDING");
  const tabs = [
    { id: "overview", label: "Overview" },
    {
      id: "requests",
      label: "My requests",
      count: requests.filter((r) => r.status === "PENDING").length,
    },
    { id: "security", label: "Security" },
    ...(reviewer
      ? [{ id: "review", label: "Approval inbox", count: queue.length }]
      : []),
  ];
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-7 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-[11px] uppercase tracking-[.2em] text-muted-foreground">
            Your campus identity
          </p>
          <h1 className="text-2xl font-semibold mt-1">My profile</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw className="size-3.5 mr-2" />
          Refresh
        </Button>
      </div>
      <section className="rounded-3xl border overflow-hidden bg-card shadow-sm">
        <div className="h-28 sm:h-36 bg-gradient-to-br from-slate-950 via-indigo-950 to-teal-900 relative">
          <div className="absolute right-8 top-8 size-32 rounded-full border border-white/10" />
          <div className="absolute right-24 -top-10 size-40 rounded-full border border-white/10" />
          <p className="absolute bottom-5 right-6 text-white/60 text-[10px] uppercase tracking-[.3em]">
            INCA / Connected campus
          </p>
        </div>
        <div className="px-5 sm:px-8 pb-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="-mt-10 relative bg-card rounded-[22px] p-1.5">
              <Photo
                key={profile.revision}
                url={
                  profile.values.photoKey
                    ? `/profile/photo?v=${profile.revision}`
                    : undefined
                }
                alt={name}
                className="size-24 sm:size-28"
              />
            </div>
            <Button
              onClick={() => {
                setDraft({ ...profile.values });
                setFile(null);
                setEditing(true);
                setError("");
              }}
              disabled={pending}
            >
              <Pencil className="size-3.5 mr-2" />
              {pending ? "Update awaiting approval" : "Request an update"}
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-6 justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                {name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {profile.email}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs bg-primary/10 text-primary rounded-full px-3 py-1">
                  {profile.roleName || display(profile.role)}
                </span>
                {profile.department && (
                  <span className="text-xs bg-muted rounded-full px-3 py-1">
                    {profile.department.name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground self-end">
              <ShieldCheck className="size-4 text-emerald-600" />
              Managed campus profile
            </div>
          </div>
        </div>
      </section>
      <nav
        aria-label="Profile sections"
        className="flex gap-1 border-b overflow-x-auto"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
            {!!t.count && (
              <span className="ml-2 bg-primary/10 px-1.5 rounded text-xs">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>
      {error && !editing && !review && (
        <p
          role="alert"
          className="border border-destructive/20 bg-destructive/5 p-4 rounded-xl text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-xl bg-emerald-500/10 p-4 text-sm">
          {success}
        </p>
      )}
      {tab === "overview" && (
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          <section className="border bg-card rounded-2xl p-6">
            <h3 className="font-semibold mb-6">Personal information</h3>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
              {Object.entries(profile.values)
                .filter(([key]) => key !== "photoKey")
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-muted-foreground mb-1">
                      {label(key)}
                    </dt>
                    <dd className="text-sm font-medium whitespace-pre-wrap break-words">
                      {display(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
          <aside className="space-y-5">
            <section className="border bg-card rounded-2xl p-6">
              <h3 className="font-semibold mb-5">Campus record</h3>
              <dl className="space-y-4">
                {Object.entries(profile.academic || {}).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-muted-foreground">
                      {label(key)}
                    </dt>
                    <dd className="text-sm font-medium mt-1">
                      {display(value)}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Member since
                  </dt>
                  <dd className="text-sm mt-1">
                    {new Date(profile.joinedAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="rounded-2xl bg-primary/5 border border-primary/10 p-6">
              <ShieldCheck className="size-5 text-primary mb-3" />
              <h3 className="font-semibold text-sm">Updates with approval</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Your HOD or administrator reviews personal details and photos
                before they become visible. Academic identifiers, email, and
                account roles are managed by administration.
              </p>
            </section>
          </aside>
        </div>
      )}
      {tab === "requests" && (
        <div className="space-y-4">
          {!requests.length && (
            <Empty
              title="No update requests yet"
              text="Your profile updates and review decisions will appear here."
            />
          )}
          {requests.map((r) => (
            <article
              key={r.id}
              className="border rounded-2xl bg-card p-5 sm:p-6 space-y-5"
            >
              <div className="flex justify-between gap-3 items-start">
                <div>
                  <Status value={r.status} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted {stamp(r.createdAt)}
                  </p>
                </div>
                {r.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void perform(
                        () => api.post(`/profile/requests/${r.id}/cancel`),
                        "Request cancelled.",
                      )
                    }
                  >
                    Cancel request
                  </Button>
                )}
              </div>
              <Diff request={r} />
              {r.reason && (
                <p className="text-sm rounded-lg bg-rose-500/5 p-3">
                  <span className="font-medium">Reviewer feedback: </span>
                  {r.reason}
                </p>
              )}
              {r.reviewedAt && (
                <p className="text-xs text-muted-foreground">
                  Reviewed {stamp(r.reviewedAt)}
                  {r.reviewer ? " · " + r.reviewer.email : ""}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === "review" && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Profile approval inbox</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Review proposed changes before updating the campus record.
            </p>
          </div>
          {!queue.length && (
            <Empty
              title="All caught up"
              text="No profile requests currently need your approval."
            />
          )}
          {queue.map((r) => (
            <article
              key={r.id}
              className="border rounded-2xl bg-card p-5 flex flex-wrap gap-4 items-center justify-between"
            >
              <div>
                <p className="font-semibold">
                  {r.profile?.values.name ||
                    [r.profile?.values.firstName, r.profile?.values.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                    r.profile?.email}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {r.profile?.email} · {r.profile?.role} · {stamp(r.createdAt)}
                </p>
                <p className="text-sm mt-3">
                  {Object.keys(r.changes).map(label).join(", ")}
                  {r.photoKey ? " · Profile photo" : ""}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setReview(r);
                  setReason("");
                  setError("");
                }}
              >
                Review changes
                <ArrowRight className="size-3.5 ml-2" />
              </Button>
            </article>
          ))}
        </div>
      )}
      {tab === "security" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border bg-card p-6 space-y-4">
            <ShieldCheck className="size-6 text-primary" />
            <h3 className="font-semibold">Password & access</h3>
            <p className="text-sm text-muted-foreground">
              Changing your password signs out every session. Keep your initial
              and recovery credentials private.
            </p>
            <Button variant="outline" asChild>
              <Link to="/change-password">Change password</Link>
            </Button>
            <div className="border-t pt-4">
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await api.post("/auth/logout-all");
                    logout();
                  }, "All sessions revoked.")
                }
              >
                Sign out all devices
              </Button>
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold mb-1">Active sessions</h3>
            <p className="text-xs text-muted-foreground mb-5">
              Sessions expire after seven days without renewal.
            </p>
            <div className="space-y-4">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex gap-3 items-center border-t pt-4"
                >
                  <Monitor className="size-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {s.current ? "This session" : "Campus portal session"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started {stamp(s.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        await api.delete(`/auth/sessions/${s.id}`);
                        if (s.current) logout();
                      }, "Session revoked.")
                    }
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!busy) setEditing(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a profile update</DialogTitle>
            <DialogDescription>
              Propose your changes below. Your current details and photo stay
              visible until approval.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              {profile.editableFields.map((key) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={"profile-" + key}>{label(key)}</Label>
                  {["gender", "bloodGroup"].includes(key) ? (
                    <select
                      id={"profile-" + key}
                      className="h-10 w-full border rounded-md bg-background px-3 text-sm"
                      value={draft[key] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    >
                      <option value="">Select…</option>
                      {(key === "gender"
                        ? ["MALE", "FEMALE", "OTHER"]
                        : [
                            "A_POSITIVE",
                            "A_NEGATIVE",
                            "B_POSITIVE",
                            "B_NEGATIVE",
                            "AB_POSITIVE",
                            "AB_NEGATIVE",
                            "O_POSITIVE",
                            "O_NEGATIVE",
                          ]
                      ).map((v) => (
                        <option key={v} value={v}>
                          {display(v)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={"profile-" + key}
                      type={key === "dateOfBirth" ? "date" : "text"}
                      maxLength={key === "address" ? 1000 : 120}
                      required={["name", "firstName"].includes(key)}
                      value={draft[key] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-dashed p-4 flex flex-wrap gap-4 items-center">
              {preview ? (
                <img
                  alt="Selected new photo preview"
                  src={preview}
                  className="size-20 rounded-xl object-cover"
                />
              ) : (
                <Camera className="size-8 text-muted-foreground" />
              )}
              <div className="flex-1 space-y-2">
                <Label htmlFor="profile-photo">New profile photo</Label>
                <Input
                  id="profile-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f && f.size > 5 * 1024 * 1024) {
                      setError("Choose an image under 5 MB.");
                      e.target.value = "";
                      return;
                    }
                    setFile(f);
                    setError("");
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPEG, or WebP. Maximum 5 MB. Reviewed before publication.
                </p>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin mr-2" />}Submit
                for approval
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !busy) setReview(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review profile changes</DialogTitle>
            <DialogDescription>
              {review?.profile?.email} · Check the previous and proposed values
              before deciding.
            </DialogDescription>
          </DialogHeader>
          {review && <Diff request={review} />}
          <div className="space-y-2">
            <Label htmlFor="profile-rejection">
              Feedback (required to reject)
            </Label>
            <textarea
              id="profile-rejection"
              className="border rounded-lg w-full min-h-24 p-3 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || reason.trim().length < 3}
              onClick={() => void decide("reject")}
            >
              Reject
            </Button>
            <Button disabled={busy} onClick={() => void decide("approve")}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}Approve
              & apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-dashed rounded-2xl p-12 text-center">
      <Check className="size-7 mx-auto text-muted-foreground mb-3" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2">{text}</p>
    </div>
  );
}
