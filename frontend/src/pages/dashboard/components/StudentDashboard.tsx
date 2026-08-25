import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CourseAttendanceSummary {
  id: string;
  courseName: string;
  code: string;
  attended: number;
  total: number;
  percentage: number;
  instructor: string;
  sessions: { date: string; status: 'present' | 'absent' | 'excused'; room: string }[];
}

export const StudentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timetable' | 'attendance' | 'notices'>('timetable');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>('c1');

  // Timetable slot list for today
  const todayClasses = [
    { id: '1', course: 'Computer Networks', code: 'CS-301', time: '10:00 AM - 11:30 AM', room: 'Room-304', instructor: 'Dr. Amitabh Roy', status: 'upcoming' },
    { id: '2', course: 'Engineering Math III', code: 'MA-201', time: '12:00 PM - 01:30 PM', room: 'Room-102', instructor: 'Dr. Minati Kalita', status: 'upcoming' },
    { id: '3', course: 'Database Systems Lab', code: 'CS-393', time: '02:00 PM - 04:00 PM', room: 'Lab-3', instructor: 'Prof. J. Phukan', status: 'completed' },
  ];

  // Detailed subject wise attendance summaries
  const [subjectSummaries] = useState<CourseAttendanceSummary[]>([
    {
      id: 'c1',
      courseName: 'Computer Networks',
      code: 'CS-301',
      attended: 14,
      total: 16,
      percentage: 88,
      instructor: 'Dr. Amitabh Roy',
      sessions: [
        { date: 'Aug 24, 2026', status: 'present', room: 'Room-304' },
        { date: 'Aug 21, 2026', status: 'present', room: 'Room-304' },
        { date: 'Aug 18, 2026', status: 'absent', room: 'Room-304' },
        { date: 'Aug 15, 2026', status: 'present', room: 'Room-304' },
      ]
    },
    {
      id: 'c2',
      courseName: 'Engineering Mathematics III',
      code: 'MA-201',
      attended: 12,
      total: 15,
      percentage: 80,
      instructor: 'Dr. Minati Kalita',
      sessions: [
        { date: 'Aug 23, 2026', status: 'present', room: 'Room-102' },
        { date: 'Aug 20, 2026', status: 'present', room: 'Room-102' },
        { date: 'Aug 17, 2026', status: 'present', room: 'Room-102' },
      ]
    },
    {
      id: 'c3',
      courseName: 'Database Systems Lab',
      code: 'CS-393',
      attended: 5,
      total: 7,
      percentage: 71, // Below 75% limit!
      instructor: 'Prof. J. Phukan',
      sessions: [
        { date: 'Aug 24, 2026', status: 'present', room: 'Lab-3' },
        { date: 'Aug 17, 2026', status: 'absent', room: 'Lab-3' },
        { date: 'Aug 10, 2026', status: 'absent', room: 'Lab-3' },
      ]
    }
  ]);

  // Scoped notifications notice board
  const notices = [
    { id: 'n1', title: 'Medical Exception Roster Submissions', body: 'Students with shortfall attendance warning statuses must submit approved medical leave documents to the Coordinator desk by Sept 2.', date: 'Aug 24, 2026', author: 'Academic Office' },
    { id: 'n2', title: 'B.Tech CS-2023 Lab Exam Shift', body: 'Database Systems Lab CS-393 practical sessions for Monday Aug 31 are rescheduled to Wednesday Sept 2 in Lab-3.', date: 'Aug 22, 2026', author: 'Dr. Amitabh Roy' },
  ];

  const selectedCourse = subjectSummaries.find(c => c.id === selectedCourseId);

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
        </Card>
      )}

      {/* --- Tab Content: Attendance Tracker --- */}
      {activeTab === 'attendance' && (
        <div className="grid gap-6 lg:grid-cols-7">
          {/* Left panel: course list percentage cards */}
          <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-4 p-6">
            <h3 className="text-base font-semibold text-ink pb-4 border-b mb-6">Subject Attendance Summaries</h3>
            <div className="space-y-4">
              {subjectSummaries.map((summary) => (
                <div 
                  key={summary.id}
                  onClick={() => setSelectedCourseId(summary.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedCourseId === summary.id 
                      ? 'border-action-blue bg-action-blue/5' 
                      : 'border-[#e0e0e0] hover:border-[#b9b9bc]'
                  }`}
                >
                  <div>
                    <h4 className="text-sm font-semibold text-ink">{summary.courseName} ({summary.code})</h4>
                    <p className="text-xs text-ink-muted-80 mt-1">Attended: {summary.attended} / {summary.total} classes</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${
                      summary.percentage < 75 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {summary.percentage}%
                    </span>
                    {summary.percentage < 75 ? (
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
              ))}
            </div>
          </Card>

          {/* Right panel: expand session checklist */}
          <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-3 p-6 flex flex-col justify-between">
            {selectedCourse ? (
              <div className="space-y-4">
                <div className="pb-4 border-b">
                  <h4 className="text-sm font-bold text-ink">{selectedCourse.courseName} ({selectedCourse.code})</h4>
                  <p className="text-xs text-ink-muted-80 mt-1">Instructor: {selectedCourse.instructor}</p>
                </div>
                
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {selectedCourse.sessions.map((sess, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b pb-2.5 last:border-none">
                      <div>
                        <p className="text-xs font-semibold text-ink">{sess.date}</p>
                        <p className="text-[10px] text-ink-muted-48 mt-0.5">Location: {sess.room}</p>
                      </div>
                      <div>
                        {sess.status === 'present' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px]">Present</Badge>
                        ) : sess.status === 'absent' ? (
                          <Badge className="bg-rose-100 text-rose-800 border-none text-[9px]">Absent</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-none text-[9px]">Excused</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-center py-12 text-ink-muted-48">Select a course to inspect logs.</p>
            )}
            
            {selectedCourse && selectedCourse.percentage < 75 && (
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex gap-2 items-start mt-6">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-rose-950">Waiver Pending Action</p>
                  <p className="text-[9px] text-rose-800 leading-relaxed mt-0.5">
                    Your attendance is below the 75% limit. Click select a course to view logs, and submit approved medical leaves to the HOD Coordinator.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* --- Tab Content: Academic Notices --- */}
      {activeTab === 'notices' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <h3 className="text-base font-semibold text-ink pb-4 border-b mb-6">Batch Announcements & Notices</h3>
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
        </Card>
      )}
    </div>
  );
};
export default StudentDashboard;
