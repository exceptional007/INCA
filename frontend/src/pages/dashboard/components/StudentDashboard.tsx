import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Clock, AlertTriangle, CheckCircle, Loader2, CalendarX, BellOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/api/axios';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { noticeApi } from '@/services/notice';
import type { Notice } from '@/types/notice';
import { NoticeDetailModal } from '@/pages/notices/NoticeDetailModal';

interface SessionItem {
  id: string;
  date: string;
  status: string;
  room: string;
  timeSlot: string;
  instructor: string;
  remarks?: string | null;
}

interface SubjectSummary {
  subject: string;
  code: string;
  attended: number;
  total: number;
  percentage: number;
  isShortfall: boolean;
  sessions: SessionItem[];
}

interface AttendanceSummaryResponse {
  studentId: string;
  minAttendanceThreshold: number;
  overallAttended: number;
  overallTotal: number;
  overallPercentage: number;
  overallShortfall: boolean;
  subjectSummaries: SubjectSummary[];
}

interface TodayClassItem {
  id: string;
  course: string;
  code: string;
  time: string;
  room: string;
  instructor: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

interface AcademicNotice {
  id: string;
  title: string;
  body: string;
  date: string;
  author: string;
  priority: string;
  isPinned: boolean;
  isRead: boolean;
  requiresAcknowledgement: boolean;
  isAcknowledged: boolean;
  attachmentCount: number;
}

export const StudentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timetable' | 'attendance' | 'notices'>('timetable');

  // Timetable state
  const [todayClasses, setTodayClasses] = useState<TodayClassItem[]>([]);
  const [isLoadingTimetable, setIsLoadingTimetable] = useState<boolean>(true);

  const [timetableError, setTimetableError] = useState<string | null>(null);
  const [sectionAssigned, setSectionAssigned] = useState(true);

  // Attendance state
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectSummary[]>([]);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(null);
  const [minThreshold, setMinThreshold] = useState<number>(75);
  const [overallStats, setOverallStats] = useState({
    overallAttended: 0,
    overallTotal: 0,
    overallPercentage: 0,
    overallShortfall: false,
  });
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(true);

