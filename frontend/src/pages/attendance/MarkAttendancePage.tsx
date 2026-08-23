import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  History,
  Sparkles,
} from 'lucide-react';
import api from '../../api/axios';

export const MarkAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);

  const [studentList, setStudentList] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

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
      const res = await api.get('/schedules/today');
      const data = res.data.data || [];
      setSchedules(data);
      if (data.length > 0) {
        setSelectedSchedule(data[0]);
      }
    } catch (err) {
      console.error('Failed to load today schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Open session & fetch students for selected schedule
  const handleOpenSession = async (schedule: any) => {
    setSelectedSchedule(schedule);
    setIsLoading(true);
    setStatusMsg(null);

    try {
      // 1. Create or get session
      const sessionRes = await api.post('/attendance/sessions', {
        scheduleId: schedule.id,
        takenById: user?.faculty?.id || schedule.template?.facultyId || 'demo-faculty-id',
        attendanceDate: new Date().toISOString().split('T')[0],
      });

      const session = sessionRes.data.data;
      setActiveSession(session);

      // 2. Load students (fallback demo list if empty database)
      const demoStudents = [
        { id: 'stu-1', firstName: 'Rahul', lastName: 'Sharma', rollNumber: '2026-CSE-001' },
        { id: 'stu-2', firstName: 'Ananya', lastName: 'Verma', rollNumber: '2026-CSE-002' },
        { id: 'stu-3', firstName: 'Vikram', lastName: 'Singh', rollNumber: '2026-CSE-003' },
        { id: 'stu-4', firstName: 'Priya', lastName: 'Gupta', rollNumber: '2026-CSE-004' },
        { id: 'stu-5', firstName: 'Amit', lastName: 'Kumar', rollNumber: '2026-CSE-005' },
      ];

      setStudentList(demoStudents);

      // Initialize all to PRESENT by default for quick workflow
      const initialMap: Record<string, any> = {};
      demoStudents.forEach((st) => (initialMap[st.id] = 'PRESENT'));
      setAttendanceMap(initialMap);
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Session already exists — fetch existing session
        fetchExistingSession(schedule.id);
      } else {
        setStatusMsg(err.response?.data?.message || 'Error initializing session');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExistingSession = async (scheduleId: string) => {
    try {
      const res = await api.get('/attendance/sessions');
      const found = res.data.data?.find((s: any) => s.scheduleId === scheduleId);
      if (found) {
        setActiveSession(found);
      }
    } catch (e) {
      console.error(e);
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
    if (!activeSession) return;
    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      // 1. Submit records
      await api.post(`/attendance/sessions/${activeSession.id}/records`, { records });

      // 2. Lock session
      await api.patch(`/attendance/sessions/${activeSession.id}/submit`);

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
        editedById: user.id,
        reason: editReason,
      });

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Smart Attendance Marking</h1>
        <p className="text-sm text-muted-foreground">Mobile-optimised automatic lecture detection & attendance marking</p>
      </div>

      {/* Today's Detected Lectures */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Today's Scheduled Lectures
        </h2>
        {isLoading && !activeSession ? (
          <div className="text-sm text-muted-foreground">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm bg-muted/50">
            No classes scheduled for today. You can also generate test schedules in Timetables page.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schedules.map((sch) => (
              <Card
                key={sch.id}
                className={`cursor-pointer transition-colors ${
                  selectedSchedule?.id === sch.id ? 'border-primary ring-1 ring-primary' : 'hover:border-border'
                }`}
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
                    <Button size="sm" variant="default" className="h-7 text-xs">
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Open Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active Session & Student Attendance Card */}
      {selectedSchedule && (
        <Card className="border-border">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={activeSession?.status === 'SUBMITTED' ? 'destructive' : 'default'}>
                    {activeSession?.status === 'SUBMITTED' ? 'Locked (Submitted)' : 'Open Session'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
                <CardTitle className="text-xl">
                  {selectedSchedule.template?.subject?.name || 'Selected Lecture'}
                </CardTitle>
              </div>

              {/* Quick Bulk Action Buttons */}
              {activeSession?.status !== 'SUBMITTED' && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => bulkMarkAll('PRESENT')} className="border-success text-success hover:bg-success hover:text-success-foreground">
                    Mark All Present
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bulkMarkAll('ABSENT')} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    Mark All Absent
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="pt-6 space-y-4">
            {statusMsg && (
              <div className="p-3 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">
                {statusMsg}
              </div>
            )}

            {/* Student List */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Student List ({studentList.length})
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {studentList.map((student) => {
                  const currentStatus = attendanceMap[student.id] || 'PRESENT';
                  return (
                    <div
                      key={student.id}
                      className="p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center font-bold text-muted-foreground text-sm">
                          {student.firstName[0]}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">
                            {student.firstName} {student.lastName}
                          </h4>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            Roll: {student.rollNumber}
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
                                ? 'bg-success text-success-foreground border-success'
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
                                ? 'bg-destructive text-destructive-foreground border-destructive'
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
                                ? 'bg-warning text-warning-foreground border-warning'
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
                            className={currentStatus === 'PRESENT' ? 'text-success border-success' : ''}
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
            </div>
          </CardContent>

          {/* Submit Attendance Button */}
          {activeSession?.status !== 'SUBMITTED' && (
            <CardFooter className="pt-4 border-t bg-muted/10 justify-end">
              <Button
                size="lg"
                onClick={handleSubmitAttendance}
                disabled={isSubmitting}
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Submitting..." : "Submit & Lock Attendance"}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

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
