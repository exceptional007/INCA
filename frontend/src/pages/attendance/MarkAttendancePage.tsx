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

export const MarkAttendancePage: React.FC = () => {
  const { user } = useAuth();
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

  useEffect(() => {
    fetchTodaySchedules();
  }, []);

  const fetchTodaySchedules = async () => {
    setIsLoading(true);
    try {
      setScheduleError(null);
      const response = await api.get('/schedules/today');
      const data: any[] = response.data.data || [];
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
    } catch (err) {
      setSchedules([]);
      setSelectedSchedule(null);
      setScheduleError('Could not load today’s classes. Please retry.');
      console.error('Failed to load today schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Open session & fetch students for selected schedule, opening the modal
  const handleOpenSession = async (schedule: any) => {
    const requestId = ++sessionRequestId.current;
    setSelectedSchedule(schedule);
    setActiveSession(null);
    setStudentList([]);
    setAttendanceMap({});
    setIsLoading(true);
    setStatusMsg(null);
    setSessionModalOpen(true);
    try {
      // 1. Create or get session
      const sessionRes = await api.post('/attendance/sessions', {
        scheduleId: schedule.id,
        attendanceDate: new Date().toISOString().split('T')[0],
      });

      const session = sessionRes.data.data;
      const rosterRes = await api.get(`/attendance/sessions/${session.id}/roster`);
      if (requestId !== sessionRequestId.current) return;
      const activeStudents: any[] = rosterRes.data.data;
      if (!Array.isArray(activeStudents)) throw new Error('Invalid attendance roster response.');
      setActiveSession(session);
      setStudentList(activeStudents);

      // Restore statuses only for students in the current, server-authorized roster.
      const initialMap: Record<string, any> = {};
      const savedRecords = new Map<string, any>((session.records || []).map((record: any) => [record.studentId, record.status]));
      activeStudents.forEach((st: any) => {
        initialMap[st.id] = savedRecords.get(st.id) || 'PRESENT';
      });
      setAttendanceMap(initialMap);
      if (activeStudents.length === 0) setStatusMsg('No active students are enrolled in this lecture section.');
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
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const bulkMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    const updated: Record<string, any> = {};
    studentList.forEach((s) => (updated[s.id] = status));
    setAttendanceMap(updated);
  };

  const handleSubmitAttendance = async () => {
    if (!activeSession || isLoading || isSubmitting || studentList.length === 0) return;
    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      const records = studentList.map(student => ({
        studentId: student.id,
        status: attendanceMap[student.id],
      }));

      // 1. Submit records
      await api.post(`/attendance/sessions/${activeSession.id}/records`, { records });

      // 2. Lock session
      await api.patch(`/attendance/sessions/${activeSession.id}/submit`);

      // Invalidate dashboard and reporting caches
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });

      setStatusMsg('✅ Attendance submitted and locked successfully!');
      setActiveSession((prev: any) => ({ ...prev, status: 'SUBMITTED' }));
    } catch (err: any) {
      setStatusMsg(err.response?.data?.message || 'Failed to submit attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmittedRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !user) return;
    setIsSubmitting(true);

    try {
      await api.patch(`/attendance/records/${editingRecord.id}/edit`, {
        newStatus: editStatus,
        reason: editReason,
      });

      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });

      setStatusMsg(`✅ Record updated to ${editStatus} with audit entry!`);
      setAuditModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Edit window expired or unauthorized.');
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

      {/* Today's Detected Lectures */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Today's Scheduled Lectures
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
                  <Badge variant={activeSession?.status === 'SUBMITTED' ? 'destructive' : 'default'}>
                    {activeSession?.status === 'SUBMITTED' ? 'Locked (Submitted)' : 'Open Session'}
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
                {viewMode === 'list' && activeSession?.status !== 'SUBMITTED' && (
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
            {statusMsg && (
              <div className="p-3 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">
                {statusMsg}
              </div>
            )}

            {/* View Mode Switching: Card Swipe (Default) or List View */}
            {viewMode === 'card' ? (
              <CardSwipeAttendance
                studentList={studentList}
                attendanceMap={attendanceMap}
                onMarkStatus={setStudentStatus}
                isLocked={activeSession?.status === 'SUBMITTED'}
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
                        <div className="flex items-center gap-3">
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
                          <div>
                            <h4 className="font-semibold text-sm">
                              {student.firstName} {student.lastName || ''}
                            </h4>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              Roll: {student.rollNumber} • ID: {student.collegeId}
                            </p>
                          </div>
                        </div>

                        {/* Quick Status Buttons */}
                        {activeSession?.status !== 'SUBMITTED' ? (
                          <div className="flex items-center gap-1.5">
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
                              onClick={() => {
                                setEditingRecord({ id: `rec-${student.id}`, student });
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

                {activeSession?.status !== 'SUBMITTED' && (
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
            <div className="space-y-2">
              <Label>New Status</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setEditStatus(st)}
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
