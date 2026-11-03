import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  History,
  Sparkles,
  ListFilter,
  LayoutDashboard,
} from 'lucide-react';
import { CardSwipeAttendance } from '@/components/attendance/CardSwipeAttendance';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import { campusDay, readPacks, writePack } from '@/offline/attendance-store';
import type { AttendancePack } from '@/offline/attendance-store';
import { prepareAttendance } from '@/offline/attendance-sync';
import { OfflineAttendanceStatus, useOfflineAttendance } from '@/offline/AttendanceOfflineProvider';

export const MarkAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const offline = useOfflineAttendance();
  const [localPack, setLocalPack] = useState<AttendancePack | null>(null);
  const localPackRef = useRef<AttendancePack | null>(null);
  const persistence = useRef<Promise<void>>(Promise.resolve());
  const [saveError, setSaveError] = useState('');
  const outstandingWrites = useRef(0);
  const [savingLocally, setSavingLocally] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scheduleIdParam = searchParams.get('scheduleId');

  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);

  const [studentList, setStudentList] = useState<any[]>([]);
  const sessionRequestId = useRef(0);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // View Mode: Card Swipe (default) vs List View, persisted in localStorage
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    return (localStorage.getItem('inca_attendance_view_mode') as 'card' | 'list') || 'card';
  });

  const handleViewModeChange = (mode: 'card' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('inca_attendance_view_mode', mode);
  };

  // Attendance Session Modal State (opens modal on "Open Session" click)
  const [sessionModalOpen, setSessionModalOpen] = useState(false);

  // Audit Edit modal state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('PRESENT');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const attendanceLocked = activeSession?.status === 'SUBMITTED' || localPack?.state === 'pending' || localPack?.state === 'conflict';

  useEffect(() => {
    const latest = offline.packs.find(p => p.key === localPackRef.current?.key);
    if (!latest || latest.revision === localPackRef.current?.revision || ['ready', 'draft'].includes(latest.state)) return;
    localPackRef.current = latest; setLocalPack(latest);
    setActiveSession(latest.session); setAttendanceMap(latest.marks);
    if (latest.state === 'synced') setStatusMsg('Attendance uploaded and locked successfully.');
    if (latest.state === 'conflict') setStatusMsg(latest.error || 'Upload needs review. Your local copy is retained.');
  }, [offline.packs]);

  useEffect(() => {
    const preventUnsavedClose = (event: BeforeUnloadEvent) => {
      if (outstandingWrites.current > 0) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', preventUnsavedClose);
    return () => window.removeEventListener('beforeunload', preventUnsavedClose);
  }, []);

  // Serialize durable writes so fast swipes cannot reorder or lose marks.
  const saveDraft = (marks: typeof attendanceMap) => {
    outstandingWrites.current++; setSavingLocally(true);
    persistence.current = persistence.current.then(async () => {
      const pack = localPackRef.current;
      if (!pack || ['pending', 'synced', 'conflict'].includes(pack.state)) return;
      const next = await writePack({ ...pack, marks, state: 'draft', error: undefined }, pack.revision);
      localPackRef.current = next; setLocalPack(next); setSaveError('');
    }).catch((e: any) => { setSaveError(e.message); }).finally(() => { outstandingWrites.current--; if (!outstandingWrites.current) setSavingLocally(false); });
  };

  useEffect(() => {
    fetchTodaySchedules();
  }, []);

  const fetchTodaySchedules = async () => {
    setIsLoading(true);
    try {
      setScheduleError(null);
      const response = await api.get('/schedules/today', { timeout: 20_000 });
      const data: any[] = response.data.data || [];
      if (scheduleIdParam && !data.some(schedule => schedule.id === scheduleIdParam)) {
        const requested = await api.get(`/schedules/${encodeURIComponent(scheduleIdParam)}`);
        if (requested.data?.data) data.push(requested.data.data);
      }
      setSelectedSchedule(null);
      setSchedules(data);
      if (data.length > 0) {
        setSelectedSchedule(data[0]);
        if (scheduleIdParam) {
          const match = data.find((s: any) => s.id === scheduleIdParam);
          if (match) {
            handleOpenSession(match);
          }
        }
      }
    } catch (err: any) {
      const cached = user && (!err.response || err.response.status >= 500) ? (await readPacks(user.id).catch(() => [])).filter(p => p.day === campusDay()) : [];
      setSchedules(cached.map(p => p.schedule));
      setSelectedSchedule(null);
      setScheduleError(cached.length ? null : err.response?.data?.message || 'No prepared classes are available. Connect to load the requested lecture.');
      console.error('Failed to load today schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Open session & fetch students for selected schedule, opening the modal
  const handleOpenSession = async (schedule: any) => {
    await persistence.current;
    const requestId = ++sessionRequestId.current;
    setSelectedSchedule(schedule);
    setActiveSession(null);
    setStudentList([]);
    setAttendanceMap({});
    setLocalPack(null); localPackRef.current = null; setSaveError('');
    setIsLoading(true);
    setStatusMsg(null);
    setSessionModalOpen(true);
    try {
      if (!user) throw new Error('Sign in to prepare attendance.');
      let pack: AttendancePack;
      try {
        const stored = (await readPacks(user.id)).find(p => p.schedule.id === schedule.id && p.day === campusDay());
        pack = stored && ['draft', 'pending', 'conflict'].includes(stored.state) ? stored : await prepareAttendance(user.id, schedule);
      } catch (error: any) {
        // Authorization failures are never replaced by an old authorized roster.
        if (error.response && error.response.status < 500) throw error;
        const cached = (await readPacks(user.id)).find(p => p.schedule.id === schedule.id && p.day === campusDay());
        if (!cached) throw new Error('This class is not prepared on this device. Connect and prepare it first.');
        pack = cached;
      }
      if (requestId !== sessionRequestId.current) return;
      localPackRef.current = pack; setLocalPack(pack);
      setActiveSession(pack.session); setStudentList(pack.students); setAttendanceMap(pack.marks);
      if (pack.students.length === 0) setStatusMsg('No active students are enrolled in this lecture section.');
    } catch (err: any) {
      if (requestId !== sessionRequestId.current) return;
      setActiveSession(null);
      setStudentList([]);
      setAttendanceMap({});
      setStatusMsg(err.response?.data?.message || 'Unable to load this session and its roster.');
    } finally {
      if (requestId === sessionRequestId.current) setIsLoading(false);
    }
  };

  const setStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
    if (isSubmitting || attendanceLocked) return;
    const next = { ...attendanceMap, [studentId]: status };
    setAttendanceMap(next); saveDraft(next);
  };

  const bulkMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    if (isSubmitting || attendanceLocked) return;
    const updated: Record<string, any> = {};
    studentList.forEach((s) => (updated[s.id] = status));
    setAttendanceMap(updated);
    saveDraft(updated);
  };

  const handleSubmitAttendance = async () => {
    if (!activeSession || attendanceLocked || isLoading || isSubmitting || studentList.length === 0) return;
    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await persistence.current;
      const pack = localPackRef.current;
      if (!pack) throw new Error('No prepared class is available. Reopen this class.');
      const pending = await writePack({ ...pack, marks: attendanceMap, state: 'pending', error: undefined }, pack.revision);
      localPackRef.current = pending; setLocalPack(pending); setSaveError('');
      setStatusMsg('Attendance saved on this device. Waiting for cloud confirmation.');
      if (navigator.onLine) await offline.sync();

      // Invalidate dashboard and reporting caches
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });

    } catch (err: any) {
      setSaveError(err.message || 'Attendance could not be saved. Keep this screen open and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmittedRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !user) return;
    if (!editReason.trim()) { setEditError('Enter a reason for this correction.'); return; }
    setIsSubmitting(true);
    setEditError(null);

    try {
      const response = await api.patch(`/attendance/records/${editingRecord.id}/edit`, {
        newStatus: editStatus,
        reason: editReason.trim(),
      });
      const updated = response.data.data.record;
      const pack = localPackRef.current;
      if (pack) {
        const next = await writePack({ ...pack, marks: { ...pack.marks, [updated.studentId]: updated.status }, session: { ...pack.session, records: pack.session.records.map((record: any) => record.id === updated.id ? updated : record) } }, pack.revision);
        localPackRef.current = next; setLocalPack(next);
      }
      setAttendanceMap(previous => ({ ...previous, [updated.studentId]: updated.status }));
      setActiveSession((previous: any) => ({ ...previous, records: previous.records.map((record: any) => record.id === updated.id ? updated : record) }));

      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });

      setStatusMsg(`✅ Record updated to ${editStatus} with audit entry!`);
      setAuditModalOpen(false);
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Edit window expired or unauthorized.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">
            ASSAM Attendance Suite
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink mt-0.5">Take Attendance</h1>
          <p className="text-xs text-muted-foreground">Mobile-optimised smart card-swipe & list attendance marking</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="rounded-full text-xs h-8.5 px-4 gap-1.5 font-semibold"
        >
          <LayoutDashboard className="h-3.5 w-3.5 text-action-blue" />
          Faculty Desk
        </Button>
      </div>

      <OfflineAttendanceStatus />
      {/* Today's Detected Lectures */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Scheduled Lectures
        </h2>
        {isLoading && !activeSession ? (
          <div className="text-sm text-muted-foreground">Loading schedules...</div>
        ) : scheduleError ? (
          <Card className="p-8 text-center space-y-3"><p role="alert">{scheduleError}</p><Button onClick={fetchTodaySchedules}>Retry</Button></Card>
        ) : schedules.length === 0 ? (
          <Card className="p-8 text-center bg-muted/30 border-dashed space-y-3 max-w-md mx-auto">
            <div className="text-sm text-muted-foreground font-medium">
              No classes scheduled for today.
            </div>

          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schedules.map((sch) => (
              <Card
                key={sch.id}
                className="cursor-pointer transition-all hover:border-primary/60 hover:shadow-md border-border"
                onClick={() => handleOpenSession(sch)}
              >
                <CardHeader className="pb-2 pt-4 px-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      {sch.template?.subject?.code || 'CLASS'}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {sch.template?.startTime || '09:00'} - {sch.template?.endTime || '10:00'}
                    </span>
                  </div>
                  <CardTitle className="text-base leading-tight">
                    {sch.template?.subject?.name || 'Lecture'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3 mt-1">
                    <span>Section {sch.template?.section?.name || 'A'} • Room {sch.template?.room?.code || '101'}</span>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSession(sch);
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Open Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Attendance Marking Feature Dialog / Modal */}
      <Dialog open={sessionModalOpen} onOpenChange={setSessionModalOpen}>
        <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 border-border bg-background shadow-2xl overflow-hidden rounded-2xl">
          <DialogHeader className="p-5 border-b bg-muted/20 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Badge variant={attendanceLocked ? 'secondary' : 'default'}>
                    {localPack?.state === 'pending' ? 'Saved locally · awaiting upload' : localPack?.state === 'conflict' ? 'Needs review' : activeSession?.status === 'SUBMITTED' ? 'Uploaded · locked' : 'Open Session'}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground font-mono">
                    {selectedSchedule?.template?.startTime || '09:00'} - {selectedSchedule?.template?.endTime || '10:00'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    • Section {selectedSchedule?.template?.section?.name || 'A'} • Room {selectedSchedule?.template?.room?.code || '101'}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold leading-tight">
                  {selectedSchedule?.template?.subject?.name || 'Selected Lecture'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Course Code: <span className="font-mono font-medium">{selectedSchedule?.template?.subject?.code || 'CLASS'}</span> • {studentList.length} Students Enrolled
                </DialogDescription>
              </div>

              {/* View Mode Toggle: Card Swipe (Default) vs List View */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex bg-secondary/80 p-1 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('card')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      viewMode === 'card'
                        ? 'bg-card text-foreground shadow-xs border border-border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Card Swipe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('list')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      viewMode === 'list'
                        ? 'bg-card text-foreground shadow-xs border border-border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5 text-primary" />
                    <span>List View</span>
                  </button>
                </div>

                {/* Quick Bulk Action Buttons in List view */}
                {viewMode === 'list' && !attendanceLocked && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bulkMarkAll('PRESENT')}
                      className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-xs h-8"
                    >
                      All Present
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bulkMarkAll('ABSENT')}
                      className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs h-8"
                    >
                      All Absent
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {localPack && <p role="status" className="text-xs text-muted-foreground">{localPack.state === 'synced' ? 'Cloud upload confirmed.' : localPack.state === 'pending' ? 'Saved on this device. Waiting for cloud upload.' : localPack.state === 'conflict' ? localPack.error : `Roster saved on this device · ${new Date(localPack.savedAt).toLocaleTimeString()}. Changes are saved locally.`}</p>}
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
            {savingLocally && <p role="status" className="text-xs text-muted-foreground">Saving changes on this device…</p>}
            {statusMsg && (
              <div className="p-3 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">
                {statusMsg}
                {user?.role.code === 'FACULTY' && selectedSchedule && <Button variant="link" className="block px-0" onClick={() => navigate(`/attendance/late-approvals?scheduleId=${encodeURIComponent(selectedSchedule.id)}`)}>Open late attendance requests</Button>}
              </div>
            )}

            {/* View Mode Switching: Card Swipe (Default) or List View */}
            {viewMode === 'card' ? (
              <CardSwipeAttendance
                studentList={studentList}
                attendanceMap={attendanceMap}
                onMarkStatus={setStudentStatus}
                isLocked={attendanceLocked}
                lockedMessage={localPack?.state === 'pending' ? 'Saved locally · waiting for upload' : localPack?.state === 'conflict' ? 'Upload needs review' : 'Uploaded & locked'}
                onSubmit={handleSubmitAttendance}
                isSubmitting={isSubmitting}
                onReloadStudents={() => {
                  if (selectedSchedule && !isLoading) void handleOpenSession(selectedSchedule);
                }}
              />
            ) : (
              /* Traditional Student List View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Student List ({studentList.length})
                  </h3>
                  <span className="text-xs text-muted-foreground font-medium">
                    <span className="text-emerald-600 font-semibold">{Object.values(attendanceMap).filter((s) => s === 'PRESENT').length}</span> Present •{' '}
                    <span className="text-rose-600 font-semibold">{Object.values(attendanceMap).filter((s) => s === 'ABSENT').length}</span> Absent
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {studentList.map((student) => {
                    const currentStatus = attendanceMap[student.id] || 'PRESENT';
                    return (
                      <div
                        key={student.id}
                        className="p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm overflow-hidden border border-border">
                            {student.photoKey ? (
                              <img
                                src={`/api/v1/students/photo/stream?key=${encodeURIComponent(student.photoKey)}`}
                                alt={student.firstName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              `${student.firstName[0]}${student.lastName ? student.lastName[0] : ''}`
                            )}
                          </div>
                          <div className="min-w-0 break-words">
                            <h4 className="font-semibold text-sm">
                              {student.firstName} {student.lastName || ''}
                            </h4>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              Roll: {student.rollNumber} • ID: {student.collegeId}
                            </p>
                          </div>
                        </div>

                        {/* Quick Status Buttons */}
                        {!attendanceLocked ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setStudentStatus(student.id, 'PRESENT')}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 border ${
                                currentStatus === 'PRESENT'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-background hover:bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Present
                            </button>
                            <button
                              type="button"
                              onClick={() => setStudentStatus(student.id, 'ABSENT')}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 border ${
                                currentStatus === 'ABSENT'
                                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                  : 'bg-background hover:bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" /> Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => setStudentStatus(student.id, 'LATE')}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 border ${
                                currentStatus === 'LATE'
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                  : 'bg-background hover:bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" /> Late
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                currentStatus === 'PRESENT'
                                  ? 'outline'
                                  : currentStatus === 'ABSENT'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                              className={currentStatus === 'PRESENT' ? 'text-emerald-600 border-emerald-500/40 bg-emerald-500/10' : ''}
                            >
                              {currentStatus}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isSubmitting || activeSession.status !== 'SUBMITTED' || !activeSession.records?.some((record: any) => record.studentId === student.id)}
                              onClick={() => {
                                const record = activeSession.records?.find((record: any) => record.studentId === student.id);
                                if (!record) return;
                                setEditingRecord({ ...record, student });
                                setEditStatus(record.status);
                                setEditReason('');
                                setEditError(null);
                                setAuditModalOpen(true);
                              }}
                              className="h-7 px-2 text-xs"
                            >
                              <History className="w-3.5 h-3.5 mr-1.5" /> Edit (24h)
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!attendanceLocked && (
                  <div className="pt-4 border-t flex justify-end">
                    <Button
                      size="lg"
                      onClick={handleSubmitAttendance}
                      disabled={isSubmitting || isLoading || !activeSession || studentList.length === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isSubmitting ? "Submitting..." : "Submit & Lock Attendance"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 24-Hour Audit Edit Modal */}
      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Submitted Attendance</DialogTitle>
            <DialogDescription>
              Modifying attendance for <span className="font-semibold text-foreground">{editingRecord?.student?.firstName} {editingRecord?.student?.lastName}</span>. All changes are immutably logged with your User ID and reason.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleEditSubmittedRecord} className="space-y-6 pt-2">
            {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
            <div className="space-y-2">
              <Label>New Status</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setEditStatus(st)}
                    aria-pressed={editStatus === st}
                    className={`py-2 text-xs font-medium rounded-md border transition-all ${
                      editStatus === st
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Correction</Label>
              <textarea
                id="reason"
                required
                rows={3}
                placeholder="e.g. Student arrived late due to bus delay..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAuditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save & Log Audit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
