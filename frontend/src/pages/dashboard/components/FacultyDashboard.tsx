import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import {
  Clock,
  CheckSquare,
  Loader2,
  CalendarX,
  RefreshCw,
  CalendarCheck2,
  Lock,
  AlertTriangle,
  Send,
  BookOpen,
  MapPin,
  GraduationCap,
  Users,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface LectureSession {
  id: string;
  course: string;
  code: string;
  timeSlot: string;
  room: string;
  semesterName?: string;
  batchOrSection?: string;
  lectureDate: string; // YYYY-MM-DD
  completed: boolean;
  scheduleRaw?: any;
}

interface AttendanceLog {
  id: string;
  course: string;
  code: string;
  date: string;
  present: number;
  total: number;
  sessionRaw?: any;
}

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'schedule' | 'logs'>('schedule');

  const getTodayDateStr = () => new Date().toISOString().split('T')[0];

  // Real data state
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  // Loading states
  const [isLoadingSchedules, setIsLoadingSchedules] = useState<boolean>(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  // Approval Request Modal state
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [targetSessionForApproval, setTargetSessionForApproval] = useState<LectureSession | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvedScheduleIds, setApprovedScheduleIds] = useState<Set<string>>(new Set());

  // Summary Modal state for past sessions
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summarySession, setSummarySession] = useState<any | null>(null);
  const [summaryRecords, setSummaryRecords] = useState<any[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Parse time helper: returns minutes from midnight for "09:00 AM"
  const parseTimeMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const match = timeStr.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const p = match[3];
    if (p === 'PM' && h < 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  // Determine time status of a lecture: 'PAST' | 'ACTIVE' | 'FUTURE'
  const getLectureTimeStatus = (sess: LectureSession): 'PAST' | 'ACTIVE' | 'FUTURE' => {
    const todayStr = getTodayDateStr();
    const lectureDateStr = sess.lectureDate ? sess.lectureDate.slice(0, 10) : todayStr;

    // Compare date portions
    if (lectureDateStr < todayStr) {
      return 'PAST';
    }
    if (lectureDateStr > todayStr) {
      return 'FUTURE';
    }

    // Same day: evaluate time windows
    const rawTemplate = sess.scheduleRaw?.template;
    const startTimeStr = rawTemplate?.startTime || '09:00 AM';
    const endTimeStr = rawTemplate?.endTime || '10:00 AM';

    const startMin = parseTimeMinutes(startTimeStr);
    const endMin = parseTimeMinutes(endTimeStr);

    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // 15-minute grace period after lecture end
    if (currentMin > endMin + 15) {
      return 'PAST';
    }
    if (currentMin < startMin - 10) {
      return 'FUTURE';
    }
    return 'ACTIVE';
  };

  // Fetch approved requests for this faculty user
  const fetchApprovedRequests = useCallback(async () => {
    try {
      const res = await api.get('/requests?status=APPROVED');
      const approvedList: any[] = res.data?.data || [];
      const set = new Set<string>();
      approvedList.forEach((r) => {
        // Details contain schedule ID or session link
        if (r.details) {
          const match = r.details.match(/Schedule ID:\s*([a-zA-Z0-9-]+)/i);
          if (match && match[1]) {
            set.add(match[1].trim());
          }
        }
      });
      setApprovedScheduleIds(set);
    } catch {
      // Quiet fail if requests endpoint error
    }
  }, []);

  // Fetch past attendance submission logs for this faculty
  const fetchPastLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await api.get('/attendance/sessions/my-sessions');
      const sessionList: any[] = res.data?.data || [];
      const formattedLogs: AttendanceLog[] = sessionList.map((s: any) => {
        const records = s.records || [];
        const presentCount = records.filter(
          (r: any) => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED'
        ).length;
        const totalCount = records.length;
        const dateStr = s.attendanceDate
          ? new Date(s.attendanceDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Recent';
        return {
          id: s.id,
          course: s.schedule?.template?.subject?.name || s.activity?.title || 'Class Session',
          code: s.schedule?.template?.subject?.code || 'GEN',
          date: dateStr,
          present: presentCount,
          total: totalCount,
          sessionRaw: s,
        };
      });
      setLogs(formattedLogs);
    } catch (err: any) {
      console.error('Failed to load past roster logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  // Fetch faculty-scoped today's schedules strictly for today
  const fetchTodaySchedules = useCallback(async () => {
    setIsLoadingSchedules(true);
    try {
      const todayStr = getTodayDateStr();
      let scheduleList: any[] = [];
      try {
        const res = await api.get(`/schedules/today?date=${todayStr}`);
        scheduleList = res.data?.data || [];
      } catch (e) {
        console.error('Failed to fetch today schedules:', e);
      }

      // Fetch completed attendance sessions to see which lectures have attendance logged
      let submittedSessionMap = new Map<string, any>();
      try {
        const mySessionsRes = await api.get('/attendance/sessions/my-sessions');
        const mySessions = mySessionsRes.data?.data || [];
        mySessions.forEach((s: any) => {
          if (s.scheduleId && s.status === 'SUBMITTED') {
            submittedSessionMap.set(s.scheduleId, s);
          }
        });
      } catch (e) {
        console.error('Failed to fetch my-sessions:', e);
      }

      // Map to LectureSession
      const mapped: LectureSession[] = scheduleList.map((sch: any) => {
        const template = sch.template;
        const startTime = template?.startTime || '09:00 AM';
        const endTime = template?.endTime || '10:00 AM';
        const room = template?.room?.code || template?.room?.name || 'Assigned Room';
        const course = template?.subject?.name || 'Class Session';
        const code = template?.subject?.code || 'GEN';
        const semesterName = template?.section?.semester?.name || `Sem ${template?.section?.semesterId?.slice(-2) || '1'}`;
        const batchOrSection = template?.section?.name ? `Sec ${template.section.name}` : undefined;
        const isCompleted = submittedSessionMap.has(sch.id);

        return {
          id: sch.id,
          course,
          code,
          timeSlot: `${startTime} - ${endTime}`,
          room,
          semesterName,
          batchOrSection,
          lectureDate: sch.lectureDate ? sch.lectureDate.slice(0, 10) : todayStr,
          completed: isCompleted,
          scheduleRaw: sch,
        };
      });

      setSessions(mapped);
    } catch (err: any) {
      console.error('Failed to load schedule:', err);
      toast.error(err.response?.data?.message || 'Failed to load schedule.');
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTodaySchedules();
    fetchPastLogs();
    fetchApprovedRequests();
  }, [fetchTodaySchedules, fetchPastLogs, fetchApprovedRequests]);

  // Navigate to Mark Attendance Page for active / approved lecture
  const handleTakeAttendance = (sess: LectureSession) => {
    navigate(`/attendance/mark?scheduleId=${encodeURIComponent(sess.id)}`);
  };

  // Open Approval Request dialog
  const handleRequestApproval = (sess: LectureSession) => {
    setTargetSessionForApproval(sess);
    setApprovalReason(
      `Permission requested to mark late/retrospective attendance for ${sess.course} (${sess.code}) scheduled on ${sess.lectureDate} (${sess.timeSlot}).`
    );
    setIsApprovalModalOpen(true);
  };

  // Submit approval request to Admin/HOD
  const handleSubmitApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSessionForApproval) return;
    setIsSubmittingApproval(true);
    try {
      const requesterName = user?.faculty?.firstName
        ? `Prof. ${user.faculty.firstName} ${user.faculty.lastName || ''} (${user.email})`
        : user?.email || 'Faculty Member';

      await api.post('/requests', {
        title: `Late Attendance Approval: ${targetSessionForApproval.course}`,
        details: `${approvalReason.trim()} [Schedule ID: ${targetSessionForApproval.id}]`,
        requester: requesterName,
      });

      toast.success('Approval request submitted to Admin / HOD.');
      setIsApprovalModalOpen(false);
      setTargetSessionForApproval(null);
      setApprovalReason('');
      fetchApprovedRequests();
    } catch (err: any) {
      console.error('Failed to submit approval request:', err);
      toast.error(err.response?.data?.message || 'Failed to submit approval request.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // View summary of completed session
  const handleViewSummary = async (sessionIdOrScheduleId: string) => {
    setIsLoadingSummary(true);
    setIsSummaryModalOpen(true);
    setSummarySession(null);
    setSummaryRecords([]);
    try {
      // Find session in my-sessions
      const mySessionsRes = await api.get('/attendance/sessions/my-sessions');
      const allSessions: any[] = mySessionsRes.data?.data || [];
      const match = allSessions.find(
        (s) => s.id === sessionIdOrScheduleId || s.scheduleId === sessionIdOrScheduleId
      );

      if (match) {
        setSummarySession(match);
        const recRes = await api.get(`/attendance/sessions/${match.id}/records`);
        setSummaryRecords(recRes.data?.data || []);
      } else {
        toast.error('Session details not found.');
        setIsSummaryModalOpen(false);
      }
    } catch (e: any) {
      console.error('Failed to load session summary:', e);
      toast.error('Could not fetch attendance summary.');
      setIsSummaryModalOpen(false);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const completedCount = sessions.filter((s) => s.completed).length;
  const pendingCount = sessions.length - completedCount;

  return (
    <div className="space-y-6 font-sans">
      {/* Title & Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">
            ASSAM Faculty Interface
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-ink mt-0.5">
            Faculty Member Desk
            {user?.faculty?.firstName ? ` — Prof. ${user.faculty.firstName} ${user.faculty.lastName || ''}`.trim() : ''}
          </h2>
          <p className="text-xs text-ink-muted-80">
            View assigned lectures, monitor attendance status, and take verified classroom attendance sessions.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/80 overflow-x-auto max-w-full scrollbar-none">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            My Assigned Schedule
          </button>
          <button
            onClick={() => {
              setActiveTab('logs');
              fetchPastLogs();
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Past Roster Logs
          </button>
        </div>
      </div>

      {/* --- Tab Content: My Schedule (Strictly Today's Lectures) --- */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Today's Lectures</span>
                <Clock className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">{sessions.length}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">
                  Assigned classroom session{sessions.length === 1 ? '' : 's'} today
                </p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Attendance Taken</span>
                <CalendarCheck2 className="h-4.5 w-4.5 text-emerald-600" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-emerald-600">{completedCount}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Attendance verified & submitted</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Pending Roster</span>
                <Badge variant={pendingCount > 0 ? 'outline' : 'secondary'} className="text-[10px] rounded-full">
                  {pendingCount > 0 ? `${pendingCount} Left` : 'All Done'}
                </Badge>
              </div>
              <div className="mt-4">
                <span className={`text-2xl font-semibold ${pendingCount > 0 ? 'text-action-blue' : 'text-ink-muted-48'}`}>
                  {pendingCount}
                </span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Requires attendance marking</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Roster History</span>
                <CheckSquare className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">{logs.length}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Total past sessions logged</p>
              </div>
            </Card>
          </div>

          {/* Assigned Classes List */}
          <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b mb-6">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Today's Class Schedule
                </h3>
                <p className="text-xs text-ink-muted-80 mt-0.5">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} &bull;{' '}
                  {sessions.length} lecture{sessions.length === 1 ? '' : 's'} assigned today &bull;{' '}
                  <span className="text-emerald-700 font-medium">{completedCount} Completed</span> &bull;{' '}
                  <span className="text-action-blue font-medium">{pendingCount} Pending</span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTodaySchedules}
                disabled={isLoadingSchedules}
                className="rounded-full h-8 text-xs px-3 self-start sm:self-auto"
              >
                {isLoadingSchedules ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Refresh
              </Button>
            </div>

            {isLoadingSchedules ? (
              <div className="flex flex-col items-center justify-center py-12 text-ink-muted-80 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-action-blue" />
                <span className="text-xs">Loading today's assigned faculty schedule...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed rounded-xl bg-canvas-parchment/30">
                <CalendarX className="h-10 w-10 text-ink-muted-80 mb-2 opacity-50" />
                <h4 className="text-sm font-semibold text-ink">No lectures scheduled for today</h4>
                <p className="text-xs text-ink-muted-80 max-w-sm mt-1">
                  There are no committed timetable slots or active lectures assigned to your profile for today ({new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}).
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((sess) => {
                  const timeStatus = getLectureTimeStatus(sess);
                  const isApproved = approvedScheduleIds.has(sess.id);

                  return (
                    <div
                      key={sess.id}
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-canvas-parchment/40 rounded-xl border border-[#e0e0e0] hover:border-action-blue/30 transition-all"
                    >
                      {/* Lecture Metadata */}
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-white border border-[#e0e0e0] text-action-blue shrink-0 shadow-2xs">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-ink">{sess.course}</h4>
                            <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-action-blue/20 text-action-blue">
                              {sess.code}
                            </Badge>
                            {sess.semesterName && (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0 font-medium">
                                <GraduationCap className="w-3 h-3 mr-1 text-ink-muted-80" />
                                {sess.semesterName}
                              </Badge>
                            )}
                            {sess.batchOrSection && (
                              <Badge variant="outline" className="text-[10px] px-2 py-0 font-medium">
                                <Users className="w-3 h-3 mr-1 text-ink-muted-80" />
                                {sess.batchOrSection}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-ink-muted-80 flex-wrap">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5 text-action-blue" />
                              {sess.timeSlot}
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                              Room: <strong>{sess.room}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>Date: {sess.lectureDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Attendance Actions based on strict state machine */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {sess.completed ? (
                          // Case A: Attendance already completed -> Show Success Badge & Attendance Summary Button
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] px-3 py-1 rounded-full flex items-center gap-1 font-semibold">
                              <CalendarCheck2 className="h-3 w-3" /> Logged Success
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewSummary(sess.id)}
                              className="text-xs rounded-full h-8 px-3 font-semibold text-action-blue border-action-blue/20 hover:bg-action-blue/10 flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Attendance Summary
                            </Button>
                          </div>
                        ) : timeStatus === 'FUTURE' ? (
                          // Case B: Time is in future -> Lock the attendance feature
                          <div className="flex items-center gap-2">
                            <Button
                              disabled
                              className="bg-muted text-muted-foreground text-xs rounded-full h-9 px-4 font-semibold flex items-center gap-1.5 cursor-not-allowed border"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              Locked (Future Time)
                            </Button>
                          </div>
                        ) : timeStatus === 'PAST' && !isApproved ? (
                          // Case C: Time has passed & not yet approved -> Disabled button with Request Approval option
                          <div className="flex items-center gap-2">
                            <Button
                              disabled
                              variant="outline"
                              className="text-xs rounded-full h-9 px-3.5 font-semibold text-muted-foreground bg-muted/40 cursor-not-allowed border"
                            >
                              <Lock className="h-3.5 w-3.5 mr-1" />
                              Time Passed
                            </Button>
                            <Button
                              onClick={() => handleRequestApproval(sess)}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-full h-9 px-4 font-semibold flex items-center gap-1.5 shadow-sm"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Request Admin Approval
                            </Button>
                          </div>
                        ) : (
                          // Case D: Active lecture OR Approved override -> Enabled Take Attendance button
                          <div className="flex items-center gap-2">
                            {isApproved && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                                Approval Granted
                              </Badge>
                            )}
                            <Button
                              onClick={() => handleTakeAttendance(sess)}
                              className="bg-action-blue hover:opacity-95 text-white text-xs rounded-full h-9 px-4 font-semibold flex items-center gap-1.5 shadow-sm"
                            >
                              <CheckSquare className="h-3.5 w-3.5" />
                              Take Attendance
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --- Tab Content: Past Roster Logs --- */}
      {activeTab === 'logs' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <div className="flex justify-between items-center pb-4 border-b mb-6">
            <div>
              <h3 className="text-base font-semibold text-ink">Attendance Submission History</h3>
              <p className="text-xs text-ink-muted-80 mt-0.5">
                Audit trail of completed attendance rosters submitted by your account.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPastLogs}
              disabled={isLoadingLogs}
              className="rounded-full text-xs h-8"
            >
              {isLoadingLogs ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Refresh Logs
            </Button>
          </div>

          {isLoadingLogs ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted-80 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-action-blue" />
              <span className="text-xs">Loading submission history...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-ink-muted-80 border border-dashed rounded-xl">
              No attendance submission history found for your classes.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Course Subject</TableHead>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Code</TableHead>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Date Logged</TableHead>
                    <TableHead className="text-center text-xs font-bold text-ink-muted-80">Presence Ratio</TableHead>
                    <TableHead className="text-right text-xs font-bold text-ink-muted-80">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                      <TableCell className="font-semibold text-xs text-ink">{log.course}</TableCell>
                      <TableCell className="text-xs font-mono">{log.code}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">{log.date}</TableCell>
                      <TableCell className="text-center font-semibold text-xs text-ink">
                        <Badge className="bg-action-blue/10 text-action-blue border-none text-[10px] px-2.5 py-0.5 rounded-full">
                          {log.present} / {log.total} present
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewSummary(log.id)}
                          className="h-7 text-xs font-semibold text-action-blue hover:bg-action-blue/10 rounded-full px-3"
                        >
                          View Summary
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* --- Dialog 1: Request Admin / HOD Approval --- */}
      <Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ink">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Request Late Attendance Approval
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-muted-80">
              The designated lecture attendance window has passed. Submit an official request to your Admin / HOD to unlock this lecture's attendance.
            </DialogDescription>
          </DialogHeader>

          {targetSessionForApproval && (
            <form onSubmit={handleSubmitApproval} className="space-y-4 pt-2">
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 border">
                <div>
                  <strong>Lecture:</strong> {targetSessionForApproval.course} ({targetSessionForApproval.code})
                </div>
                <div>
                  <strong>Date:</strong> {targetSessionForApproval.lectureDate} &bull; {targetSessionForApproval.timeSlot}
                </div>
                <div>
                  <strong>Room:</strong> {targetSessionForApproval.room}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="approvalReason" className="text-xs font-semibold">
                  Justification / Reason for Delay *
                </Label>
                <textarea
                  id="approvalReason"
                  rows={3}
                  required
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="Provide valid reason for retrospective attendance entry (e.g. Lab network downtime, official institutional duty)..."
                  className="w-full text-xs rounded-md border border-input bg-background p-2.5 focus:ring-1 focus:ring-primary shadow-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsApprovalModalOpen(false)}
                  disabled={isSubmittingApproval}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingApproval || !approvalReason.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                >
                  {isSubmittingApproval ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send Approval Request
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Dialog 2: Completed Attendance Summary Modal --- */}
      <Dialog open={isSummaryModalOpen} onOpenChange={setIsSummaryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ink">
              <CalendarCheck2 className="h-5 w-5 text-emerald-600" />
              Verified Attendance Summary
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-muted-80">
              Detailed breakdown of students and attendance statuses logged for this lecture session.
            </DialogDescription>
          </DialogHeader>

          {isLoadingSummary ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-ink-muted-80">
              <Loader2 className="w-6 h-6 animate-spin text-action-blue" />
              Loading verified attendance records...
            </div>
          ) : summarySession ? (
            <div className="space-y-5 pt-2">
              {/* Header Overview Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border text-center">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Total Enrolled</span>
                  <span className="text-lg font-bold text-foreground">{summaryRecords.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block">Present</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {summaryRecords.filter((r) => r.status === 'PRESENT').length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
                  <span className="text-[10px] font-bold uppercase text-destructive block">Absent</span>
                  <span className="text-lg font-bold text-destructive">
                    {summaryRecords.filter((r) => r.status === 'ABSENT').length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <span className="text-[10px] font-bold uppercase text-amber-700 block">Late / Excused</span>
                  <span className="text-lg font-bold text-amber-700">
                    {summaryRecords.filter((r) => r.status === 'LATE' || r.status === 'EXCUSED').length}
                  </span>
                </div>
              </div>

              {/* Roster Table */}
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-bold">Roll Number</TableHead>
                      <TableHead className="text-xs font-bold">Student Name</TableHead>
                      <TableHead className="text-right text-xs font-bold">Marked Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">
                          No student records logged for this session.
                        </TableCell>
                      </TableRow>
                    ) : (
                      summaryRecords.map((r) => (
                        <TableRow key={r.id} className="text-xs">
                          <TableCell className="font-mono font-medium">
                            {r.student?.rollNumber || r.student?.collegeId || '—'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.student ? `${r.student.firstName} ${r.student.lastName || ''}`.trim() : 'Student'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                r.status === 'PRESENT'
                                  ? 'default'
                                  : r.status === 'ABSENT'
                                  ? 'destructive'
                                  : 'outline'
                              }
                              className="text-[10px] font-semibold"
                            >
                              {r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button size="sm" onClick={() => setIsSummaryModalOpen(false)}>
                  Close Summary
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FacultyDashboard;
