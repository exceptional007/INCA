import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Clock, Check, X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface StudentRoster {
  id: string;
  name: string;
  roll: string;
  isPresent: boolean;
}

interface LectureSession {
  id: string;
  course: string;
  code: string;
  timeSlot: string;
  room: string;
  completed: boolean;
}

export const FacultyDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'mark' | 'logs'>('schedule');

  // Faculty Lecture Sessions Today
  const [sessions, setSessions] = useState<LectureSession[]>([
    { id: 'sess1', course: 'Computer Networks', code: 'CS-301', timeSlot: '10:00 AM - 11:30 AM', room: 'Room-304', completed: false },
    { id: 'sess2', course: 'Advanced Networks Lab', code: 'CS-391', timeSlot: '02:00 PM - 04:00 PM', room: 'Lab-2', completed: false },
  ]);

  // Selected session to mark attendance for
  const [selectedSessionId, setSelectedSessionId] = useState<string>('sess1');

  // Student roster for selected class
  const [roster, setRoster] = useState<StudentRoster[]>([
    { id: 's1', name: 'Prabin Barua', roll: 'CSB23010', isPresent: true },
    { id: 's2', name: 'Nayanika Saikia', roll: 'CSB23018', isPresent: true },
    { id: 's3', name: 'Himanshu Bora', roll: 'MEB23045', isPresent: true },
    { id: 's4', name: 'Rohan Sen', roll: 'CSB23011', isPresent: false },
    { id: 's5', name: 'Kabir Bora', roll: 'CSB23015', isPresent: true },
  ]);

  // Saved Logs State
  const [logs, setLogs] = useState([
    { id: 'log101', course: 'Computer Networks', code: 'CS-301', date: 'Aug 24, 2026', present: 41, total: 45 },
    { id: 'log102', course: 'Advanced Networks Lab', code: 'CS-391', date: 'Aug 21, 2026', present: 43, total: 45 },
  ]);

  // Handle present/absent toggle
  const toggleAttendance = (studentId: string) => {
    setRoster(roster.map(student => 
      student.id === studentId ? { ...student, isPresent: !student.isPresent } : student
    ));
  };

  // Mark all present / absent helpers
  const markAllPresent = () => {
    setRoster(roster.map(s => ({ ...s, isPresent: true })));
    toast.success('Marked all students as present.');
  };

  const markAllAbsent = () => {
    setRoster(roster.map(s => ({ ...s, isPresent: false })));
    toast.success('Marked all students as absent.');
  };

  // Submit attendance list
  const handleSubmitAttendance = () => {
    const presentCount = roster.filter(s => s.isPresent).length;
    const totalCount = roster.length;
    const targetSession = sessions.find(s => s.id === selectedSessionId);

    if (!targetSession) return;

    // Add log
    const newLog = {
      id: Date.now().toString(),
      course: targetSession.course,
      code: targetSession.code,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      present: presentCount,
      total: totalCount
    };

    setLogs([newLog, ...logs]);
    setSessions(sessions.map(s => s.id === selectedSessionId ? { ...s, completed: true } : s));
    toast.success(`Attendance compiled. Roster ratio: ${presentCount} / ${totalCount} saved successfully.`);
    setActiveTab('schedule');
  };

  const startMarking = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setActiveTab('mark');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">ASSAM Faculty Interface</span>
          <h2 className="text-2xl font-semibold tracking-tight text-ink mt-0.5">Faculty Member Desk</h2>
          <p className="text-xs text-ink-muted-80">Mark student checklists, edit session records, and audit logs.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-canvas-parchment p-1 rounded-full border">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'schedule' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            My Schedule
          </button>
          <button
            onClick={() => setActiveTab('mark')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'mark' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Mark Attendance
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'logs' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Past Roster Logs
          </button>
        </div>
      </div>

      {/* --- Tab Content: My Schedule --- */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
            <h3 className="text-base font-semibold text-ink pb-4 border-b mb-6">Today's Class Schedule</h3>
            <div className="space-y-4">
              {sessions.map((sess) => (
                <div key={sess.id} className="flex justify-between items-center p-4 bg-canvas-parchment/40 rounded-xl border border-[#e0e0e0]">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-action-blue shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-ink">{sess.course} ({sess.code})</h4>
                      <p className="text-xs text-ink-muted-80 mt-1">{sess.timeSlot} &bull; Room {sess.room}</p>
                    </div>
                  </div>
                  {sess.completed ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] px-3.5 py-1 rounded-full">
                      Logged Success
                    </Badge>
                  ) : (
                    <Button onClick={() => startMarking(sess.id)} className="bg-action-blue hover:opacity-95 text-white text-xs rounded-full h-9">
                      Mark Attendance
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* --- Tab Content: Mark Attendance --- */}
      {activeTab === 'mark' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b mb-6">
            <div>
              <h3 className="text-base font-semibold text-ink">
                Class Attendance Roster
              </h3>
              <select 
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="mt-2 text-xs rounded-full border px-3.5 py-1.5 bg-white text-ink font-semibold focus-visible:outline-none"
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id} disabled={s.completed}>{s.course} ({s.code}) {s.completed ? '[Completed]' : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={markAllPresent} className="rounded-full text-xs h-8">
                Mark All Present
              </Button>
              <Button variant="outline" size="sm" onClick={markAllAbsent} className="rounded-full text-xs h-8">
                Mark All Absent
              </Button>
            </div>
          </div>

          {/* Roster Table List */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] text-xs font-bold text-ink-muted-80">Roster Check</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Student Name</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Roll Number</TableHead>
                  <TableHead className="text-right text-xs font-bold text-ink-muted-80">Indicator Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((student) => (
                  <TableRow key={student.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={student.isPresent}
                        onChange={() => toggleAttendance(student.id)}
                        className="h-4 w-4 rounded border-[#e0e0e0] text-action-blue focus:ring-action-blue cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-ink">{student.name}</TableCell>
                    <TableCell className="text-xs font-mono">{student.roll}</TableCell>
                    <TableCell className="text-right">
                      {student.isPresent ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Check className="h-2 w-2" /> Present
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 border-none text-[9px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <X className="h-2 w-2" /> Absent
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-8 pt-4 border-t flex justify-between items-center">
            <div className="flex gap-2 items-center text-xs text-ink-muted-80">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span>Submit within 24 hours edit threshold rule.</span>
            </div>
            <Button onClick={handleSubmitAttendance} className="bg-action-blue hover:opacity-95 text-white rounded-full">
              Submit Attendance Roster
            </Button>
          </div>
        </Card>
      )}

      {/* --- Tab Content: Past Roster Logs --- */}
      {activeTab === 'logs' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <h3 className="text-base font-semibold text-ink pb-4 border-b mb-6">Attendance Submission History</h3>
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
        </Card>
      )}
    </div>
  );
};
export default FacultyDashboard;
