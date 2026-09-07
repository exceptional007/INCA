import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { AlertCircle, Upload, History, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, GraduationCap } from 'lucide-react';
import api from '@/api/axios';
import { TimetableBatchList } from './components/TimetableBatchList';
import { TimetableReviewGrid } from './components/TimetableReviewGrid';
import { TimetableVersionHistory } from './components/TimetableVersionHistory';

export const TimetableImportPage: React.FC = () => {
  const [view, setView] = useState<'list' | 'upload' | 'review' | 'history'>('list');
  const [batches, setBatches] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
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

  // Polling state
  const [pollBatchId, setPollBatchId] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<string>('');
  const [pollProgress, setPollProgress] = useState(10);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    fetchBatches();
    fetchSections();
    fetchPrograms();
  }, []);

  // Polling effect
  useEffect(() => {
    let intervalId: any;
    if (pollBatchId) {
      intervalId = setInterval(async () => {
        try {
          const res = await api.get(`/admin/timetable-imports/${pollBatchId}`);
          const status = res.data.data.status;
          setPollStatus(status);
          
          if (status === 'UPLOADED') {
            setPollProgress(30);
          } else if (status === 'EXTRACTED') {
            setPollProgress(60);
          } else if (status === 'PENDING_REVIEW') {
            setPollProgress(100);
            setPollBatchId(null); // Stop polling
            fetchBatches();
            // Automatically open review
            handleSelectBatch(pollBatchId);
          } else if (status === 'EXTRACTION_FAILED') {
            setPollBatchId(null);
            setPollError(res.data.data.notes || 'AI vision extraction pipeline failed.');
            fetchBatches();
          }
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollBatchId]);

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
      setPollProgress(15);
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
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedBatchId) return;
    if (!selectedProgramId) {
      alert('Please select an academic program to link this timetable to.');
      return;
    }
    setIsCommitLoading(true);
    setConflicts([]);
    try {
      const res = await api.post(`/admin/timetable-imports/${selectedBatchId}/approve`, {
        programId: selectedProgramId,
      });
      if (res.data.success === false) {
        setConflicts(res.data.conflicts || []);
        setIsApproveModalOpen(false);
      } else {
        alert('Timetable batch successfully approved, linked to program, and scheduled!');
        setIsApproveModalOpen(false);
        setView('list');
        fetchBatches();
      }
    } catch (err: any) {
      alert(`Approval failed: ${err.response?.data?.message || 'Error occurred.'}`);
    } finally {
      setIsCommitLoading(false);
    }
  };

  const handleDiscardBatch = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to discard this batch? All parsed drafts will be deleted.')) {
      return;
    }
    try {
      await api.post(`/admin/timetable-imports/${batchId}/discard`);
      setView('list');
      fetchBatches();
    } catch (err) {
      console.error('Failed to discard batch', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      {view !== 'review' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Timetable PDF Import Pipeline</h1>
            <p className="text-sm text-muted-foreground">Automated AI extraction, match verification, and scheduling of academic master timetables.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-1.5" onClick={() => setView('history')}>
              <History className="w-4 h-4" /> Rollback / History
            </Button>
            {view === 'list' ? (
              <Button onClick={() => setView('upload')} className="flex items-center gap-1.5">
                <Upload className="w-4 h-4" /> Import New PDF
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setView('list')} className="flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back to Batches
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
        <Card className="max-w-md mx-auto text-center p-6 space-y-6">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">AI Parsing Pipeline Active</CardTitle>
            <CardDescription>Extracting grid nodes and matching entities...</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {pollError ? (
              <div className="space-y-4">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                <div className="text-sm font-bold text-destructive">Extraction Failed</div>
                <p className="text-xs text-muted-foreground">{pollError}</p>
                <Button variant="outline" onClick={() => { setPollBatchId(null); setView('list'); }}>
                  Dismiss
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold px-1">
                  <span>Status: <span className="uppercase text-primary font-mono">{pollStatus}</span></span>
                  <span>{pollProgress}%</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-300" style={{ width: `${pollProgress}%` }} />
                </div>
                
                <div className="text-xs text-muted-foreground animate-pulse">
                  {pollStatus === 'UPLOADED' && 'Analyzing image coordinates and reading page text...'}
                  {pollStatus === 'EXTRACTED' && 'Google Gemini running vision grid resolution...'}
                  {pollStatus === 'PENDING_REVIEW' && 'Finalizing fuzzy mappings againstSubjects, Faculty, and Rooms...'}
                </div>

                {duplicateWarning && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-left text-xs flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-bold">Duplicate Warning:</span> A batch with this exact file hash already exists. Continuing parsing version...
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
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
                          <span className="font-bold">{unassignedTeacherCount} lecture slot(s) have unassigned teachers.</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            They will be auto-assigned an auto-generated faculty profile, or you can cancel and assign teachers using the pencil icon on each card.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>All {currentSlots.length} lecture slots have registered teachers assigned.</span>
                      </div>
                    )}

                    {unassignedSubjectCount > 0 ? (
                      <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/30">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                        <div>
                          <span className="font-bold">{unassignedSubjectCount} lecture slot(s) have unmatched subjects.</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            These subjects will be auto-created under this program upon approval.
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
    </div>
  );
};