  // Notices state
  const [notices, setNotices] = useState<AcademicNotice[]>([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState<boolean>(true);
  const [noticesError, setNoticesError] = useState<string | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [openingNoticeId, setOpeningNoticeId] = useState<string | null>(null);

  // Use the same own-student timetable as the scheduling workspace.
  const fetchTimetable = useCallback(async () => {
    setIsLoadingTimetable(true);
    setTimetableError(null);
    try {
      const res = await api.get('/student-portal/timetable');
      const data = res.data;
      if (!Array.isArray(data?.lectures) || typeof data.sectionAssigned !== 'boolean') throw new Error('Invalid timetable response. Please retry.');
      setSectionAssigned(data.sectionAssigned);
      const campusTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
      const minutesNow = Number(campusTime.slice(0, 2)) * 60 + Number(campusTime.slice(3, 5));
      const ended = (value: string) => {
        const match = value?.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
        if (!match) return false;
        let hours = Number(match[1]);
        if (match[3]) hours = hours % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
        return minutesNow >= hours * 60 + Number(match[2]);
      };
      setTodayClasses(data.lectures.map((lecture: any): TodayClassItem => ({
        id: lecture.scheduleId,
        course: lecture.subject.name,
        code: lecture.subject.code,
        time: [lecture.startTime, lecture.endTime].filter(Boolean).join(' - '),
        room: lecture.room || 'Not assigned',
        instructor: lecture.faculty,
        status: lecture.lectureStatus === 'CANCELLED' ? 'cancelled' : lecture.lectureStatus === 'COMPLETED' || ended(lecture.endTime) ? 'completed' : 'upcoming',
      })));
    } catch (err: any) {
      setTodayClasses([]);
      setTimetableError(err.response?.data?.message || err.message || 'Could not load today’s timetable.');
    } finally {
      setIsLoadingTimetable(false);
    }
  }, []);

  // 2. Fetch Attendance Summary
  const fetchAttendance = useCallback(async () => {
    setIsLoadingAttendance(true);
    setAttendanceError(null);
    try {
      const res = await api.get('/students/my/attendance-summary');
      const data: AttendanceSummaryResponse = res.data?.data;
      if (!data || !Array.isArray(data.subjectSummaries)) throw new Error('Could not read your attendance records. Please retry.');
      if (data) {
        setMinThreshold(data.minAttendanceThreshold || 75);
        setOverallStats({
          overallAttended: data.overallAttended || 0,
          overallTotal: data.overallTotal || 0,
          overallPercentage: data.overallPercentage || 0,
          overallShortfall: !!data.overallShortfall,
        });
        const summaries = data.subjectSummaries || [];
        setSubjectSummaries(summaries);
        setSelectedSubjectCode((prev) => summaries.some(subject => subject.code === prev) ? prev : summaries[0]?.code || null);
      }
    } catch (err: any) {
      console.error('Failed to load attendance summary:', err);
      const detail = err.response?.data?.message || err.message || 'Failed to load attendance tracker.';
      setAttendanceError(Array.isArray(detail) ? detail.join(' ') : detail);
    } finally {
      setIsLoadingAttendance(false);
    }
  }, []);

  // 3. Fetch Academic Notices
  const fetchNotices = useCallback(async () => {
    setIsLoadingNotices(true);
    setNoticesError(null);
    try {
      const res = await api.get('/students/academic/notices');
      setNotices(res.data?.data || []);
    } catch (err: any) {
      setNotices([]);
      setNoticesError('Could not load your notices. Please try again.');
      console.error('Failed to load academic notices:', err);
    } finally {
      setIsLoadingNotices(false);
    }
  }, []);

  const openNotice = async (noticeId: string) => {
    setOpeningNoticeId(noticeId);
    try {
      const notice = await noticeApi.getNoticeById(noticeId);
      setSelectedNotice(notice);
      setNotices((previous) => previous.map((item) => item.id === noticeId ? { ...item, isRead: true } : item));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not open this notice. It may no longer be available.');
      fetchNotices();
    } finally {
      setOpeningNoticeId(null);
    }
  };

  useEffect(() => {
    fetchTimetable();
    fetchAttendance();
    fetchNotices();
  }, [fetchTimetable, fetchAttendance, fetchNotices]);

  useEffect(() => {
    if (activeTab === 'attendance') void fetchAttendance();
  }, [activeTab, fetchAttendance]);

  useEffect(() => {
    const refresh = () => { if (!document.hidden) { void fetchTimetable(); if (activeTab === 'attendance') void fetchAttendance(); } };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [fetchTimetable, fetchAttendance, activeTab]);

  const selectedCourse = subjectSummaries.find((s) => s.code === selectedSubjectCode);

  const formatSessionDate = (dateStr: string) => {
    try {
      return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">ASSAM Student Portal</span>
          <h2 className="text-2xl font-semibold tracking-tight text-ink mt-0.5">Student Academic Desk</h2>
          <p className="text-xs text-ink-muted-80">Track your course schedule, attendance, and campus notices.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/80 overflow-x-auto max-w-full scrollbar-none">
          <button
            onClick={() => setActiveTab('timetable')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'timetable' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            My Timetable
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'attendance' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Attendance Tracker
          </button>
          <button
            onClick={() => setActiveTab('notices')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'notices' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Academic Notices
          </button>
        </div>
      </div>

      {/* --- Tab Content: My Timetable --- */}
      {activeTab === 'timetable' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b mb-6"><h3 className="text-base font-semibold text-ink">Today's Class Schedule</h3><Button variant="outline" size="sm" disabled={isLoadingTimetable} onClick={fetchTimetable}>Refresh timetable</Button></div>
          
          {isLoadingTimetable ? (
            <div className="flex flex-col items-center justify-center py-16 text-ink-muted-80">
              <Loader2 className="h-7 w-7 animate-spin text-action-blue mb-2" />
              <p className="text-xs">Loading today's schedule...</p>
            </div>
          ) : timetableError ? (
            <div role="alert" className="rounded-xl border border-destructive/30 p-5"><p className="text-sm">{timetableError}</p><Button className="mt-3" variant="outline" onClick={fetchTimetable}>Retry timetable</Button></div>
          ) : !sectionAssigned ? (
            <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5"><p className="font-semibold">Your class has not been assigned</p><p className="mt-2 text-sm text-muted-foreground">Ask an Admin to assign your program, semester, and section. Your own scheduled lectures will appear once your class is linked.</p></div>
          ) : todayClasses.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-[#e0e0e0] rounded-xl bg-canvas-parchment/20">
              <CalendarX className="h-10 w-10 text-ink-muted-48 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-ink">No Classes Scheduled for Today</p>
              <p className="text-xs text-ink-muted-80 mt-1 max-w-sm mx-auto">
                There are no scheduled lectures or practical sessions on your timetable for today.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {todayClasses.map((item) => (
                <div 
                  key={item.id} 
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-canvas-parchment/40 rounded-xl border border-[#e0e0e0] gap-4"
                >
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-action-blue shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-ink">{item.course} ({item.code})</h4>
                      <p className="text-xs text-ink-muted-80 mt-1">{item.time} &bull; Room {item.room}</p>
                      <p className="text-[10px] text-ink-muted-48 mt-1">Instructor: {item.instructor}</p>
                    </div>
                  </div>
                  <div>
                    {item.status === 'cancelled' ? <Badge variant="outline">Cancelled</Badge> : item.status === 'completed' ? (
                      <Badge className="bg-canvas-parchment text-ink-muted-80 border-none text-[10px] px-3.5 py-1 rounded-full">
                        Logged Completed
                      </Badge>
                    ) : (
                      <Badge className="bg-action-blue/10 text-action-blue border-none text-[10px] px-3.5 py-1 rounded-full font-bold">
                        Upcoming Next
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* --- Tab Content: Attendance Tracker --- */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">My attendance tracker</h3><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={isLoadingAttendance} onClick={fetchAttendance}>Refresh attendance</Button><Button variant="outline" size="sm" asChild><Link to="/reports">Filter attendance history</Link></Button></div></div>
          {isLoadingAttendance ? (
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-16 flex flex-col items-center justify-center text-ink-muted-80">
              <Loader2 className="h-7 w-7 animate-spin text-action-blue mb-2" />
              <p className="text-xs">Loading attendance records...</p>
            </Card>
          ) : attendanceError ? (
            <Card role="alert" className="p-6 border-destructive/30"><p className="text-sm">{attendanceError}</p><Button className="mt-3" variant="outline" onClick={fetchAttendance}>Retry attendance</Button></Card>
          ) : subjectSummaries.length === 0 ? (
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-16 text-center">
              <CalendarX className="h-10 w-10 text-ink-muted-48 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-ink">No Attendance Records Yet</p>
              <p className="text-xs text-ink-muted-80 mt-1 max-w-sm mx-auto">
                Your course attendance will appear here once instructors log and submit attendance records for your enrolled classes.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Overall KPI Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
                  <div className="flex items-center justify-between text-ink-muted-80">
                    <span className="text-xs font-bold uppercase tracking-wider">Overall Attendance</span>
                    <CheckCircle className="h-4.5 w-4.5 text-action-blue" />
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-semibold text-ink">
                      {overallStats.overallTotal > 0 ? `${overallStats.overallPercentage}%` : 'N/A'}
                    </span>
                    <p className={`text-[10px] font-semibold mt-1 ${overallStats.overallPercentage >= minThreshold ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {overallStats.overallTotal === 0
                        ? 'No sessions logged yet'
                        : overallStats.overallPercentage >= minThreshold
                        ? 'Meets requirement'
                        : 'Below 75% threshold'}
                    </p>
                  </div>
                </Card>

                <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
                  <div className="flex items-center justify-between text-ink-muted-80">
                    <span className="text-xs font-bold uppercase tracking-wider">Turnout Record</span>
                    <Clock className="h-4.5 w-4.5 text-action-blue" />
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-semibold text-ink">
                      {overallStats.overallAttended} / {overallStats.overallTotal}
                    </span>
                    <p className="text-[10px] text-ink-muted-48 mt-1">Total classes attended</p>
                  </div>
                </Card>

                <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
                  <div className="flex items-center justify-between text-ink-muted-80">
                    <span className="text-xs font-bold uppercase tracking-wider">Subjects Tracked</span>
                    <Badge variant="outline" className="text-[10px] rounded-full">
                      {subjectSummaries.length} Courses
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-semibold text-ink">
                      {subjectSummaries.filter(s => s.percentage >= minThreshold).length}
                    </span>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">Courses without shortfall</p>
                  </div>
                </Card>

                <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
                  <div className="flex items-center justify-between text-ink-muted-80">
                    <span className="text-xs font-bold uppercase tracking-wider">Shortfall Warning</span>
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                  </div>
                  <div className="mt-4">
                    <span className={`text-2xl font-semibold ${overallStats.overallShortfall ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {subjectSummaries.filter(s => s.percentage < minThreshold).length}
                    </span>
                    <p className="text-[10px] text-ink-muted-48 mt-1">Course(s) under {minThreshold}%</p>
                  </div>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-7">
                {/* Left panel: course list percentage cards */}
                <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-4 p-6">
                  <div className="flex justify-between items-center pb-4 border-b mb-6">
                    <h3 className="text-base font-semibold text-ink">Subject Attendance Summaries</h3>
                    <span className="text-xs text-ink-muted-80">
                      Threshold: <strong className="text-ink">{minThreshold}%</strong>
                    </span>
                  </div>
                <div className="space-y-4">
                  {subjectSummaries.map((summary) => {
                    const isSelected = selectedSubjectCode === summary.code;
                    const isBelowThreshold = summary.percentage < minThreshold;
                    return (
                      <div 
                        key={summary.code}
                        onClick={() => setSelectedSubjectCode(summary.code)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'border-action-blue bg-action-blue/5' 
                            : 'border-[#e0e0e0] hover:border-[#b9b9bc]'
                        }`}
                      >
                        <div>
                          <h4 className="text-sm font-semibold text-ink">{summary.subject} ({summary.code})</h4>
                          <p className="text-xs text-ink-muted-80 mt-1">Attended: {summary.attended} / {summary.total} classes</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold ${
                            isBelowThreshold ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {summary.percentage}%
                          </span>
                          {isBelowThreshold ? (
                            <Badge className="bg-rose-100 text-rose-800 border-none text-[9px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <AlertTriangle className="h-2 w-2" /> Shortfall Alert
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle className="h-2 w-2" /> Clear
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Right panel: expand session checklist */}
              <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-3 p-6 flex flex-col justify-between">
                {selectedCourse ? (
                  <div className="space-y-4">
                    <div className="pb-4 border-b">
                      <h4 className="text-sm font-bold text-ink">{selectedCourse.subject} ({selectedCourse.code})</h4>
                      <p className="text-xs text-ink-muted-80 mt-1">
                        {selectedCourse.attended} attended out of {selectedCourse.total} total sessions ({selectedCourse.percentage}%)
                      </p>
                    </div>
                    
                    <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                      {selectedCourse.sessions.length === 0 ? (
                        <p className="text-xs text-ink-muted-48 py-8 text-center">No session history available.</p>
                      ) : (
                        selectedCourse.sessions.map((sess) => (
                          <div key={sess.id} className="flex justify-between items-center border-b pb-2.5 last:border-none">
                            <div>
                              <p className="text-xs font-semibold text-ink">{formatSessionDate(sess.date)}</p>
                              <p className="text-[10px] text-ink-muted-48 mt-0.5">
                                Room: {sess.room} {sess.instructor ? `• ${sess.instructor}` : ''}
                              </p>
                            </div>
                            <div>
                              {sess.status.toLowerCase() === 'present' ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px]">Present</Badge>
                              ) : sess.status.toLowerCase() === 'absent' ? (
                                <Badge className="bg-rose-100 text-rose-800 border-none text-[9px]">Absent</Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-none text-[9px]">{sess.status}</Badge>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-center py-12 text-ink-muted-48">Select a course to inspect logs.</p>
                )}
                
                {selectedCourse && selectedCourse.percentage < minThreshold && (
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex gap-2 items-start mt-6">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-rose-950">Waiver Pending Action</p>
                      <p className="text-[9px] text-rose-800 leading-relaxed mt-0.5">
                        Your attendance is below the institutional {minThreshold}% requirement. Please consult your academic coordinator or submit approved medical leaves.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    )}

      {/* --- Tab Content: Academic Notices --- */}
      {activeTab === 'notices' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b mb-6">
            <h3 className="text-base font-semibold text-ink">Your Latest Notices</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchNotices} disabled={isLoadingNotices}>Refresh</Button>
              <Button variant="outline" size="sm" asChild><Link to="/notices">View all notices</Link></Button>
            </div>
          </div>
          
          {isLoadingNotices ? (
            <div className="flex flex-col items-center justify-center py-16 text-ink-muted-80">
              <Loader2 className="h-7 w-7 animate-spin text-action-blue mb-2" />
              <p className="text-xs">Loading announcements...</p>
            </div>
          ) : noticesError ? (
            <div role="alert" className="text-center py-12 space-y-3">
              <p className="text-sm text-ink-muted-80">{noticesError}</p>
              <Button variant="outline" onClick={fetchNotices}>Retry</Button>
            </div>
          ) : notices.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-[#e0e0e0] rounded-xl bg-canvas-parchment/20">
              <BellOff className="h-10 w-10 text-ink-muted-48 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-ink">No Notices Published</p>
              <p className="text-xs text-ink-muted-80 mt-1 max-w-sm mx-auto">
                There are currently no active announcements for your audience. New notices will appear here when published.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {notices.map((notice) => (
                <div key={notice.id} className="border-b pb-6 last:border-0 last:pb-0 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-semibold text-ink">{notice.title}</h4>
                    <time dateTime={notice.date} className="text-[10px] text-ink-muted-48">{new Date(notice.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!notice.isRead && <Badge variant="secondary">Unread</Badge>}
                    {notice.isPinned && <Badge variant="outline">Pinned</Badge>}
                    {['HIGH', 'CRITICAL', 'URGENT'].includes(notice.priority) && <Badge variant="destructive">{notice.priority}</Badge>}
                    {notice.requiresAcknowledgement && !notice.isAcknowledged && <Badge variant="outline">Acknowledgement required</Badge>}
                    {notice.attachmentCount > 0 && <Badge variant="outline">{notice.attachmentCount} attachment{notice.attachmentCount === 1 ? '' : 's'}</Badge>}
                  </div>
                  <p className="text-xs text-ink-muted-80 leading-relaxed whitespace-pre-line line-clamp-3">
                    {notice.body}
                  </p>
                  <p className="text-[10px] text-ink-muted-48">Published by: <strong className="text-ink">{notice.author}</strong></p>
                  <Button variant="outline" size="sm" onClick={() => openNotice(notice.id)} disabled={openingNoticeId !== null}>
                    {openingNoticeId === notice.id ? 'Opening…' : 'Read notice'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      {selectedNotice && <NoticeDetailModal
        key={selectedNotice.id}
        notice={selectedNotice}
        isOpen
        onClose={() => setSelectedNotice(null)}
        onNoticeUpdated={fetchNotices}
      />}
    </div>
  );
};

export default StudentDashboard;

