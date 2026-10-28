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
import { Edit3, Loader2, X, Plus, AlertCircle, Check } from 'lucide-react';
import type { LearningNote } from '@/types';
import api from '@/api/axios';

interface EditNoteModalProps {
  note: LearningNote | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditNoteModal: React.FC<EditNoteModalProps> = ({
  note,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [semesterNumber, setSemesterNumber] = useState<number>(5);
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('PUBLISHED');

  const [subjects, setSubjects] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; code: string; name: string }>>([]);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!note || !isOpen) return;

    setTitle(note.title);
    setDescription(note.description || '');
    setSubjectId(note.subjectId);
    setSelectedPrograms(note.programs?.map((p) => p.program.id) || []);
    setSemesterNumber(note.semesterNumber || 5);
    setTags(note.tags || []);
    setStatus((note.status as any) || 'PUBLISHED');
    setError(null);

    // Fetch subjects & programs
    api.get('/notes/faculty/context').then((res) => {
      setSubjects(res.data.subjects || []);
      setPrograms(res.data.programs || []);
    }).catch((err) => console.warn(err));
  }, [note, isOpen]);

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
    if (!note) return;
    setError(null);
    setSubmitting(true);

    try {
      await api.patch(`/notes/${note.id}`, {
        title: title.trim(),
        description: description.trim(),
        subjectId,
        programIds: selectedPrograms,
        semesterNumber,
        tags,
        status,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update note.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!note) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Edit3 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Edit Note Details
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update document metadata, subject assignments, and programs
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 bg-card/40">
          {error && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Note Title *</label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-card text-xs py-2.5"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Publication Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none"
              >
                <option value="PUBLISHED">Published (Visible to students)</option>
                <option value="DRAFT">Draft (Private to faculty)</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Assigned Subject *</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none"
              required
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Programs selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Target Academic Programs</label>
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

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Topic Tags</label>
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
                placeholder="Add a topic tag..."
                className="bg-card text-xs py-2"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddTag} className="gap-1 text-xs">
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[11px] gap-1 px-2 py-0.5 bg-muted text-foreground">
                    #{tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-destructive">
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/60">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground gap-2">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Edit3 className="size-4" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

