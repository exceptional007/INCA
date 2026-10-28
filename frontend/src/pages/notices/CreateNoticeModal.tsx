import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type {
  NoticeCategory,
  NoticePriority,
  NoticeTargetScope,
  AcademicScopeData,
} from '@/types/notice';
import { noticeApi } from '@/services/notice';
import {
  FileText,
  Upload,
  X,
  Calendar,
  Clock,
  Pin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Users,
} from 'lucide-react';

interface CreateNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  userRole?: string;
}

const CATEGORIES: { label: string; value: NoticeCategory }[] = [
  { label: 'General Announcement', value: 'GENERAL' },
  { label: 'Academic & Courses', value: 'ACADEMIC' },
  { label: 'Examinations & Grades', value: 'EXAMINATION' },
  { label: 'Placements & Careers', value: 'PLACEMENT' },
  { label: 'Events & Seminars', value: 'EVENT' },
  { label: 'Official Circulars', value: 'CIRCULAR' },
  { label: 'Administrative Orders', value: 'ADMINISTRATIVE' },
  { label: 'Holidays & Closures', value: 'HOLIDAY' },
  { label: 'Urgent Campus Notice', value: 'URGENT' },
];

const PRIORITIES: { label: string; value: NoticePriority; color: string }[] = [
  { label: 'Normal Priority', value: 'NORMAL', color: 'border-blue-500/40 text-blue-600' },
  { label: 'Low (Routine)', value: 'LOW', color: 'border-muted text-muted-foreground' },
  { label: 'High Priority', value: 'HIGH', color: 'border-amber-500/50 text-amber-600' },
  { label: 'Critical (Urgent Alert)', value: 'CRITICAL', color: 'border-red-500 text-red-600' },
];

