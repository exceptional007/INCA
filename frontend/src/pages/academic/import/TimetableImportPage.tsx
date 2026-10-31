import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertCircle,
  Upload,
  History,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  Clock,
  Loader2,
  Cpu,
  FileText,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { TimetableBatchList } from './components/TimetableBatchList';
import { TimetableReviewGrid } from './components/TimetableReviewGrid';
import { TimetableVersionHistory } from './components/TimetableVersionHistory';

export interface TimetableImportPageProps {
  embedded?: boolean;
}

export const TimetableImportPage: React.FC<TimetableImportPageProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'upload' | 'review' | 'history'>('list');
  const [batches, setBatches] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<any | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [discardBatchId, setDiscardBatchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Selection / Review Batch state
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [isCommitLoading, setIsCommitLoading] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // Polling & Progress State
  const [pollBatchId, setPollBatchId] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<string>('');
  const [pollError, setPollError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    fetchBatches();
    fetchSections();
    fetchPrograms();
  }, []);

  // 1-second elapsed timer during AI extraction
  useEffect(() => {
    let timer: any;
    if (pollBatchId) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [pollBatchId]);

  // Polling effect (1.8s interval for fast transition)
  useEffect(() => {
    let intervalId: any;
    if (pollBatchId) {
      intervalId = setInterval(async () => {
        try {
          const res = await api.get(`/admin/timetable-imports/${pollBatchId}`);
          const status = res.data.data.status;
          setPollStatus(status);

          if (status === 'PENDING_REVIEW') {
            setPollBatchId(null); // Stop polling
            toast.success('AI timetable extraction complete! Opening review grid.');
            fetchBatches();
            handleSelectBatch(pollBatchId);
          } else if (status === 'EXTRACTION_FAILED') {
            setPollBatchId(null);
            setPollError(res.data.data.notes || 'AI vision extraction pipeline failed.');
            toast.error('AI vision extraction failed. Please verify PDF format.');
            fetchBatches();
          }
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 1800);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollBatchId]);

  const ESTIMATED_TOTAL_SECONDS = 25;
  const estimatedRemaining = Math.max(1, ESTIMATED_TOTAL_SECONDS - elapsedSeconds);

  // Dynamic smoothly advancing progress percentage (no frozen 30%)
  const dynamicProgress = (() => {
    if (pollStatus === 'PENDING_REVIEW') return 100;
    if (pollStatus === 'EXTRACTED') {
      return Math.min(96, 82 + Math.floor((elapsedSeconds % 10) * 1.5));
    }
    // UPLOADED: smoothly advances from 15% to 80% over 24s
    const calculated = 15 + Math.min(65, Math.floor((elapsedSeconds / 24) * 65));
    return Math.min(calculated, 80);
  })();

  // Live dynamic status description
  const getDynamicSubstatus = () => {
    if (pollStatus === 'PENDING_REVIEW') {
      return 'Processing complete! Preparing visual grid review...';
    }
    if (pollStatus === 'EXTRACTED') {
      return 'AI extraction verified. Resolving faculty names, subjects, and classroom rooms...';
    }
    if (elapsedSeconds < 4) {
      return 'Uploading PDF document & verifying structural integrity...';
    }
    if (elapsedSeconds < 9) {
      return 'Extracting PDF text layer & calculating table coordinate bounds...';
    }
    if (elapsedSeconds < 16) {
      return 'Google Gemini 1.5 Vision analyzing weekly timetable matrix...';
    }
    if (elapsedSeconds < 22) {
      return 'Parsing daily slots, lecture timings, and section codes...';
    }
    return 'Matching extracted slots against academic database & checking conflicts...';
  };

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/timetable-imports');
      setBatches(response.data.data || []);
    } catch (error) {
      console.error('Failed to load batches', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await api.get('/academic/departments/sections');
      setSections(response.data.data || []);
    } catch (error) {
      console.error('Failed to load sections', error);
    }
  };

  const fetchPrograms = async () => {
    try {
      const response = await api.get('/academic/departments/programs');
      const progs = response.data.data || [];
      setPrograms(progs);
      if (progs.length > 0) {
        setSelectedProgramId((prev) => prev || progs[0].id);
      }
    } catch (error) {
      console.error('Failed to load programs', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setDuplicateWarning(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setPollError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/admin/timetable-imports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const { batchId, isDuplicate } = response.data;
      if (isDuplicate) {
        setDuplicateWarning(true);
      }
      
      setPollBatchId(batchId);
      setPollStatus('UPLOADED');
      setView('upload'); // Switch to processing screen
    } catch (error: any) {
      console.error('Failed to upload timetable', error);
      alert(error.response?.data?.message || 'Failed to upload timetable PDF.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectBatch = async (batchId: string) => {
    setSelectedBatchId(batchId);
    setIsLoading(true);
    setConflicts([]);
    try {
      const res = await api.get(`/admin/timetable-imports/${batchId}`);
      setSelectedBatch(res.data.data);
      setView('review');
    } catch (err) {
      console.error('Failed to load batch slots', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSlot = async (slotId: string, data: any) => {
    if (!selectedBatchId) return;
    try {
      await api.patch(`/admin/timetable-imports/${selectedBatchId}/slots/${slotId}`, data);
      await handleSelectBatch(selectedBatchId);
    } catch (err) {
      console.error('Failed to update slot', err);
    }
  };

  const handleAddSlot = async (data: any) => {
    if (!selectedBatchId) return;
    try {
      await api.post(`/admin/timetable-imports/${selectedBatchId}/slots`, data);
      await handleSelectBatch(selectedBatchId);
    } catch (err) {
      console.error('Failed to add slot', err);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!selectedBatchId) return;
    try {
      await api.delete(`/admin/timetable-imports/${selectedBatchId}/slots/${slotId}`);
      await handleSelectBatch(selectedBatchId);
    } catch (err) {
      console.error('Failed to delete slot', err);
    }
  };

  const handleApproveBatch = async () => {
    if (!selectedBatchId) return;
    setApproveError(null);
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedBatchId) return;
    if (!selectedProgramId) {
      setApproveError('Please select an academic program to link this timetable to.');
      toast.error('Please select an academic program to link this timetable to.');
      return;
    }
    setIsCommitLoading(true);
    setConflicts([]);
    setApproveError(null);
    try {
      const res = await api.post(`/admin/timetable-imports/${selectedBatchId}/approve`, {
        programId: selectedProgramId,
      });
      if (res.data.success === false) {
        setConflicts(res.data.conflicts || []);
        setIsApproveModalOpen(false);
        const conflictCount = res.data.conflicts?.length || 0;
        const sampleDetails = res.data.conflicts?.slice(0, 3).map((c: any) => `• ${c.message}`).join('\n') || '';
        toast.error(`Cannot approve timetable (${conflictCount} conflict(s)): ${sampleDetails}`);
      } else {
        setIsApproveModalOpen(false);
        // Authoritatively update selectedBatch status so review page reflects committed state
        setSelectedBatch((prev: any) => prev ? { ...prev, status: 'COMMITTED', committedAt: new Date().toISOString() } : null);
        // Invalidate queries so scheduling, dashboard, and reports pages reflect new timetable & schedules
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
        queryClient.invalidateQueries({ queryKey: ['reports'] });
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        queryClient.invalidateQueries({ queryKey: ['academic'] });

        const primarySecId = res.data.primarySectionId || selectedBatch?.slots?.[0]?.matchedSectionId;
        const primarySecName = res.data.primarySectionName || selectedBatch?.slots?.[0]?.matchedSection?.name || selectedBatch?.slots?.[0]?.sectionCodes?.[0] || 'C';
        const selectedProg = programs.find((p) => p.id === selectedProgramId);

        setSuccessModalData({
          batchId: selectedBatchId,
          primarySectionId: primarySecId,
          primarySectionName: primarySecName,
          totalSlots: res.data.totalSlots || selectedBatch?.slots?.length || 0,
          programName: selectedProg ? `[${selectedProg.code}] ${selectedProg.name}` : 'Academic Program',
        });
        setIsSuccessModalOpen(true);
        await fetchBatches();
      }
    } catch (err: any) {
      console.error('Approval failed:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error occurred during approval.';
      setApproveError(errMsg);
      toast.error(`Approval failed: ${errMsg}`);
    } finally {
      setIsCommitLoading(false);
    }
  };

  const handleDiscardBatch = async (batchId: string) => {
    setDiscardBatchId(batchId);
  };

  const handleConfirmDiscard = async () => {
    if (!discardBatchId) return;
    try {
      await api.post(`/admin/timetable-imports/${discardBatchId}/discard`);
      setDiscardBatchId(null);
      toast.success('Batch successfully discarded.');
      setView('list');
      fetchBatches();
    } catch (err) {
      console.error('Failed to discard batch', err);
      toast.error('Failed to discard batch.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      {view !== 'review' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {!embedded ? (
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Timetable PDF Import Pipeline</h1>
              <p className="text-sm text-muted-foreground">Automated AI extraction, match verification, and scheduling of academic master timetables.</p>
            </div>
          ) : (
            <div>
              <h3 className="text-base font-semibold text-foreground">Timetable Import Pipeline</h3>
              <p className="text-xs text-muted-foreground">Historical batch list, AI vision verification, and timetable scheduling.</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs h-8" onClick={() => setView('history')}>
              <History className="w-3.5 h-3.5" /> Rollback / History
            </Button>
            {view === 'list' ? (
              <Button size="sm" onClick={() => setView('upload')} className="flex items-center gap-1.5 text-xs h-8">
                <Upload className="w-3.5 h-3.5" /> Import New PDF
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setView('list')} className="flex items-center gap-1.5 text-xs h-8">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Batches
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main Views */}
      {view === 'list' && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between border-b">
            <div>
              <CardTitle>Historical Import Batches</CardTitle>
              <CardDescription>View, verify, and approve uploaded timetable sheets.</CardDescription>
            </div>
            <Button size="icon" variant="ghost" onClick={fetchBatches} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <TimetableBatchList
              batches={batches}
              onSelectBatch={handleSelectBatch}
              onDiscardBatch={handleDiscardBatch}
            />
          </CardContent>
        </Card>
      )}

      {view === 'upload' && !pollBatchId && (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Upload Timetable PDF</CardTitle>
            <CardDescription>Upload a Buddha Institute of Technology style weekly-grid timetable PDF sheet.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUploadSubmit} className="space-y-6">
              <div className="border-2 border-dashed border-muted rounded-xl p-8 text-center hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-3">
                <Upload className="w-8 h-8 text-muted-foreground/60" />
                <div className="text-sm font-medium text-foreground">
                  {file ? file.name : 'Click to select or drag PDF file here'}
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-file-upload"
                />
                <Button type="button" variant="secondary" onClick={() => document.getElementById('pdf-file-upload')?.click()}>
                  Browse Files
                </Button>
                <div className="text-[10px] text-muted-foreground">Supports PDF documents up to 10MB</div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setView('list')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!file || isUploading}>
                  {isUploading ? 'Uploading...' : 'Process Timetable'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Background Processing Progress view */}
      {view === 'upload' && pollBatchId && (
        <Card className="max-w-xl mx-auto p-6 sm:p-7 space-y-6 bg-card border-border shadow-md rounded-2xl">
          {pollError ? (
            <div className="space-y-4 text-center py-4">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto animate-bounce" />
              <div className="text-base font-bold text-destructive">AI Extraction Failed</div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{pollError}</p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={() => { setPollBatchId(null); setView('list'); }}>
                  Dismiss & Return to Batches
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Badges & Timers */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/70 pb-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold w-fit">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  AI VISION PIPELINE ACTIVE
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-foreground text-xs font-mono font-medium">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    Elapsed: {elapsedSeconds}s
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-mono font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    Est. Remaining: ~{estimatedRemaining}s
                  </div>
                </div>
              </div>

              {/* Title & Info */}
              <div className="text-left space-y-1">
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  Processing Timetable Sheet via Gemini AI
                </h3>
                <p className="text-xs text-muted-foreground">
                  Multimodal vision is recognizing grid columns, slot timings, and cross-matching faculty entities.
                </p>
              </div>

              {/* Dynamic Live Progress Bar */}
              <div className="space-y-2.5 bg-muted/30 p-4 rounded-xl border border-border/60">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-2 truncate pr-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                    <span className="truncate">{getDynamicSubstatus()}</span>
                  </span>
                  <span className="font-mono font-bold text-primary text-sm shrink-0">
                    {dynamicProgress}%
                  </span>
                </div>

                <div className="w-full bg-secondary/80 h-2.5 rounded-full overflow-hidden border border-border/40">
                  <div
                    className="bg-gradient-to-r from-primary via-blue-500 to-emerald-500 h-full transition-all duration-700 ease-out shadow-xs"
                    style={{ width: `${dynamicProgress}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                  <span>Batch ID: <span className="font-mono font-medium">{pollBatchId.slice(0, 12)}...</span></span>
                  <span>Average processing time: ~20–30s</span>
                </div>
              </div>

              {/* 4-Stage Visual Pipeline Checklist */}
              <div className="space-y-2 text-left pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pipeline Execution Stages
                </span>

                <div className="grid gap-2 text-xs pt-1">
                  {/* Stage 1 */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground">1. Document Upload & Security Check</div>
                      <div className="text-[11px] text-muted-foreground truncate">PDF format & MD5 checksum verified successfully</div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 font-mono">100%</span>
                  </div>

                  {/* Stage 2 */}
                  <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                    elapsedSeconds >= 4 || pollStatus === 'EXTRACTED'
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-primary/5 border-primary/20'
                  }`}>
                    {elapsedSeconds >= 4 || pollStatus === 'EXTRACTED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground">2. Text Coordinate & Layer Parsing</div>
                      <div className="text-[11px] text-muted-foreground truncate">Reading cell coordinates, day headers & slot periods</div>
                    </div>
                    <span className="text-[10px] font-bold font-mono text-muted-foreground">
                      {elapsedSeconds >= 4 ? 'Done' : 'Active'}
                    </span>
                  </div>

                  {/* Stage 3 */}
                  <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                    pollStatus === 'EXTRACTED' || elapsedSeconds >= 18
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : elapsedSeconds >= 4
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-muted/40 border-border/50 text-muted-foreground'
                  }`}>
                    {pollStatus === 'EXTRACTED' || elapsedSeconds >= 18 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : elapsedSeconds >= 4 ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <Cpu className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground">3. Google Gemini Vision Analysis</div>
                      <div className="text-[11px] text-muted-foreground truncate">Recognizing weekly days, periods, course codes & rooms</div>
                    </div>
                    <span className="text-[10px] font-bold font-mono text-muted-foreground">
                      {pollStatus === 'EXTRACTED' || elapsedSeconds >= 18 ? 'Done' : elapsedSeconds >= 4 ? 'Active' : 'Pending'}
                    </span>
                  </div>

                  {/* Stage 4 */}
                  <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                    pollStatus === 'PENDING_REVIEW'
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : pollStatus === 'EXTRACTED' || elapsedSeconds >= 18
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-muted/40 border-border/50 text-muted-foreground'
                  }`}>
                    {pollStatus === 'PENDING_REVIEW' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : pollStatus === 'EXTRACTED' || elapsedSeconds >= 18 ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground">4. Entity Resolution & Conflict Matching</div>
                      <div className="text-[11px] text-muted-foreground truncate">Mapping faculty names, subject IDs & checking conflicts</div>
                    </div>
                    <span className="text-[10px] font-bold font-mono text-muted-foreground">
                      {pollStatus === 'PENDING_REVIEW' ? 'Done' : pollStatus === 'EXTRACTED' || elapsedSeconds >= 18 ? 'Active' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Duplicate Warning banner if triggered */}
              {duplicateWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-xl text-left text-xs flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Duplicate Notice:</span> A batch with this exact PDF file hash already exists in the system. Parsing is proceeding for this new import session.
                  </div>
                </div>
              )}

              {/* Non-Stuck Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/70">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setView('list');
                    toast.info('AI vision pipeline is continuing in background.');
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto"
                >
                  Browse Batches (Run in Background)
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPollBatchId(null);
                    setView('list');
                  }}
                  className="text-xs w-full sm:w-auto"
                >
                  Cancel / Return
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {view === 'review' && selectedBatch && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setView('list')} className="mr-2">
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
              </Button>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Review Timetable: Batch {selectedBatch.id.substring(0, 8)}...</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>Uploaded {new Date(selectedBatch.createdAt).toLocaleString()}</span>
                  <span>•</span>
                  <span>Status: <span className="font-bold font-mono text-primary">{selectedBatch.status}</span></span>
                </p>
              </div>
            </div>

            {selectedBatch.status === 'PENDING_REVIEW' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => handleDiscardBatch(selectedBatch.id)}>
                  Discard
                </Button>
                <Button onClick={handleApproveBatch} disabled={isCommitLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {isCommitLoading ? 'Scheduling...' : 'Approve & Schedule'}
                </Button>
              </div>
            )}
          </div>

          <TimetableReviewGrid
            batchId={selectedBatch.id}
            slots={selectedBatch.slots}
            pages={selectedBatch.pagesJson || []}
            onUpdateSlot={handleUpdateSlot}
            onAddSlot={handleAddSlot}
            onDeleteSlot={handleDeleteSlot}
            onApprove={handleApproveBatch}
            isApproving={isCommitLoading}
            conflicts={conflicts}
          />
        </div>
      )}

      {view === 'history' && (
        <TimetableVersionHistory
          sections={sections}
          onBack={() => setView('list')}
        />
      )}

      {/* Approval & Program Linking Dialog */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <GraduationCap className="w-5 h-5 text-primary" />
              Approve & Link Timetable to Program
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select the academic program to link this timetable's sections, and review scheduling readiness.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Inline Error Banner */}
            {approveError && (
              <div className="flex items-start gap-2 bg-destructive/10 text-destructive border border-destructive/20 p-2.5 rounded-lg text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{approveError}</span>
              </div>
            )}

            {/* Program Selection Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Target Academic Program <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Select program to link..." />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((prog) => (
                    <SelectItem key={prog.id} value={prog.id} className="text-xs">
                      <span className="font-mono font-bold text-primary mr-1.5">[{prog.code}]</span>
                      <span className="font-medium">{prog.name}</span>
                      {prog.department?.shortName && (
                        <span className="text-muted-foreground text-[10px] ml-1.5">
                          ({prog.department.shortName})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Sections and versions will be registered under this program's semester structure.
              </p>
            </div>

            {/* Pre-Approval Audit Summary */}
            {(() => {
              const currentSlots = selectedBatch?.slots || [];
              const unassignedTeacherCount = currentSlots.filter(
                (s: any) => !s.facultyRaw || s.facultyRaw.trim() === '' || s.facultyRaw.toLowerCase().includes('unassigned') || !s.matchedFacultyId,
              ).length;
              const unassignedSubjectCount = currentSlots.filter(
                (s: any) => !s.subjectRaw || s.subjectRaw.trim() === '' || s.subjectRaw.toLowerCase().includes('unassigned') || !s.matchedSubjectId,
              ).length;

              return (
                <div className="border border-border/80 rounded-lg p-3 bg-muted/20 space-y-2.5 text-xs">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>Timetable Readiness Summary</span>
                    <span className="text-muted-foreground font-mono">{currentSlots.length} Total Slots</span>
                  </div>

                  <div className="space-y-2">
                    {unassignedTeacherCount > 0 ? (
                      <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded border border-amber-500/30">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                        <div>
                          <span className="font-bold">{unassignedTeacherCount} lecture slot(s) require teacher assignment.</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Please ensure all teachers are mapped to active faculty records using the pencil icon on each card before committing.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>All {currentSlots.length} lecture slots have verified teachers assigned.</span>
                      </div>
                    )}

                    {unassignedSubjectCount > 0 ? (
                      <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/30">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                        <div>
                          <span className="font-bold">{unassignedSubjectCount} lecture slot(s) have unmatched subjects.</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Please map these slots to approved subjects in the Academic catalog using the edit card action before approving.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>All subjects are verified and matched in the curriculum.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsApproveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmApprove}
              disabled={!selectedProgramId || isCommitLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isCommitLoading ? 'Committing Schedule...' : 'Confirm & Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commitment Success Modal replacing native browser alert */}
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <div className="flex flex-col items-center text-center p-2">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3 ring-8 ring-emerald-500/5">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <DialogTitle className="text-lg font-bold text-foreground">
              Timetable Successfully Approved & Scheduled!
            </DialogTitle>

            <DialogDescription className="text-xs text-muted-foreground mt-1.5 max-w-sm">
              The timetable has been verified and registered as the active semester version. Daily classroom lecture sessions have been generated automatically.
            </DialogDescription>

            {successModalData && (
              <div className="w-full bg-secondary/40 rounded-xl p-3.5 border border-border mt-4 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Academic Program:</span>
                  <span className="font-semibold text-foreground text-right">{successModalData.programName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Master Section:</span>
                  <span className="font-bold text-primary font-mono">Section {successModalData.primarySectionName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Total Slots Scheduled:</span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 font-mono text-[11px] border-emerald-500/30">
                    {successModalData.totalSlots} Lecture Slots
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Daily Session Sync:</span>
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Synchronized Active
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5 w-full mt-6">
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setView('list');
                }}
              >
                Close & View Imports
              </Button>
              <Button
                type="button"
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  const targetSecId = successModalData?.primarySectionId;
                  if (embedded) {
                    setSearchParams(targetSecId ? { tab: 'schedules', sectionId: targetSecId } : {});
                  } else {
                    navigate(`/schedules${targetSecId ? `?sectionId=${targetSecId}` : ''}`);
                  }
                }}
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                View Timetable in Schedules
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation Dialog replacing native confirm */}
      <Dialog open={!!discardBatchId} onOpenChange={(open) => !open && setDiscardBatchId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Discard Timetable Batch?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Are you sure you want to discard this batch? All parsed drafts and slot records will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setDiscardBatchId(null)}>
              Keep Batch
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDiscard}>
              Discard Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
