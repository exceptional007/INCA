import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, Upload, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { LearningNote } from '@/types';
import api from '@/api/axios';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

interface ReplaceDocumentModalProps {
  note: LearningNote | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReplaceDocumentModal: React.FC<ReplaceDocumentModalProps> = ({
  note,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note || !file) return;

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.put(`/notes/${note.id}/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to replace document file.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!note) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-w-md p-6 bg-background border-border">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <RefreshCw className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Replace Document File
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Version {note.documentVersion} • {note.originalFilename || 'Current document'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Replacing this document will delete the existing file and invalidate its previous AI tutor index. The new file will be automatically re-indexed for tutoring.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Select New PDF or DOCX</label>
            <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-5 text-center bg-card transition-all relative cursor-pointer">
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Upload className="size-6 text-primary" />
                {file ? (
                  <div>
                    <p className="text-xs font-semibold text-foreground">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-foreground">Choose new file (max 25 MB)</p>
                    <p className="text-[11px] text-muted-foreground">PDF or DOCX</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!file || submitting} className="bg-primary text-primary-foreground gap-2">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Upload & Re-index
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

