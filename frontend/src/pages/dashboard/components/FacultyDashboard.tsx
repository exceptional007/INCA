import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Clock, CheckSquare, Loader2, CalendarX, Sparkles, RefreshCw, CalendarCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'schedule' | 'logs'>('schedule');

  // Real data state
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  // Loading states
  const [isLoadingSchedules, setIsLoadingSchedules] = useState<boolean>(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  // Fetch past attendance submission logs for this faculty
  const fetchPastLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await api.get('/attendance/sessions/my-sessions');
      const sessionList: any[] = res.data?.data || [];
      const formattedLogs: AttendanceLog[] = sessionList.map((s: any) => {
        const records = s.records || [];
        const presentCount = records.filter((r: any) => r.status === 'PRESENT').length;
        const totalCount = records.length;
        const dateStr = s.attendanceDate
          ? new Date(s.attendanceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Recent';
        return {
          id: s.id,
          course: s.schedule?.template?.subject?.name || s.activity?.title || 'Class Session',
          code: s.schedule?.template?.subject?.code || 'GEN',
          date: dateStr,
          present: presentCount,
          total: totalCount,
        };
      });
      setLogs(formattedLogs);
    } catch (err: any) {
      console.error('Failed to load past roster logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  // Fetch faculty-scoped today's schedules
  const fetchSchedules = useCallback(async () => {
    setIsLoadingSchedules(true);
    try {
      // 1. Fetch today's faculty-scoped schedules
      let scheduleList: any[] = [];
      try {
        const todayRes = await api.get('/schedules/today');
        scheduleList = todayRes.data?.data || [];
      } catch (e) {
        console.error('Failed to fetch /schedules/today:', e);
      }

      // If no schedules returned for exact today date boundary, fallback to faculty schedules
      if (scheduleList.length === 0) {
        try {
          const allRes = await api.get('/schedules');
          scheduleList = allRes.data?.data || [];
        } catch (e) {
          console.error('Failed to fetch /schedules:', e);
        }
      }

      // 2. Fetch completed sessions to mark which schedules are completed
      let submittedSessionIds = new Set<string>();
      try {
        const mySessionsRes = await api.get('/attendance/sessions/my-sessions');
        const mySessions = mySessionsRes.data?.data || [];
        mySessions.forEach((s: any) => {
          if (s.scheduleId && s.status === 'SUBMITTED') {
            submittedSessionIds.add(s.scheduleId);
          }
        });
      } catch (e) {
        console.error('Failed to fetch my-sessions:', e);
      }

      // 3. Map to LectureSession
      const mapped: LectureSession[] = scheduleList.map((sch: any) => {
        const startTime = sch.template?.startTime || '09:00 AM';
        const endTime = sch.template?.endTime || '10:00 AM';
        const room = sch.template?.room?.code || sch.template?.room?.name || 'Assigned Room';
        const course = sch.template?.subject?.name || 'Class Session';
        const code = sch.template?.subject?.code || 'GEN';
        const isCompleted = submittedSessionIds.has(sch.id);

        return {
          id: sch.id,
          course,
          code,
          timeSlot: `${startTime} - ${endTime}`,
          room,
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
    fetchSchedules();
    fetchPastLogs();
  }, [fetchSchedules, fetchPastLogs]);

  // Navigate directly to the dedicated Take Attendance facility
  const handleTakeAttendance = (sessionId?: string) => {
    if (sessionId) {
      navigate(`/attendance/mark?scheduleId=${encodeURIComponent(sessionId)}`);
    } else {
      navigate('/attendance/mark');
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
            Faculty Member Desk{user?.faculty?.firstName ? ` — Prof. ${user.faculty.firstName} ${user.faculty.lastName || ''}`.trim() : ''}
          </h2>
          <p className="text-xs text-ink-muted-80">
            View today's schedule, monitor attendance status, and launch live lecture attendance sessions.
          </p>
        </div>

        {/* Action Controls & Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Primary Action Button: Takes user directly to the unified Take Attendance Suite */}
          <Button
            onClick={() => handleTakeAttendance()}
            className="bg-action-blue hover:opacity-95 text-white text-xs rounded-full h-8.5 px-4 font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Take Attendance
          </Button>

          {/* Tab Switcher */}
          <div className="flex bg-canvas-parchment p-1 rounded-full border">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'schedule'
                  ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-ink-muted-80 hover:text-ink'
              }`}
            >
              My Schedule
            </button>
            <button
              onClick={() => {
                setActiveTab('logs');
                fetchPastLogs();
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'logs'
                  ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-ink-muted-80 hover:text-ink'
              }`}
            >
              Past Roster Logs
            </button>
          </div>
        </div>
      </div>

      {/* --- Tab Content: My Schedule --- */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b mb-6">
              <div>
                <h3 className="text-base font-semibold text-ink">Today's Class Schedule</h3>
                <p className="text-xs text-ink-muted-80 mt-0.5">
                  {sessions.length} total lecture{sessions.length === 1 ? '' : 's'} assigned &bull;{' '}
                  <span className="text-emerald-700 font-medium">{completedCount} Completed</span> &bull;{' '}
                  <span className="text-action-blue font-medium">{pendingCount} Pending</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSchedules}
                  disabled={isLoadingSchedules}
                  className="rounded-full text-xs h-8"
                >
                  {isLoadingSchedules ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>

            {isLoadingSchedules ? (
              <div className="flex flex-col items-center justify-center py-12 text-ink-muted-80 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-action-blue" />
                <span className="text-xs">Loading assigned faculty schedule...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed rounded-xl bg-canvas-parchment/30">
                <CalendarX className="h-10 w-10 text-ink-muted-80 mb-2 opacity-50" />
                <h4 className="text-sm font-semibold text-ink">No classes scheduled today</h4>
                <p className="text-xs text-ink-muted-80 max-w-sm mt-1 mb-4">
                  There are no committed timetable slots or active lectures assigned to your profile for today.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTakeAttendance('demo-active-lecture')}
                  className="rounded-full text-xs font-semibold gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-action-blue" />
                  Launch Test Attendance Session
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-canvas-parchment/40 rounded-xl border border-[#e0e0e0] hover:border-action-blue/30 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-white border border-[#e0e0e0] text-action-blue shrink-0">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-ink">
                            {sess.course}
                          </h4>
                          <Badge variant="outline" className="text-[10px] font-mono px-2 py-0">
                            {sess.code}
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-muted-80 mt-1">
                          {sess.timeSlot} &bull; Room {sess.room}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {sess.completed ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] px-3 py-1 rounded-full flex items-center gap-1 font-semibold">
                            <CalendarCheck2 className="h-3 w-3" /> Logged Success
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTakeAttendance(sess.id)}
                            className="text-xs text-ink-muted-80 hover:text-ink rounded-full h-8"
                          >
                            Audit
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleTakeAttendance(sess.id)}
                          className="bg-action-blue hover:opacity-95 text-white text-xs rounded-full h-9 px-4 font-semibold flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                          Take Attendance
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
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
                    <TableHead className="text-right text-xs font-bold text-ink-muted-80">Checked Present Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                      <TableCell className="font-semibold text-xs text-ink">{log.course}</TableCell>
                      <TableCell className="text-xs font-mono">{log.code}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">{log.date}</TableCell>
                      <TableCell className="text-right font-semibold text-xs text-ink">
                        <Badge className="bg-action-blue/10 text-action-blue border-none text-[10px] px-2.5 py-0.5 rounded-full">
                          {log.present} / {log.total} present
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default FacultyDashboard;
