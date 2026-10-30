import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Clock,
  MapPin,
  GraduationCap,
  Users,
  RefreshCw,
  Loader2,
  CalendarCheck2,
  CalendarX,
  Eye,
  Lock,
  AlertTriangle,
  CheckSquare,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';

interface FacultyScheduleItem {
  id: string;
  course: string;
  code: string;
  timeSlot: string;
  room: string;
  semesterName?: string;
  batchOrSection?: string;
  lectureDate: string;
  completed: boolean;
  scheduleRaw?: any;
}

export const FacultyTimetableViewer: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [schedules, setSchedules] = useState<FacultyScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Approval Request Modal
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [targetSessionForApproval, setTargetSessionForApproval] = useState<FacultyScheduleItem | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvedScheduleIds, setApprovedScheduleIds] = useState<Set<string>>(new Set());

  // Attendance Summary Modal
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summarySession, setSummarySession] = useState<any | null>(null);
  const [summaryRecords, setSummaryRecords] = useState<any[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

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

  const getLectureTimeStatus = (sess: FacultyScheduleItem): 'PAST' | 'ACTIVE' | 'FUTURE' => {
    const todayStr = getTodayDateStr();
    const lectureDateStr = sess.lectureDate ? sess.lectureDate.slice(0, 10) : todayStr;

    if (lectureDateStr < todayStr) return 'PAST';
    if (lectureDateStr > todayStr) return 'FUTURE';

    const rawTemplate = sess.scheduleRaw?.template;
    const startTimeStr = rawTemplate?.startTime || '09:00 AM';
    const endTimeStr = rawTemplate?.endTime || '10:00 AM';

    const startMin = parseTimeMinutes(startTimeStr);
    const endMin = parseTimeMinutes(endTimeStr);

    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    if (currentMin > endMin + 15) return 'PAST';
    if (currentMin < startMin - 10) return 'FUTURE';
    return 'ACTIVE';
  };

  const fetchApprovedRequests = useCallback(async () => {
    try {
      const res = await api.get('/requests?status=APPROVED');
      const approvedList: any[] = res.data?.data || [];
      const set = new Set<string>();
      approvedList.forEach((r) => {
        if (r.details) {
          const match = r.details.match(/Schedule ID:\s*([a-zA-Z0-9-]+)/i);
          if (match && match[1]) set.add(match[1].trim());
        }
      });
      setApprovedScheduleIds(set);
    } catch {}
  }, []);

  const fetchSchedulesForDate = useCallback(async (dateStr: string) => {
    setIsLoading(true);
    try {
      let scheduleList: any[] = [];
      try {
        const res = await api.get(`/schedules/today?date=${dateStr}`);
        scheduleList = res.data?.data || [];
      } catch (e) {
        console.error('Failed to fetch faculty schedules:', e);
      }

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

      const mapped: FacultyScheduleItem[] = scheduleList.map((sch: any) => {
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
          lectureDate: sch.lectureDate ? sch.lectureDate.slice(0, 10) : dateStr,
          completed: isCompleted,
          scheduleRaw: sch,
        };
      });

      setSchedules(mapped);
    } catch (err: any) {
      console.error('Failed to load schedule:', err);
      toast.error('Failed to load schedule.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedulesForDate(selectedDate);
    fetchApprovedRequests();
  }, [selectedDate, fetchSchedulesForDate, fetchApprovedRequests]);

  const handleTakeAttendance = (sess: FacultyScheduleItem) => {
    navigate(`/attendance/mark?scheduleId=${encodeURIComponent(sess.id)}`);
  };

  const handleRequestApproval = (sess: FacultyScheduleItem) => {
    setTargetSessionForApproval(sess);
    setApprovalReason(
      `Permission requested to mark late/retrospective attendance for ${sess.course} (${sess.code}) scheduled on ${sess.lectureDate} (${sess.timeSlot}).`
    );
    setIsApprovalModalOpen(true);
  };

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

  const handleViewSummary = async (sessionIdOrScheduleId: string) => {
    setIsLoadingSummary(true);
    setIsSummaryModalOpen(true);
    setSummarySession(null);
    setSummaryRecords([]);
    try {
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

  const isSelectedDateToday = selectedDate === getTodayDateStr();

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleTodayClick = () => {
    setSelectedDate(getTodayDateStr());
  };

  const completedCount = schedules.filter((s) => s.completed).length;
  const pendingCount = schedules.length - completedCount;

  return (
    <div className="space-y-6">
      {/* Date Picker Navigation Header */}
      <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-4 shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CalendarIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Select Lecture Date</h4>
              <p className="text-[11px] text-ink-muted-80">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevDay}
              className="rounded-full h-8 px-2.5 text-xs text-ink-muted-80 hover:text-ink"
              title="Previous Day"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="h-8 text-xs rounded-lg px-2.5 w-36 font-medium border-border/80"
              />
              {!isSelectedDateToday && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTodayClick}
                  className="rounded-full h-8 text-xs font-semibold px-3 bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
                >
                  Today
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextDay}
              className="rounded-full h-8 px-2.5 text-xs text-ink-muted-80 hover:text-ink"
              title="Next Day"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSchedulesForDate(selectedDate)}
              disabled={isLoading}
              className="rounded-full h-8 text-xs px-3 ml-1"
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Assigned Classes List for Selected Date */}
      <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
        <div className="pb-4 border-b mb-6">
          <h3 className="text-base font-semibold text-ink">
            Assigned Lectures on {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <p className="text-xs text-ink-muted-80 mt-0.5">
            {schedules.length} lecture{schedules.length === 1 ? '' : 's'} assigned to you &bull;{' '}
            <span className="text-emerald-700 font-medium">{completedCount} Completed</span> &bull;{' '}
            <span className="text-primary font-medium">{pendingCount} Pending</span>
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-ink-muted-80 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Loading assigned faculty lectures...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed rounded-xl bg-muted/20">
            <CalendarX className="h-10 w-10 text-muted-foreground/60 mb-2" />
            <h4 className="text-sm font-semibold text-ink">No lectures scheduled for this date</h4>
            <p className="text-xs text-ink-muted-80 max-w-sm mt-1">
              There are no committed timetable slots or active lectures assigned to your profile for{' '}
              {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((sess) => {
              const timeStatus = getLectureTimeStatus(sess);
              const isApproved = approvedScheduleIds.has(sess.id);

              return (
                <div
                  key={sess.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-muted/20 rounded-xl border border-[#e0e0e0] hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-white border border-[#e0e0e0] text-primary shrink-0 shadow-2xs">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-ink">{sess.course}</h4>
                        <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-primary/20 text-primary">
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
                          <Clock className="w-3.5 h-3.5 text-primary" />
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

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {sess.completed ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] px-3 py-1 rounded-full flex items-center gap-1 font-semibold">
                          <CalendarCheck2 className="h-3 w-3" /> Logged Success
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSummary(sess.id)}
                          className="text-xs rounded-full h-8 px-3 font-semibold text-primary border-primary/20 hover:bg-primary/10 flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Attendance Summary
                        </Button>
                      </div>
                    ) : timeStatus === 'FUTURE' ? (
                      <Button
                        disabled
                        className="bg-muted text-muted-foreground text-xs rounded-full h-9 px-4 font-semibold flex items-center gap-1.5 cursor-not-allowed border"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Locked (Future Time)
                      </Button>
                    ) : timeStatus === 'PAST' && !isApproved ? (
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
                      <div className="flex items-center gap-2">
                        {isApproved && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            Approval Granted
                          </Badge>
                        )}
                        <Button
                          onClick={() => handleTakeAttendance(sess)}
                          className="bg-primary hover:opacity-95 text-white text-xs rounded-full h-9 px-4 font-semibold flex items-center gap-1.5 shadow-sm"
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

      {/* Request Approval Dialog */}
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
                <Label htmlFor="schedApprovalReason" className="text-xs font-semibold">
                  Justification / Reason for Delay *
                </Label>
                <textarea
                  id="schedApprovalReason"
                  rows={3}
                  required
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="Provide valid reason for retrospective attendance entry..."
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

      {/* Attendance Summary Dialog */}
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
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              Loading verified attendance records...
            </div>
          ) : summarySession ? (
            <div className="space-y-5 pt-2">
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

