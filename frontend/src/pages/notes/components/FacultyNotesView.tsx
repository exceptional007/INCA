import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Upload,
  Search,
  FileText,
  Sparkles,
  MoreVertical,
  Edit3,
  RefreshCw,
  Trash2,
  Download,
  Eye,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileBox,
  RotateCcw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import type { LearningNote } from '@/types';
import api from '@/api/axios';
import { UploadNoteModal } from './UploadNoteModal';
import { EditNoteModal } from './EditNoteModal';
import { ReplaceDocumentModal } from './ReplaceDocumentModal';
import { DeleteNoteConfirmDialog } from './DeleteNoteConfirmDialog';
import { DocumentPreviewModal } from './DocumentPreviewModal';

export const FacultyNotesView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);

  // Modal states
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [previewNote, setPreviewNote] = useState<LearningNote | null>(null);
  const [editNote, setEditNote] = useState<LearningNote | null>(null);
  const [replaceNote, setReplaceNote] = useState<LearningNote | null>(null);
  const [deleteNote, setDeleteNote] = useState<LearningNote | null>(null);

  // Fetch faculty notes and summary metrics
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['faculty-notes', searchTerm, statusFilter, page],
    queryFn: async () => {
      const params: any = { page, limit: 10 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.get('/notes/faculty', { params });
      return res.data;
    },
  });

  const notes: LearningNote[] = data?.items || [];
  const metrics = data?.metrics || {
    totalNotes: 0,
    publishedNotes: 0,
    draftNotes: 0,
    processingNotes: 0,
    failedNotes: 0,
  };
  const pagination = data?.pagination || { page: 1, totalPages: 1, totalItems: 0 };

  const handleDownload = async (note: LearningNote) => {
    if (note.sourceType === 'DRIVE' && note.driveUrl) {
      window.open(note.driveUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      const res = await api.get(`/notes/${note.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', note.originalFilename || `${note.title}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download failed:', err);
    }
  };

  const handleRetryProcessing = async (noteId: string) => {
    try {
      await api.post(`/notes/${noteId}/retry`);
      refetch();
    } catch (err: any) {
      console.error('Retry failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold">Total Materials</span>
            <FileBox className="size-4" />
          </div>
          <div className="text-2xl font-bold text-foreground">{metrics.totalNotes}</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-xs font-semibold">Published</span>
            <CheckCircle2 className="size-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{metrics.publishedNotes}</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold">Drafts</span>
            <BookOpen className="size-4" />
          </div>
          <div className="text-2xl font-bold text-foreground">{metrics.draftNotes}</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1.5">
            <span className="text-xs font-semibold">Processing</span>
            <Clock className="size-4" />
          </div>
          <div className="text-2xl font-bold text-blue-700">{metrics.processingNotes}</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-xs font-semibold">Needs Attention</span>
            <AlertCircle className="size-4" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{metrics.failedNotes}</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, subject, tags..."
              className="pl-9 bg-background text-xs h-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Status filter tabs */}
          <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/60 text-xs">
            {['ALL', 'PUBLISHED', 'DRAFT', 'PROCESSING', 'FAILED'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-all capitalize text-[11px] ${
                  statusFilter === st
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st.toLowerCase()}
              </button>
            ))}
          </div>

          <Button
            onClick={() => setIsUploadOpen(true)}
            size="sm"
            className="gap-2 bg-primary text-primary-foreground shadow-xs shrink-0 font-medium"
          >
            <Upload className="size-4" />
            Upload Notes
          </Button>
        </div>
      </div>

      {/* Notes Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="px-5 py-3.5 font-bold">Document Title</th>
                <th className="px-4 py-3.5 font-bold">Subject</th>
                <th className="px-4 py-3.5 font-bold">Programs</th>
                <th className="px-4 py-3.5 font-bold">Version</th>
                <th className="px-4 py-3.5 font-bold">Status</th>
                <th className="px-4 py-3.5 font-bold">AI Tutor</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Loading learning materials...
                  </td>
                </tr>
              ) : notes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                        <FileText className="size-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">No notes found</h4>
                      <p className="text-xs text-muted-foreground">
                        {searchTerm || statusFilter !== 'ALL'
                          ? 'No learning materials match your current filters.'
                          : 'Get started by uploading your lecture notes and course presentations.'}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setIsUploadOpen(true)}
                        className="gap-1.5 bg-primary text-primary-foreground"
                      >
                        <Upload className="size-4" />
                        Upload First Document
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                notes.map((note) => {
                  const isDrive = note.sourceType === 'DRIVE';
                  const isPdf = note.originalFilename?.toLowerCase().endsWith('.pdf');

                  return (
                    <tr key={note.id} className="hover:bg-muted/30 transition-colors">
                      {/* Title & Format */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isDrive
                                ? 'bg-blue-500/10 text-blue-600'
                                : isPdf
                                ? 'bg-red-500/10 text-red-600'
                                : 'bg-blue-600/10 text-blue-700'
                            }`}
                          >
                            {isDrive ? <ExternalLink className="size-4" /> : <FileText className="size-4" />}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <button
                              type="button"
                              onClick={() => setPreviewNote(note)}
                              className="text-xs font-semibold text-foreground hover:text-primary transition-colors truncate block text-left"
                            >
                              {note.title}
                            </button>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span>{isDrive ? 'Google Drive' : note.originalFilename}</span>
                              {note.fileSize && (
                                <span>• {(note.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-foreground block">{note.subject.code}</span>
                        <span className="text-[11px] text-muted-foreground truncate block max-w-[140px]">
                          {note.subject.name}
                        </span>
                      </td>

                      {/* Programs */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {note.programs.map((p, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-[10px] font-mono px-1.5 py-0 h-4 bg-muted/40"
                            >
                              {p.program.code}
                            </Badge>
                          ))}
                        </div>
                      </td>

                      {/* Version */}
                      <td className="px-4 py-3.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                          v{note.documentVersion}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold uppercase ${
                            note.status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : note.status === 'DRAFT'
                              ? 'bg-muted text-muted-foreground border-border'
                              : note.status === 'PROCESSING'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-destructive/10 text-destructive border-destructive/20'
                          }`}
                        >
                          {note.status}
                        </Badge>
                      </td>

                      {/* AI Tutor Readiness */}
                      <td className="px-4 py-3.5">
                        {note.aiReady ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                            <Sparkles className="size-3.5" />
                            Ready
                          </span>
                        ) : note.status === 'PROCESSING' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-blue-600">
                            <Clock className="size-3.5 animate-spin" />
                            Indexing...
                          </span>
                        ) : note.processingError ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-amber-600 cursor-help"
                            title={note.processingError}
                          >
                            <AlertCircle className="size-3.5" />
                            Unavailable
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => setPreviewNote(note)}
                            title="Preview Document"
                          >
                            <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>

                          {!isDrive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleDownload(note)}
                              title="Download File"
                            >
                              <Download className="size-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7">
                                <MoreVertical className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuItem onClick={() => setEditNote(note)} className="gap-2">
                                <Edit3 className="size-3.5" />
                                Edit Metadata
                              </DropdownMenuItem>

                              {!isDrive && (
                                <DropdownMenuItem onClick={() => setReplaceNote(note)} className="gap-2">
                                  <RefreshCw className="size-3.5" />
                                  Replace Document File
                                </DropdownMenuItem>
                              )}

                              {note.status === 'FAILED' && (
                                <DropdownMenuItem onClick={() => handleRetryProcessing(note.id)} className="gap-2">
                                  <RotateCcw className="size-3.5" />
                                  Retry Processing
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteNote(note)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                                Delete Note
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {notes.length} of {pagination.totalItems} notes
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="size-8 p-0"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2 text-foreground font-medium">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="size-8 p-0"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <UploadNoteModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => refetch()}
      />

      <EditNoteModal
        note={editNote}
        isOpen={!!editNote}
        onClose={() => setEditNote(null)}
        onSuccess={() => refetch()}
      />

      <ReplaceDocumentModal
        note={replaceNote}
        isOpen={!!replaceNote}
        onClose={() => setReplaceNote(null)}
        onSuccess={() => refetch()}
      />

      <DeleteNoteConfirmDialog
        note={deleteNote}
        isOpen={!!deleteNote}
        onClose={() => setDeleteNote(null)}
        onSuccess={() => refetch()}
      />

      <DocumentPreviewModal
        note={previewNote}
        isOpen={!!previewNote}
        onClose={() => setPreviewNote(null)}
        onDownload={handleDownload}
      />
    </div>
  );
};

