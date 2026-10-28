import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  FileText,
  Sparkles,
  Download,
  Eye,
  HelpCircle,
  ExternalLink,
  BookOpen,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
} from 'lucide-react';
import type { LearningNote } from '@/types';
import api from '@/api/axios';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { AITutorModal } from './AITutorModal';
import { AIQuizModal } from './AIQuizModal';

export const StudentNotesView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<number | 'ALL'>('ALL');
  const [selectedSourceType, setSelectedSourceType] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);

  // Active interaction modals
  const [previewNote, setPreviewNote] = useState<LearningNote | null>(null);
  const [tutorNote, setTutorNote] = useState<LearningNote | null>(null);
  const [quizNote, setQuizNote] = useState<LearningNote | null>(null);

  // Fetch student profile context (enrolled program, semester)
  const { data: studentContext } = useQuery({
    queryKey: ['student-context'],
    queryFn: async () => {
      try {
        const res = await api.get('/notes/student/context');
        return res.data;
      } catch {
        return null;
      }
    },
  });

  // Fetch published notes within student scope
  const { data, isLoading } = useQuery({
    queryKey: ['student-notes', searchTerm, selectedSemester, selectedSourceType, page],
    queryFn: async () => {
      const params: any = { page, limit: 12 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedSemester !== 'ALL') params.semesterNumber = selectedSemester;
      if (selectedSourceType !== 'ALL') params.sourceType = selectedSourceType;

      const res = await api.get('/notes', { params });
      return res.data;
    },
  });

  const notes: LearningNote[] = data?.items || [];
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

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedSemester('ALL');
    setSelectedSourceType('ALL');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Student Academic Hero Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-card via-card to-primary/5 border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
            <GraduationCap className="size-3.5" />
            Verified Academic Library
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Course Notes & AI Tutor
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Browse lecture materials shared by your faculty, preview documents in-app, ask the grounded AI Tutor questions, and test your knowledge with interactive quizzes.
          </p>
        </div>

        {studentContext?.program && (
          <div className="flex items-center gap-2 sm:self-center shrink-0 p-3 rounded-xl bg-background border border-border/80">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              {studentContext.program.code}
            </div>
            <div className="text-left">
              <span className="text-xs font-semibold text-foreground block">
                {studentContext.program.name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {studentContext.semesterNumber ? `Semester ${studentContext.semesterNumber}` : 'Enrolled Student'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by topic, subject code, professor, or tag..."
              className="pl-9 bg-background text-xs h-9.5"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Source Type Filter */}
            <select
              value={selectedSourceType}
              onChange={(e) => {
                setSelectedSourceType(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="ALL">All Formats</option>
              <option value="FILE">Uploaded Files (PDF / DOCX)</option>
              <option value="DRIVE">Google Drive Materials</option>
            </select>

            {(searchTerm || selectedSemester !== 'ALL' || selectedSourceType !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Semester Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar text-xs">
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0 mr-1 flex items-center gap-1">
            <Filter className="size-3" />
            Semester:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedSemester('ALL');
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-all text-xs shrink-0 ${
              selectedSemester === 'ALL'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            All Semesters
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <button
              key={sem}
              type="button"
              onClick={() => {
                setSelectedSemester(sem);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all text-xs shrink-0 ${
                selectedSemester === sem
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              Sem {sem}
            </button>
          ))}
        </div>
      </div>

      {/* Note Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-card border border-border animate-pulse p-5" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="p-16 text-center bg-card rounded-2xl border border-border shadow-xs">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <BookOpen className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No Learning Notes Available</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {searchTerm || selectedSemester !== 'ALL' || selectedSourceType !== 'ALL'
                ? 'No course notes match your search filters. Try broadening your criteria.'
                : 'Your faculty have not published notes for this semester yet. Check back soon!'}
            </p>
            {(searchTerm || selectedSemester !== 'ALL' || selectedSourceType !== 'ALL') && (
              <Button onClick={resetFilters} variant="outline" size="sm" className="gap-1.5 mt-2">
                <RotateCcw className="size-3.5" />
                Clear All Filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {notes.map((note) => {
            const isDrive = note.sourceType === 'DRIVE';
            const isPdf = note.originalFilename?.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={note.id}
                className="group flex flex-col justify-between p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all"
              >
                {/* Top Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/5 text-primary border-primary/20">
                        {note.subject.code}
                      </Badge>
                      {note.semesterNumber && (
                        <Badge variant="secondary" className="text-[10px] font-medium bg-muted text-muted-foreground">
                          Sem {note.semesterNumber}
                        </Badge>
                      )}
                    </div>

                    {/* Format Indicator */}
                    <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                      {isDrive ? (
                        <>
                          <ExternalLink className="size-3 text-blue-600" />
                          Drive Link
                        </>
                      ) : isPdf ? (
                        <>
                          <FileText className="size-3 text-red-600" />
                          PDF
                        </>
                      ) : (
                        <>
                          <FileText className="size-3 text-blue-600" />
                          DOCX
                        </>
                      )}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {note.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                      {note.description || `${note.subject.name} lecture notes and study material.`}
                    </p>
                  </div>

                  {/* Faculty info */}
                  {note.faculty && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                      <span>Instructor:</span>
                      <span className="font-semibold text-foreground">
                        {note.faculty.firstName} {note.faculty.lastName || ''}
                      </span>
                    </div>
                  )}

                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {note.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 mt-4 border-t border-border/60 space-y-2.5">
                  {/* AI Status Pill */}
                  <div className="flex items-center justify-between text-xs">
                    {note.aiReady ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <Sparkles className="size-3.5" />
                        AI Tutor & Quiz Ready
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Document Reading Mode</span>
                    )}

                    {!isDrive && note.fileSize && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {(note.fileSize / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    )}
                  </div>

                  {/* Action Buttons Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewNote(note)}
                      className="gap-1.5 text-xs font-medium h-8"
                    >
                      <Eye className="size-3.5 text-muted-foreground" />
                      Preview
                    </Button>

                    {isDrive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(note.driveUrl, '_blank', 'noopener,noreferrer')}
                        className="gap-1.5 text-xs font-medium h-8"
                      >
                        <ExternalLink className="size-3.5 text-blue-600" />
                        Drive Link
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(note)}
                        className="gap-1.5 text-xs font-medium h-8"
                      >
                        <Download className="size-3.5 text-muted-foreground" />
                        Download
                      </Button>
                    )}
                  </div>

                  {/* AI Tutor & Quiz Row */}
                  {note.aiReady && (
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <Button
                        size="sm"
                        onClick={() => setTutorNote(note)}
                        className="gap-1.5 text-xs bg-primary text-primary-foreground font-semibold h-8 shadow-xs"
                      >
                        <Sparkles className="size-3.5" />
                        Ask AI Tutor
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setQuizNote(note)}
                        className="gap-1.5 text-xs font-semibold h-8 text-foreground"
                      >
                        <HelpCircle className="size-3.5 text-primary" />
                        Practice Quiz
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="p-4 bg-card rounded-2xl border border-border shadow-xs flex items-center justify-between text-xs text-muted-foreground">
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

      {/* Modals */}
      <DocumentPreviewModal
        note={previewNote}
        isOpen={!!previewNote}
        onClose={() => setPreviewNote(null)}
        onDownload={handleDownload}
      />

      <AITutorModal
        note={tutorNote}
        isOpen={!!tutorNote}
        onClose={() => setTutorNote(null)}
        onOpenQuiz={(n) => setQuizNote(n)}
      />

      <AIQuizModal
        note={quizNote}
        isOpen={!!quizNote}
        onClose={() => setQuizNote(null)}
      />
    </div>
  );
};

