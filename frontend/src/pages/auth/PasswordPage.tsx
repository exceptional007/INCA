import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordPage() {
  const pageLocation = useLocation(),
    path = pageLocation.pathname,
    forgot = path === "/forgot-password",
    change = path === "/change-password";
  const { user, logout } = useAuth();
  const [token] = useState(
    () => new URLSearchParams(pageLocation.hash.slice(1)).get("token") || "",
  );
  useEffect(() => {
    if (token) history.replaceState(null, "", location.pathname);
  }, [token]);
  const [email, setEmail] = useState(""),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!forgot && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await api.post(
        forgot
          ? "/auth/forgot-password"
          : change
            ? "/auth/change-password"
            : "/auth/reset-password",
        forgot
          ? { email }
          : change
            ? { currentPassword: current, newPassword: password }
            : { token, newPassword: password },
      );
      setSuccess(response.data.message);
      setPassword("");
      setConfirm("");
      setCurrent("");
      if (change) logout();
    } catch (e: any) {
      const message = e.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(" ")
          : message || "Could not complete this request. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <section className="w-full max-w-md space-y-6 rounded-3xl border bg-card p-8 shadow-xl">
        <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <ShieldCheck />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-muted-foreground mb-2">
            INCA account security
          </p>
          <h1 className="text-2xl font-semibold">
            {forgot
              ? "Forgot your password?"
              : change
                ? "Set a new password"
                : "Reset your password"}
          </h1>
          <p className="text-sm text-muted-foreground mt-3">
            {forgot
              ? "Enter your account email to receive a single-use recovery link."
              : change && user?.mustChangePassword
                ? "Before entering the campus portal, replace your initial password."
                : "Use 12–72 characters with uppercase, lowercase, and a number. All sessions will be signed out."}
          </p>
        </div>
        {success ? (
          <div className="space-y-4">
            <p
              role="status"
              className="text-sm rounded-xl bg-emerald-500/10 p-4"
            >
              {success}
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Return to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {forgot ? (
              <div className="space-y-2">
                <Label htmlFor="recovery-email">Email address</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            ) : (
              <>
                {change && (
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).*"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              </>
            )}
            {!forgot && !change && !token && (
              <p className="text-sm text-destructive">
                This recovery link is missing its token. Request a new link.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              className="w-full"
              disabled={busy || (!forgot && !change && !token)}
            >
              {busy && <Loader2 className="animate-spin size-4 mr-2" />}
              {forgot ? "Send recovery link" : "Update password"}
            </Button>
          </form>
        )}
        <div className="flex justify-between text-sm">
          <Link
            to="/login"
            className="text-muted-foreground flex gap-1 items-center"
          >
            <ArrowLeft className="size-3" />
            Sign in
          </Link>
          {change && (
            <button type="button" onClick={logout}>
              Sign out
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
