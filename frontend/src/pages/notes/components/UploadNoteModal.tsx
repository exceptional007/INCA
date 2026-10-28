import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  Link as LinkIcon,
  Loader2,
  X,
  Plus,
  AlertCircle,
  Check,
} from 'lucide-react';
import api from '@/api/axios';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

interface UploadNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadNoteModal: React.FC<UploadNoteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [sourceType, setSourceType] = useState<'FILE' | 'DRIVE'>('FILE');
  const [file, setFile] = useState<File | null>(null);
  const [driveUrl, setDriveUrl] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [semesterNumber, setSemesterNumber] = useState<number>(5);
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [isDraft, setIsDraft] = useState<boolean>(false);

  // Metadata context from backend
  const [subjects, setSubjects] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; code: string; name: string; shortName?: string }>>([]);
  const [loadingContext, setLoadingContext] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setDriveUrl('');
      setTitle('');
      setDescription('');
      setSelectedPrograms([]);
      setTags([]);
      setError(null);
      setSubmitting(false);
      return;
    }

    const fetchContext = async () => {
      setLoadingContext(true);
      try {
        const res = await api.get('/notes/faculty/context');
        const sList = res.data.subjects || [];
        const pList = res.data.programs || [];
        setSubjects(sList);
        setPrograms(pList);

        if (sList.length > 0 && !subjectId) {
          setSubjectId(sList[0].id);
        }
        if (pList.length > 0 && selectedPrograms.length === 0) {
          setSelectedPrograms([pList[0].id]);
        }
      } catch (err: any) {
        setError('Failed to load faculty academic subjects. Please refresh.');
      } finally {
        setLoadingContext(false);
      }
    };

    fetchContext();
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      setError(`File size exceeds 25 MB limit (${(selected.size / (1024 * 1024)).toFixed(1)} MB).`);
      setFile(null);
      return;
    }

    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(ext || '')) {
      setError('Only PDF and DOCX files are supported.');
      setFile(null);
      return;
    }

    setError(null);
    setFile(selected);
    if (!title) {
      // Auto-populate title from filename without extension
      const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const toggleProgram = (progId: string) => {
    if (selectedPrograms.includes(progId)) {
      if (selectedPrograms.length > 1) {
        setSelectedPrograms(selectedPrograms.filter((id) => id !== progId));
      }
    } else {
      setSelectedPrograms([...selectedPrograms, progId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Document title is required.');
      return;
    }

    if (!subjectId) {
      setError('Please select an assigned subject.');
      return;
    }

    if (selectedPrograms.length === 0) {
      setError('Please select at least one academic program.');
      return;
    }

    if (sourceType === 'FILE' && !file) {
      setError('Please select a PDF or DOCX file to upload.');
      return;
    }

    if (sourceType === 'DRIVE') {
      if (!driveUrl.trim() || !/drive\.google\.com|docs\.google\.com/i.test(driveUrl)) {
        setError('Please provide a valid Google Drive or Google Docs sharing URL.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      formData.append('subjectId', subjectId);
      formData.append('programIds', JSON.stringify(selectedPrograms));
      formData.append('semesterNumber', semesterNumber.toString());
      formData.append('sourceType', sourceType);
      formData.append('status', isDraft ? 'DRAFT' : 'PUBLISHED');

      if (tags.length > 0) {
        formData.append('tags', JSON.stringify(tags));
      }

      if (sourceType === 'FILE' && file) {
        formData.append('file', file);
      } else if (sourceType === 'DRIVE') {
        formData.append('driveUrl', driveUrl.trim());
      }

      await api.post('/notes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Upload className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Upload Learning Notes
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share course materials with verified students and activate AI tutoring
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 bg-card/40">
          {error && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Source Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Document Source</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceType('FILE')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                  sourceType === 'FILE'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                <FileText className="size-4" />
                Upload PDF / DOCX
              </button>
              <button
                type="button"
                onClick={() => setSourceType('DRIVE')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                  sourceType === 'DRIVE'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                <LinkIcon className="size-4" />
                Google Drive Link
              </button>
            </div>
          </div>

          {/* Source 1: File Upload Box */}
          {sourceType === 'FILE' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Course Document File</label>
              <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-6 text-center bg-card transition-all relative cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Upload className="size-6" />
                  </div>
                  {file ? (
                    <div>
                      <p className="text-sm font-semibold text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Drag & drop your PDF or DOCX file here, or <span className="text-primary font-semibold">browse</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Max file size: 25 MB per file
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Source 2: Google Drive URL Box */}
          {sourceType === 'DRIVE' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Google Drive Sharing URL</label>
              <Input
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/... or docs.google.com/document/d/..."
                className="bg-card text-xs py-2.5"
              />
              <p className="text-[11px] text-muted-foreground">
                Ensure the sharing settings are set to "Anyone with the link can view" for automated AI indexing.
              </p>
            </div>
          )}

          {/* Title & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Note Title *</label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unit 3: Neural Networks Architecture"
                className="bg-card text-xs py-2.5"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Assigned Subject *</label>
              {loadingContext ? (
                <div className="h-9 rounded-md bg-muted animate-pulse" />
              ) : (
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Multiple Academic Programs Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Target Academic Programs *</label>
              <span className="text-[11px] text-muted-foreground">Select one or multiple programs</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {programs.map((prog) => {
                const isSelected = selectedPrograms.includes(prog.id);
                return (
                  <button
                    key={prog.id}
                    type="button"
                    onClick={() => toggleProgram(prog.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary font-semibold shadow-xs'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {isSelected && <Check className="size-3.5 text-primary" />}
                    <span>{prog.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Semester & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Semester</label>
              <select
                value={semesterNumber}
                onChange={(e) => setSemesterNumber(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Topic Tags (optional)</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="e.g. Backprop, Transformers..."
                  className="bg-card text-xs py-2"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  className="gap-1 px-3 text-xs"
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[11px] gap-1 px-2 py-0.5 bg-muted text-foreground"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Summary or Instructions (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Provide a brief description of the topics covered in these notes..."
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Draft vs Publish Toggle */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">Publish immediately</span>
              <span className="text-[11px] text-muted-foreground">
                {isDraft
                  ? 'Saved as draft. Only visible to you until published.'
                  : 'Published immediately to students and queued for AI indexing.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsDraft(!isDraft)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                !isDraft ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <div
                className={`bg-white size-4 rounded-full shadow-md transform transition-transform ${
                  !isDraft ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/60">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-2 bg-primary text-primary-foreground shadow-xs px-5"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Uploading & Processing...
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  {isDraft ? 'Save as Draft' : 'Upload & Publish'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

