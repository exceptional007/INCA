import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  UserCheck,
  GraduationCap,
  Lock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import api from '@/api/axios';
import { useNavigate } from 'react-router-dom';

interface StudentRow {
  id: string;
  rollNumber: string;
  collegeId: string;
  firstName: string;
  lastName?: string;
  photoKey?: string;
  currentStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

interface DemoAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId?: string;
  scheduleId?: string;
  sectionId?: string;
  lectureDetails?: {
    subjectName?: string;
    subjectCode?: string;
    facultyName?: string;
    roomNumber?: string;
    startTime?: string;
    endTime?: string;
    sectionName?: string;
  };
  onSuccess?: () => void;
}

export const DemoAttendanceModal: React.FC<DemoAttendanceModalProps> = ({
  open,
  onOpenChange,
  slotId,
  scheduleId,
  sectionId,
  lectureDetails,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      initSession();
    } else {
      setSubmitted(false);
      setErrorMessage(null);
    }
  }, [open, slotId, scheduleId, sectionId]);

  const initSession = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSubmitted(false);
    try {
      const res = await api.post('/admin/timetable-imports/test-lecture-session', {
        slotId,
        scheduleId,
        sectionId,
      });
      const data = res.data;
      setSessionData(data);
      const studentList: StudentRow[] = data.students || [];
      setStudents(studentList);

      const initialMap: Record<string, any> = {};
      studentList.forEach((st) => {
        initialMap[st.id] = st.currentStatus || 'PRESENT';
      });
      setAttendanceMap(initialMap);
      if (data.session?.status === 'SUBMITTED') {
        setSubmitted(true);
      }
    } catch (err: any) {
      console.error('Failed to initialize demo lecture session:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to initialize demo session');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
    if (submitted) return;
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleBulk = (status: 'PRESENT' | 'ABSENT') => {
    if (submitted) return;
    const updated: Record<string, any> = {};
    students.forEach((s) => (updated[s.id] = status));
    setAttendanceMap(updated);
  };

  const handleSubmitAttendance = async () => {
    if (!sessionData?.session?.id) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      // 1. Submit records
      await api.post(`/attendance/sessions/${sessionData.session.id}/records`, { records });

      // 2. Lock & submit session
      await api.patch(`/attendance/sessions/${sessionData.session.id}/submit`);

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to submit attendance:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to save attendance records');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute live statistics
  const totalCount = students.length;
  const presentCount = Object.values(attendanceMap).filter((s) => s === 'PRESENT').length;
  const absentCount = Object.values(attendanceMap).filter((s) => s === 'ABSENT').length;
  const lateCount = Object.values(attendanceMap).filter((s) => s === 'LATE').length;
  const excusedCount = Object.values(attendanceMap).filter((s) => s === 'EXCUSED').length;
  const presentRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const lectureInfo = {
    subjectName:
      lectureDetails?.subjectName ||
      sessionData?.schedule?.template?.subject?.name ||
      'Machine Learning & Data Mining',
    subjectCode:
      lectureDetails?.subjectCode ||
      sessionData?.schedule?.template?.subject?.code ||
      'BCS-702',
    facultyName:
      lectureDetails?.facultyName ||
      (sessionData?.schedule?.template?.faculty
        ? `${sessionData.schedule.template.faculty.firstName} ${sessionData.schedule.template.faculty.lastName || ''}`
        : 'Prof. Faculty'),
    roomNumber:
      lectureDetails?.roomNumber ||
      sessionData?.schedule?.template?.room?.code ||
      'L-306',
    sectionName:
      lectureDetails?.sectionName ||
      sessionData?.schedule?.template?.section?.name ||
      'C',
    timeSlot:
      lectureDetails?.startTime && lectureDetails?.endTime
        ? `${lectureDetails.startTime} - ${lectureDetails.endTime}`
        : '09:05 AM - 09:55 AM (Live)',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  Test Lecture Attendance Demo
                  <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-primary/20">
                    Live Demo
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Simulate real-time student attendance marking for this scheduled lecture session.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Lecture Metadata Card */}
          <div className="p-3.5 rounded-lg bg-secondary/40 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-foreground text-sm">
                <GraduationCap className="w-4 h-4 text-primary" />
                {lectureInfo.subjectName} ({lectureInfo.subjectCode})
              </div>
              <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
                <span>Faculty: <strong className="text-foreground">{lectureInfo.facultyName}</strong></span>
                <span>•</span>
                <span>Section: <strong className="text-foreground">{lectureInfo.sectionName}</strong></span>
                <span>•</span>
                <span>Room: <strong className="text-foreground">{lectureInfo.roomNumber}</strong></span>
              </div>
            </div>
            <div className="flex sm:flex-col items-end gap-1 text-[11px]">
              <Badge variant="outline" className="bg-background text-foreground font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" /> {lectureInfo.timeSlot}
              </Badge>
              <span className="text-[10px] text-muted-foreground">Today's Session</span>
            </div>
          </div>

          {/* Live Attendance Stats Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-muted-foreground text-[11px] block">Present Rate</span>
                <span className="text-base font-bold text-emerald-500">{presentRate}%</span>
              </div>
              <div className="h-7 w-[1px] bg-border" />
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  {presentCount} Present
                </Badge>
                <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30">
                  {absentCount} Absent
                </Badge>
                {lateCount > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                    {lateCount} Late
                  </Badge>
                )}
                {excusedCount > 0 && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                    {excusedCount} Excused
                  </Badge>
                )}
              </div>
            </div>

            {!submitted && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulk('PRESENT')}
                  className="text-xs h-7 px-2.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30"
                >
                  All Present
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulk('ABSENT')}
                  className="text-xs h-7 px-2.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/30"
                >
                  All Absent
                </Button>
              </div>
            )}
          </div>

          {/* Success Banner if Submitted */}
          {submitted && (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Attendance session successfully saved and locked in the database!</span>
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px] flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> SUBMITTED
              </Badge>
            </div>
          )}

          {/* Enrolled Students Roster */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Enrolled Students ({students.length})
              </span>
              <span className="text-[11px]">Click status button to toggle</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <span>Loading real students from database...</span>
              </div>
            ) : students.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-md border border-dashed">
                No students found for this section.
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
                {students.map((student) => {
                  const status = attendanceMap[student.id] || 'PRESENT';
                  return (
                    <div
                      key={student.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                          {student.firstName[0]}
                          {student.lastName ? student.lastName[0] : ''}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-foreground">
                            {student.firstName} {student.lastName || ''}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                            <span>Roll: {student.rollNumber}</span>
                            <span>•</span>
                            <span>ID: {student.collegeId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Selector Pills */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={submitted}
                          onClick={() => handleStatusChange(student.id, 'PRESENT')}
                          className={`w-7 h-7 rounded text-[11px] font-bold transition-all ${
                            status === 'PRESENT'
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'bg-muted/60 hover:bg-emerald-500/20 text-muted-foreground'
                          }`}
                          title="Present"
                        >
                          P
                        </button>
                        <button
                          type="button"
                          disabled={submitted}
                          onClick={() => handleStatusChange(student.id, 'ABSENT')}
                          className={`w-7 h-7 rounded text-[11px] font-bold transition-all ${
                            status === 'ABSENT'
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'bg-muted/60 hover:bg-rose-500/20 text-muted-foreground'
                          }`}
                          title="Absent"
                        >
                          A
                        </button>
                        <button
                          type="button"
                          disabled={submitted}
                          onClick={() => handleStatusChange(student.id, 'LATE')}
                          className={`w-7 h-7 rounded text-[11px] font-bold transition-all ${
                            status === 'LATE'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-muted/60 hover:bg-amber-500/20 text-muted-foreground'
                          }`}
                          title="Late"
                        >
                          L
                        </button>
                        <button
                          type="button"
                          disabled={submitted}
                          onClick={() => handleStatusChange(student.id, 'EXCUSED')}
                          className={`w-7 h-7 rounded text-[11px] font-bold transition-all ${
                            status === 'EXCUSED'
                              ? 'bg-blue-500 text-white shadow-xs'
                              : 'bg-muted/60 hover:bg-blue-500/20 text-muted-foreground'
                          }`}
                          title="Excused"
                        >
                          E
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border bg-card flex flex-row items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            {submitted ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/attendance/mark');
                }}
                className="text-xs bg-primary text-primary-foreground flex items-center gap-1"
              >
                <span>Open Full Attendance Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitAttendance}
                disabled={submitting || loading || students.length === 0}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                    Saving...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    Submit & Lock Attendance
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
