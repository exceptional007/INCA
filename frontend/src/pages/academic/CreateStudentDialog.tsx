import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { generateInitialPassword } from "@/components/useInitialCredentials";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (email: string, password: string) => void;
};
const fieldClass =
  "mt-1 w-full min-w-0 rounded-xl border bg-background p-3 text-sm";
export function CreateStudentDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const options = useQuery<any>({
    queryKey: ["student-registration-options", user?.id],
    enabled: open,
    queryFn: async () => (await api.get("/students/registration-options")).data,
    staleTime: 0,
  });
  const [departmentId, setDepartment] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setDepartment("");
      setFile(null);
      setError("");
    }
  }, [open]);
  useEffect(() => {
    if (
      open &&
      options.data?.departmentLocked &&
      options.data.departments.length === 1
    )
      setDepartment(options.data.departments[0].id);
  }, [options.data, open]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    for (const [key, value] of [...form.entries()]) {
      if (typeof value === "string") {
        const trimmed = key === "password" ? value : value.trim();
        if (trimmed) form.set(key, trimmed);
        else form.delete(key);
      }
    }
    const email = String(form.get("email") || "").toLowerCase();
    const password =
      String(form.get("password") || "") || generateInitialPassword();
    form.set("email", email);
    form.set("password", password);
    form.set("departmentId", departmentId);
    if (file) form.set("photo", file);
    else form.delete("photo");
    setBusy(true);
    try {
      const response = await api.post("/students/accounts", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const saved = response.data?.data;
      if (
        !response.data?.success ||
        !saved?.student?.id ||
        !saved?.user?.id ||
        (file && !saved.student.photoKey)
      )
        throw new Error(
          "The server did not confirm a complete student record. Refresh the student list before trying again.",
        );
      onOpenChange(false);
      onCreated(email, password);
    } catch (error: any) {
      const detail =
        error.response?.data?.message ||
        error.message ||
        "Could not create student. Please try again.";
      setError(Array.isArray(detail) ? detail.join(" ") : detail);
    } finally {
      setBusy(false);
    }
  }
  const sections =
    options.data?.sections.filter(
      (section: any) => section.semester.program.departmentId === departmentId,
    ) || [];
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add new student</DialogTitle>
          <DialogDescription>
            Create a student profile, assign their class, and set up their
            login. They must change the initial password on first sign-in.
          </DialogDescription>
        </DialogHeader>
        {options.isPending && <p role="status">Loading academic options…</p>}
        {options.isError && (
          <div role="alert">
            <p>
              {(options.error as any)?.response?.data?.message ||
                "Could not load registration options."}
            </p>
            <Button variant="outline" onClick={() => options.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {options.data && (
          <form onSubmit={submit} className="space-y-6">
            <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-muted/30 p-4">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-background">
                {preview ? (
                  <img
                    src={preview}
                    alt="Selected student photo"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No photo
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="new-student-photo"
                  className="text-sm font-medium"
                >
                  Student photo (optional)
                </label>
                <input
                  key={file?.name || 'no-photo'}
                  id="new-student-photo"
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  className="mt-2 block w-full text-xs file:mr-2 file:rounded-lg file:border file:bg-background file:p-2"
                  onChange={(event) => {
                    const next = event.target.files?.[0];
                    setError("");
                    if (
                      next &&
                      (!["image/jpeg", "image/png", "image/webp"].includes(
                        next.type,
                      ) ||
                        next.size > 5 * 1024 * 1024)
                    ) {
                      setError("Choose a JPG, PNG, or WebP photo up to 5 MB.");
                      event.target.value = "";
                      setFile(null);
                      return;
                    }
                    setFile(next || null);
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  JPG, PNG, or WebP · Up to 5 MB. Uploaded when you create the
                  student.
                </p>
                {file && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setFile(null)}
                  >
                    Remove photo
                  </Button>
                )}
              </div>
            </section>
            <fieldset disabled={busy} className="space-y-4">
              <legend className="mb-3 font-semibold">Personal details</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  First name *
                  <Input
                    name="firstName"
                    required
                    maxLength={100}
                    autoComplete="given-name"
                    className="mt-1"
                  />
                </label>
                <label className="text-sm">
                  Last name
                  <Input
                    name="lastName"
                    maxLength={100}
                    autoComplete="family-name"
                    className="mt-1"
                  />
                </label>
                <label className="text-sm">
                  Gender *
                  <select
                    name="gender"
                    required
                    className={fieldClass}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select gender
                    </option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="text-sm">
                  Date of birth
                  <Input
                    name="dateOfBirth"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className="mt-1"
                  />
                </label>
                <label className="text-sm">
                  Phone number
                  <Input
                    name="phone"
                    type="tel"
                    maxLength={20}
                    autoComplete="tel"
                    className="mt-1"
                  />
                </label>
                <label className="text-sm">
                  Blood group
                  <select
                    name="bloodGroup"
                    className={fieldClass}
                    defaultValue=""
                  >
                    <option value="">Not provided</option>
                    {[
                      ["A_POSITIVE", "A+"],
                      ["A_NEGATIVE", "A−"],
                      ["B_POSITIVE", "B+"],
                      ["B_NEGATIVE", "B−"],
                      ["AB_POSITIVE", "AB+"],
                      ["AB_NEGATIVE", "AB−"],
                      ["O_POSITIVE", "O+"],
                      ["O_NEGATIVE", "O−"],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                Residential address
                <textarea
                  name="address"
                  maxLength={500}
                  rows={2}
                  autoComplete="street-address"
                  className={fieldClass}
                />
              </label>
            </fieldset>
            <fieldset disabled={busy} className="space-y-4">
              <legend className="mb-3 font-semibold">Academic details</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  College ID *
                  <Input
                    name="collegeId"
                    required
                    maxLength={50}
                    className="mt-1"
                  />
                </label>
                <label className="text-sm">
                  Roll number *
                  <Input
                    name="rollNumber"
                    required
                    maxLength={30}
                    className="mt-1"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  Enrollment number *
                  <Input
                    name="enrollmentNumber"
                    required
                    maxLength={50}
                    className="mt-1"
                    placeholder="Enter the actual university enrollment number"
                  />
                </label>
                <label className="text-sm">
                  Department *
                  <select
                    name="departmentId"
                    required
                    value={departmentId}
                    disabled={options.data.departmentLocked}
                    className={fieldClass}
                    onChange={(event) => setDepartment(event.target.value)}
                  >
                    <option value="">Select department</option>
                    {options.data.departments.map((department: any) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Program / semester / section {sections.length ? '*' : '(not yet configured)'}
                  <select
                    key={departmentId}
                    name="sectionId"
                    required={sections.length > 0}
                    defaultValue=""
                    className={fieldClass}
                  >
                    <option value="">{sections.length ? 'Select class' : 'Not assigned yet'}</option>
                    {sections.map((section: any) => (
                      <option key={section.id} value={section.id}>
                        {section.semester.program.name} · Semester{" "}
                        {section.semester.number} · {section.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!sections.length && departmentId && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  No active classes are configured for this department. You can create
                  the student now; their timetable will be available after a section is assigned.
                </p>
              )}
            </fieldset>
            <fieldset disabled={busy} className="space-y-4">
              <legend className="mb-3 font-semibold">
                Login & emergency contact
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Institutional email *
                  <Input
                    name="email"
                    type="email"
                    required
                    pattern=".+@bit[.]ac[.]in"
                    maxLength={254}
                    autoComplete="off"
                    placeholder="student@bit.ac.in"
                    className="mt-1"
                  />
                </label>
                <label className="text-sm">
                  Initial password (optional)
                  <Input
                    name="password"
                    type="password"
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    placeholder="Leave blank to generate securely"
                    className="mt-1"
                  />
                </label>
                <label className="text-sm">
                  Emergency contact name
                  <Input
                    name="emergencyContactName"
                    maxLength={100}
                    className="mt-1"
                  />
                </label>
                <label className="text-sm">
                  Emergency contact phone
                  <Input
                    name="emergencyContactPhone"
                    type="tel"
                    maxLength={20}
                    className="mt-1"
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                The initial credentials are shown once after the account is
                successfully saved. Fields marked * are required.
              </p>
            </fieldset>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || !departmentId}
              >
                {busy ? "Creating student…" : "Create student"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
