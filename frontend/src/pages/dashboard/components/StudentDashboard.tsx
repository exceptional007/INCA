import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Clock, AlertTriangle, CheckCircle, Loader2, CalendarX, BellOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/api/axios';

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
  status: 'upcoming' | 'completed';
}

interface AcademicNotice {
  id: string;
  title: string;
  body: string;
  date: string;
  author: string;
}

export const StudentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timetable' | 'attendance' | 'notices'>('timetable');

  // Timetable state
  const [todayClasses, setTodayClasses] = useState<TodayClassItem[]>([]);
  const [isLoadingTimetable, setIsLoadingTimetable] = useState<boolean>(true);

  // Attendance state
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectSummary[]>([]);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(null);
  const [minThreshold, setMinThreshold] = useState<number>(75);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(true);

  // Notices state
  const [notices, setNotices] = useState<AcademicNotice[]>([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState<boolean>(true);

  // Helper to determine if a class is completed based on time
  const isClassCompleted = (endTimeStr: string, lectureDate?: string): boolean => {
    if (!endTimeStr) return false;
    if (lectureDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      const lecStr = new Date(lectureDate).toISOString().split('T')[0];
      if (lecStr < todayStr) return true;
      if (lecStr > todayStr) return false;
    }

    try {
      const cleanStr = endTimeStr.trim().toUpperCase();
      const isPM = cleanStr.includes('PM');
      const isAM = cleanStr.includes('AM');
      const timeOnly = cleanStr.replace(/[^0-9:]/g, '');
      const [hoursStr, minutesStr] = timeOnly.split(':');
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr || '0', 10);

      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;

      const now = new Date();
      const classEndTime = new Date();
      classEndTime.setHours(hours, minutes, 0, 0);

      return now.getTime() >= classEndTime.getTime();
    } catch {
      return false;
    }
  };

  // 1. Fetch Timetable
  const fetchTimetable = useCallback(async () => {
    setIsLoadingTimetable(true);
    try {
      let rawSchedules: any[] = [];
      try {
        const res = await api.get('/schedules/today');
        rawSchedules = res.data?.data || [];
      } catch (err) {
        console.error('Failed to fetch /schedules/today:', err);
      }

      // Fallback if today's exact list is empty
      if (rawSchedules.length === 0) {
        try {
          const allRes = await api.get('/schedules');
          rawSchedules = allRes.data?.data || [];
        } catch (err) {
          console.error('Failed to fetch /schedules fallback:', err);
        }
      }

      const formattedClasses: TodayClassItem[] = rawSchedules.map((sch: any) => {
        const startTime = sch.template?.startTime || '09:00 AM';
        const endTime = sch.template?.endTime || '10:00 AM';
        const room = sch.template?.room?.code || sch.template?.room?.name || 'TBD';
        const course = sch.template?.subject?.name || 'Class Session';
        const code = sch.template?.subject?.code || 'GEN';
        const faculty = sch.template?.faculty;
        const instructor = faculty
          ? `${faculty.firstName} ${faculty.lastName || ''}`.trim()
          : 'Faculty Pending';

        const completed = sch.status === 'COMPLETED' || isClassCompleted(endTime, sch.lectureDate);

        return {
          id: sch.id,
          course,
          code,
          time: `${startTime} - ${endTime}`,
          room,
          instructor,
          status: completed ? 'completed' : 'upcoming',
        };
      });

      setTodayClasses(formattedClasses);
    } catch (err: any) {
      console.error('Failed to load timetable:', err);
      toast.error('Failed to load today\'s timetable.');
    } finally {
      setIsLoadingTimetable(false);
    }
  }, []);

  // 2. Fetch Attendance Summary
  const fetchAttendance = useCallback(async () => {
    setIsLoadingAttendance(true);
    try {
      const res = await api.get('/students/my/attendance-summary');
      const data: AttendanceSummaryResponse = res.data?.data;
      if (data) {
        setMinThreshold(data.minAttendanceThreshold || 75);
        const summaries = data.subjectSummaries || [];
        setSubjectSummaries(summaries);
        if (summaries.length > 0) {
          setSelectedSubjectCode((prev) => prev || summaries[0].code);
        }
      }
    } catch (err: any) {
      console.error('Failed to load attendance summary:', err);
      toast.error('Failed to load attendance tracker.');
    } finally {
      setIsLoadingAttendance(false);
    }
  }, []);

  // 3. Fetch Academic Notices
  const fetchNotices = useCallback(async () => {
    setIsLoadingNotices(true);
    try {
      const res = await api.get('/students/academic/notices');
      setNotices(res.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load academic notices:', err);
    } finally {
      setIsLoadingNotices(false);
    }
  }, []);

  useEffect(() => {
    fetchTimetable();
    fetchAttendance();
    fetchNotices();
  }, [fetchTimetable, fetchAttendance, fetchNotices]);

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
          <p className="text-xs text-ink-muted-80">Track course schedule, view attendance, and batch notices.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-canvas-parchment p-1 rounded-full border">
          <button
            onClick={() => setActiveTab('timetable')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'timetable' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            My Timetable
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'attendance' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Attendance Tracker
          </button>
          <button
            onClick={() => setActiveTab('notices')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'notices' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Academic Notices
          </button>
        </div>
      </div>

      {/* --- Tab Content: My Timetable --- */}
      {activeTab === 'timetable' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <h3 className="text-base font-semibold text-ink pb-4 border-b mb-6">Today's Class Schedule</h3>
          
          {isLoadingTimetable ? (
            <div className="flex flex-col items-center justify-center py-16 text-ink-muted-80">
              <Loader2 className="h-7 w-7 animate-spin text-action-blue mb-2" />
              <p className="text-xs">Loading today's schedule...</p>
            </div>
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
                    {item.status === 'completed' ? (
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
        <div>
          {isLoadingAttendance ? (
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-16 flex flex-col items-center justify-center text-ink-muted-80">
              <Loader2 className="h-7 w-7 animate-spin text-action-blue mb-2" />
              <p className="text-xs">Loading attendance records...</p>
            </Card>
          ) : subjectSummaries.length === 0 ? (
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-16 text-center">
              <CalendarX className="h-10 w-10 text-ink-muted-48 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-ink">No Attendance Records Yet</p>
              <p className="text-xs text-ink-muted-80 mt-1 max-w-sm mx-auto">
                Your course attendance will appear here once instructors log and submit attendance records for your enrolled classes.
              </p>
            </Card>
          ) : (
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
          )}
        </div>
      )}

      {/* --- Tab Content: Academic Notices --- */}
      {activeTab === 'notices' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <h3 className="text-base font-semibold text-ink pb-4 border-b mb-6">Batch Announcements & Notices</h3>
          
          {isLoadingNotices ? (
            <div className="flex flex-col items-center justify-center py-16 text-ink-muted-80">
              <Loader2 className="h-7 w-7 animate-spin text-action-blue mb-2" />
              <p className="text-xs">Loading announcements...</p>
            </div>
          ) : notices.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-[#e0e0e0] rounded-xl bg-canvas-parchment/20">
              <BellOff className="h-10 w-10 text-ink-muted-48 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-ink">No Academic Notices Published</p>
              <p className="text-xs text-ink-muted-80 mt-1 max-w-sm mx-auto">
                There are currently no active notices or announcements published for your batch or department. New announcements will appear here once released by the academic office.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {notices.map((notice) => (
                <div key={notice.id} className="border-b pb-6 last:border-0 last:pb-0 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-semibold text-ink">{notice.title}</h4>
                    <span className="text-[10px] text-ink-muted-48">{notice.date}</span>
                  </div>
                  <p className="text-xs text-ink-muted-80 leading-relaxed">
                    {notice.body}
                  </p>
                  <p className="text-[10px] text-ink-muted-48">Published by: <strong className="text-ink">{notice.author}</strong></p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default StudentDashboard;

