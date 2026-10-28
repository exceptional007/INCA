import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Loader2 } from 'lucide-react';
import type { LearningNote } from '@/types';
import api from '@/api/axios';

interface DeleteNoteConfirmDialogProps {
  note: LearningNote | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteNoteConfirmDialog: React.FC<DeleteNoteConfirmDialogProps> = ({
  note,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!note) return;
    setSubmitting(true);
    try {
      await api.delete(`/notes/${note.id}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!note) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
      <AlertDialogContent className="bg-background border-border">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="size-5" />
            </div>
            <AlertDialogTitle className="text-base font-semibold">Delete Learning Note?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{note.title}"</span>? This will permanently remove the original document from Cloudflare R2 storage, delete all AI-generated question caches, and erase the tutor index.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Confirm Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