export const CreateNoticeModal: React.FC<CreateNoticeModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('GENERAL');
  const [priority, setPriority] = useState<NoticePriority>('NORMAL');

  // Targeting state
  const [targetScope, setTargetScope] = useState<NoticeTargetScope>('ALL');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');

  // Scheduling & Expiry
  const [isScheduled, setIsScheduled] = useState(false);
  const [publishAtDate, setPublishAtDate] = useState('');
  const [publishAtTime, setPublishAtTime] = useState('09:00');
  const [hasExpiry, setHasExpiry] = useState(true);
  const [expiresAtDate, setExpiresAtDate] = useState('');
  const [expiresAtTime, setExpiresAtTime] = useState('18:00');

  // Flags
  const [isPinned, setIsPinned] = useState(false);
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);

  // PDF Attachments
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Data pickers
  const [academicScopes, setAcademicScopes] = useState<AcademicScopeData | null>(null);

  // Status
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadScopes();
      // Set default expiry date to 14 days from now
      const defaultExp = new Date(Date.now() + 14 * 86400000);
      setExpiresAtDate(defaultExp.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  const loadScopes = async () => {
    try {
      const data = await noticeApi.getAcademicScopes();
      setAcademicScopes(data);
      if (data.departments.length > 0 && !selectedDepartmentId) {
        setSelectedDepartmentId(data.departments[0].id);
      }
    } catch (e) {
      console.error('Failed to load academic scopes', e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Validate PDF
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only official PDF documents are accepted for attachments');
      return;
    }

    // Validate size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      setError('PDF file size must not exceed 25MB');
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!title.trim()) {
      setError('Please provide an announcement title');
      return;
    }
    if (!content.trim()) {
      setError('Please provide announcement body text');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let publishAt: string | undefined = undefined;
      if (isScheduled && publishAtDate) {
        publishAt = new Date(`${publishAtDate}T${publishAtTime}:00`).toISOString();
      }

      let expiresAt: string | undefined = undefined;
      if (hasExpiry && expiresAtDate) {
        expiresAt = new Date(`${expiresAtDate}T${expiresAtTime}:00`).toISOString();
      }

      const notice = await noticeApi.createNotice({
        title: title.trim(),
        content: content.trim(),
        category,
        priority,
        targetScope,
        departmentId: targetScope === 'DEPARTMENT' ? selectedDepartmentId : undefined,
        programId: targetScope === 'PROGRAM' ? selectedProgramId : undefined,
        targetSemester: selectedSemester !== '' ? Number(selectedSemester) : undefined,
        requiresAcknowledgement,
        isPinned,
        publishAt,
        expiresAt,
        status: isDraft ? 'DRAFT' : isScheduled ? 'SCHEDULED' : 'PUBLISHED',
      });

      // Upload PDF attachment if selected
      if (selectedFile) {
        await noticeApi.uploadAttachment(notice.id, selectedFile);
      }

      // Reset form
      setTitle('');
      setContent('');
      setSelectedFile(null);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to publish announcement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <span>Create Official Notice</span>
            </DialogTitle>

            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  activeTab === 'edit'
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Compose
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  activeTab === 'preview'
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Live Preview
              </button>
            </div>
          </div>
          <DialogDescription className="text-xs">
            Publish targeted, prioritized official communications to students and faculty across campus.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs border-b border-red-200 flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'preview' ? (
          <div className="p-6 space-y-4">
            <div className="border rounded-2xl p-6 bg-card space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-bold uppercase">
                  {priority}
                </Badge>
                <Badge variant="secondary" className="text-xs font-semibold uppercase">
                  {category}
                </Badge>
                {isPinned && <Badge className="bg-primary/10 text-primary text-xs">Pinned</Badge>}
                {requiresAcknowledgement && (
                  <Badge className="bg-amber-100 text-amber-800 text-xs">Acknowledgement Required</Badge>
                )}
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {title || 'Announcement Title'}
              </h2>

              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap leading-relaxed">
                {content || 'Announcement content will appear here...'}
              </div>

              {selectedFile && (
                <div className="p-3 bg-muted/40 border rounded-xl flex items-center gap-2 text-xs text-foreground">
                  <FileText className="size-4 text-red-600" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <form className="p-6 space-y-5" onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }}>
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="notice-title" className="text-xs font-bold uppercase text-muted-foreground">
                Announcement Title *
              </Label>
              <Input
                id="notice-title"
                placeholder="e.g. Schedule for Mid-Term Practical Examinations Nov 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-sm font-medium"
                required
              />
            </div>

            {/* Category & Priority Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Notice Category
                </Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NoticeCategory)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Priority Level
                </Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as NoticePriority)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="notice-content" className="text-xs font-bold uppercase text-muted-foreground">
                  Notice Body & Circular Content *
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Supports markdown formatting
                </span>
              </div>
              <textarea
                id="notice-content"
                rows={7}
                placeholder="Write the official notice details, instructions, venue, and actionable dates here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-sm rounded-lg border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-sans leading-relaxed"
                required
              />
            </div>

            {/* Audience Targeting Box */}
            <div className="p-4 bg-muted/20 border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  Target Audience
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Controls who receives this announcement
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground font-semibold">Scope</Label>
                  <select
                    value={targetScope}
                    onChange={(e) => setTargetScope(e.target.value as NoticeTargetScope)}
                    className="w-full text-xs h-8 mt-1 rounded-md border border-input bg-background px-2 font-medium"
                  >
                    <option value="ALL">Entire Campus (Students & Faculty)</option>
                    <option value="STUDENTS">All Students Only</option>
                    <option value="FACULTY">All Faculty & Staff Only</option>
                    <option value="DEPARTMENT">Specific Department</option>
                    <option value="PROGRAM">Specific Program</option>
                  </select>
                </div>

                {targetScope === 'DEPARTMENT' && (
                  <div>
                    <Label className="text-[11px] text-muted-foreground font-semibold">Department</Label>
                    <select
                      value={selectedDepartmentId}
                      onChange={(e) => setSelectedDepartmentId(e.target.value)}
                      className="w-full text-xs h-8 mt-1 rounded-md border border-input bg-background px-2 font-medium"
                    >
                      {academicScopes?.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetScope === 'PROGRAM' && (
                  <div>
                    <Label className="text-[11px] text-muted-foreground font-semibold">Program</Label>
                    <select
                      value={selectedProgramId}
                      onChange={(e) => setSelectedProgramId(e.target.value)}
                      className="w-full text-xs h-8 mt-1 rounded-md border border-input bg-background px-2 font-medium"
                    >
                      <option value="">Select academic program...</option>
                      {academicScopes?.programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {targetScope === 'PROGRAM' && (
                <div className="pt-2 border-t grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground font-semibold">Semester (Optional)</Label>
                    <select
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs h-8 mt-1 rounded-md border border-input bg-background px-2 font-medium"
                    >
                      <option value="">All Semesters</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Scheduling & Options Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Publication Mode */}
              <div className="p-3 border rounded-xl space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded text-primary focus:ring-primary size-3.5"
                    />
                    <span>Schedule Publication</span>
                  </Label>
                  <Clock className="size-3.5 text-muted-foreground" />
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Input
                      type="date"
                      value={publishAtDate}
                      onChange={(e) => setPublishAtDate(e.target.value)}
                      className="h-8 text-xs"
                      required={isScheduled}
                    />
                    <Input
                      type="time"
                      value={publishAtTime}
                      onChange={(e) => setPublishAtTime(e.target.value)}
                      className="h-8 text-xs"
                      required={isScheduled}
                    />
                  </div>
                )}
              </div>

              {/* Expiration Settings */}
              <div className="p-3 border rounded-xl space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasExpiry}
                      onChange={(e) => setHasExpiry(e.target.checked)}
                      className="rounded text-primary focus:ring-primary size-3.5"
                    />
                    <span>Automatic Expiry Date</span>
                  </Label>
                  <Calendar className="size-3.5 text-muted-foreground" />
                </div>

                {hasExpiry && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Input
                      type="date"
                      value={expiresAtDate}
                      onChange={(e) => setExpiresAtDate(e.target.value)}
                      className="h-8 text-xs"
                      required={hasExpiry}
                    />
                    <Input
                      type="time"
                      value={expiresAtTime}
                      onChange={(e) => setExpiresAtTime(e.target.value)}
                      className="h-8 text-xs"
                      required={hasExpiry}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Checkbox Controls */}
            <div className="flex flex-wrap items-center gap-6 pt-1 text-xs text-foreground">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded text-primary focus:ring-primary size-4"
                />
                <Pin className="size-3.5 text-primary" />
                <span>Pin notice to top of board</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={requiresAcknowledgement}
                  onChange={(e) => setRequiresAcknowledgement(e.target.checked)}
                  className="rounded text-primary focus:ring-primary size-4"
                />
                <CheckCircle2 className="size-3.5 text-amber-600" />
                <span>Require formal recipient acknowledgement</span>
              </label>
            </div>

            {/* PDF Attachment Dropzone */}
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Attach Supporting PDF Document (Max 25MB)
              </Label>

              {selectedFile ? (
                <div className="p-3 bg-card border rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-red-500/10 text-red-600 rounded-lg">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{selectedFile.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Cloudflare R2
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleRemoveFile}
                    className="size-7 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <label className="border border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition text-center group">
                  <Upload className="size-6 text-muted-foreground group-hover:text-primary transition mb-1" />
                  <span className="text-xs font-semibold text-foreground">Click to upload official PDF</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Signed circulars, timetables, or exam schedules up to 25MB
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </form>
        )}

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting || !title.trim()}
              onClick={() => handleSubmit(true)}
            >
              Save as Draft
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={submitting || !title.trim() || !content.trim()}
              onClick={() => handleSubmit(false)}
              className="gap-1.5 shadow-xs"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              {isScheduled ? 'Schedule Notice' : 'Publish Announcement'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
