import React, { useState } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Users, AlertTriangle, Plus, Send, HeartPulse, Sparkles, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
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

interface TimetableSlot {
  id: string;
  courseName: string;
  code: string;
  day: string;
  timeSlot: string;
  instructor: string;
  room: string;
}

interface ShortfallStudent {
  id: string;
  name: string;
  roll: string;
  attendancePct: number;
  classesAttended: number;
  classesTotal: number;
  status: 'pending' | 'warned' | 'excused';
}

export const CoordinatorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'logs' | 'escalations'>('overview');

  // 1. Scoped Program Batch Data State
  const assignedBatch = "B.Tech Computer Science 2023-27 (3rd Year)";
  const [scheduleSlots, setScheduleSlots] = useState<TimetableSlot[]>([
    { id: 't1', courseName: 'Computer Networks', code: 'CS-301', day: 'Monday', timeSlot: '10:00 AM - 11:30 AM', instructor: 'Dr. Amitabh Roy', room: 'Room-304' },
    { id: 't2', courseName: 'Database Systems', code: 'CS-303', day: 'Tuesday', timeSlot: '01:30 PM - 03:00 PM', instructor: 'Prof. J. Phukan', room: 'Room-202' },
    { id: 't3', courseName: 'Engineering Math III', code: 'MA-201', day: 'Wednesday', timeSlot: '09:00 AM - 10:30 AM', instructor: 'Dr. Minati Kalita', room: 'Room-102' },
  ]);

  const [shortfalls, setShortfalls] = useState<ShortfallStudent[]>([
    { id: 's1', name: 'Rohan Sen', roll: 'CSB23010', attendancePct: 62.5, classesAttended: 15, classesTotal: 24, status: 'pending' },
    { id: 's2', name: 'Kabir Bora', roll: 'CSB23015', attendancePct: 68.2, classesAttended: 15, classesTotal: 22, status: 'warned' },
    { id: 's3', name: 'Darshana Gogoi', roll: 'CSB23024', attendancePct: 71.0, classesAttended: 17, classesTotal: 24, status: 'pending' },
  ]);

  // Dialog forms State
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [formCourse, setFormCourse] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDay, setFormDay] = useState('Monday');
  const [formTimeSlot, setFormTimeSlot] = useState('');
  const [formInstructor, setFormInstructor] = useState('');
  const [formRoom, setFormRoom] = useState('');

  // Past logs of attendance submissions
  const [attendanceLogs] = useState([
    { id: 'l1', course: 'Computer Networks', code: 'CS-301', date: 'Aug 24, 2026', present: 41, total: 45, instructor: 'Dr. Amitabh Roy' },
    { id: 'l2', course: 'Database Systems', code: 'CS-303', date: 'Aug 24, 2026', present: 38, total: 45, instructor: 'Prof. J. Phukan' },
    { id: 'l3', course: 'Engineering Math III', code: 'MA-201', date: 'Aug 23, 2026', present: 44, total: 45, instructor: 'Dr. Minati Kalita' },
  ]);

  const handleSendWarning = (id: string, studentName: string) => {
    setShortfalls(shortfalls.map(s => s.id === id ? { ...s, status: 'warned' } : s));
    toast.success(`Warning notice dispatched to ${studentName} via institutional mail.`);
  };

  const handleExcuseAbsence = (id: string, studentName: string) => {
    setShortfalls(shortfalls.map(s => s.id === id ? { ...s, status: 'excused', attendancePct: Math.min(100, Math.round(s.attendancePct + 12.5)) } : s));
    toast.success(`Medical absence waiver applied for ${studentName}. Attendance updated.`);
  };

  const handleOpenCreate = () => {
    setFormCourse('');
    setFormCode('');
    setFormDay('Monday');
    setFormTimeSlot('');
    setFormInstructor('');
    setFormRoom('');
    setIsScheduleOpen(true);
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourse || !formCode || !formTimeSlot || !formInstructor || !formRoom) {
      toast.error('All fields must be configured.');
      return;
    }
    const newSlot: TimetableSlot = {
      id: Date.now().toString(),
      courseName: formCourse,
      code: formCode,
      day: formDay,
      timeSlot: formTimeSlot,
      instructor: formInstructor,
      room: formRoom,
    };
    setScheduleSlots([...scheduleSlots, newSlot]);
    setIsScheduleOpen(false);
    toast.success(`Lecture session registered conflict-free for ${formCourse}.`);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">ASSAM Scoped Coordinator</span>
          <h2 className="text-2xl font-semibold tracking-tight text-ink mt-0.5">Program Coordinator Hub</h2>
          <p className="text-xs text-ink-muted-80">Currently assigned: <strong className="text-ink">{assignedBatch}</strong></p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-canvas-parchment p-1 rounded-full border">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Batch Overview
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'schedule' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Schedules
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'logs' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Logs
          </button>
          <button
            onClick={() => setActiveTab('escalations')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'escalations' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Escalations ({shortfalls.filter(s => s.status === 'pending').length})
          </button>
        </div>
      </div>

      {/* --- Tab Content: Overview --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Active Cohort Size</span>
                <Users className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">45</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Students enrolled in batch</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Attendance Average</span>
                <CheckCircle2 className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">84.5%</span>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">Healthy threshold average</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Shortfall Escaped</span>
                <HeartPulse className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-emerald-600">42</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Clear of warnings</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Under Alert Warning</span>
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-amber-600">3</span>
                <p className="text-[10px] text-[#ff9500] font-semibold mt-1">Requires review action</p>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-7">
            {/* Active alerts */}
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-4 p-6">
              <div className="pb-4 border-b">
                <CardTitle className="text-base font-semibold text-ink">Active Batch Alerts</CardTitle>
                <CardDescription className="text-xs text-ink-muted-80">Roster alerts scoped to CS-2023.</CardDescription>
              </div>
              <div className="mt-6 space-y-4">
                {shortfalls.filter(s => s.status === 'pending').map((student) => (
                  <div key={student.id} className="flex justify-between items-center border-b pb-3.5 last:border-0 last:pb-0">
                    <div>
                      <p className="text-xs font-semibold text-ink">{student.name} ({student.roll})</p>
                      <p className="text-[10px] text-rose-600 mt-1 font-semibold">
                        Critical Shortfall: {student.attendancePct}% Attendance
                      </p>
                    </div>
                    <Button onClick={() => setActiveTab('escalations')} className="bg-action-blue hover:opacity-95 text-white text-[11px] h-8 px-4 rounded-full">
                      Take Action
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Batch Actions */}
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-3 p-6 flex flex-col justify-between">
              <div>
                <div className="pb-4 border-b">
                  <CardTitle className="text-base font-semibold text-ink">Batch Tools</CardTitle>
                  <CardDescription className="text-xs text-ink-muted-80">Manage batch roster.</CardDescription>
                </div>
                <div className="mt-6 space-y-3">
                  <div onClick={handleOpenCreate} className="flex justify-between items-center p-3.5 rounded-xl border hover:bg-canvas-parchment/50 cursor-pointer active:scale-98">
                    <span className="text-xs font-semibold text-ink">Register Lecture Session</span>
                    <Plus className="h-4 w-4 text-action-blue" />
                  </div>
                  <div onClick={() => setActiveTab('escalations')} className="flex justify-between items-center p-3.5 rounded-xl border hover:bg-canvas-parchment/50 cursor-pointer active:scale-98">
                    <span className="text-xs font-semibold text-ink">Waiver/Escalations</span>
                    <HeartPulse className="h-4 w-4 text-action-blue" />
                  </div>
                </div>
              </div>
              <div className="bg-canvas-parchment p-3 rounded-xl border flex gap-2.5 mt-6 items-start">
                <Sparkles className="h-4 w-4 text-action-blue mt-0.5 shrink-0" />
                <p className="text-[10px] text-ink-muted-80 leading-relaxed">
                  Timetable clashes inside your batch program scope are audited on save. Alerts are automatically dispatched if attendance lags below 75%.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* --- Tab Content: Batch Schedules --- */}
      {activeTab === 'schedule' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b mb-6">
            <h3 className="text-base font-semibold text-ink">Active Batch Lecture Slots</h3>
            <Button onClick={handleOpenCreate} className="bg-action-blue hover:opacity-95 text-white rounded-full">
              <Plus className="h-4 w-4 mr-2" /> Register Session
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Subject</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Code</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Day</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Time Slot</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Instructor</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80 text-right">Room</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleSlots.map((slot) => (
                  <TableRow key={slot.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                    <TableCell className="font-semibold text-xs text-ink">{slot.courseName}</TableCell>
                    <TableCell className="text-xs font-mono">{slot.code}</TableCell>
                    <TableCell className="text-xs text-ink-muted-80">{slot.day}</TableCell>
                    <TableCell className="text-xs text-ink-muted-80">{slot.timeSlot}</TableCell>
                    <TableCell className="text-xs text-ink-muted-80">{slot.instructor}</TableCell>
                    <TableCell className="text-xs text-ink font-semibold text-right">{slot.room}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* --- Tab Content: Attendance Logs --- */}
      {activeTab === 'logs' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <h3 className="text-base font-semibold text-ink pb-4 border-b mb-6">Submitted Attendance Logs</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Lecture Subject</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Subject Code</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Date Logged</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Roster Ratio</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80 text-right">Instructor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceLogs.map((log) => (
                  <TableRow key={log.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                    <TableCell className="font-semibold text-xs text-ink">{log.course}</TableCell>
                    <TableCell className="text-xs font-mono">{log.code}</TableCell>
                    <TableCell className="text-xs text-ink-muted-80">{log.date}</TableCell>
                    <TableCell>
                      <Badge className="bg-action-blue/10 text-action-blue border-none text-[10px]">
                        {log.present} / {log.total} Checked
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-ink-muted-80 text-right">{log.instructor}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* --- Tab Content: Escalations --- */}
      {activeTab === 'escalations' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <h3 className="text-base font-semibold text-ink pb-4 border-b mb-6">Shortfall Roster Escalations</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Student</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Roll Number</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Attendance Rate</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Logged Days</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Escalation Status</TableHead>
                  <TableHead className="w-[200px] text-right text-xs font-bold text-ink-muted-80">Resolve Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shortfalls.map((s) => (
                  <TableRow key={s.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                    <TableCell className="font-semibold text-xs text-ink">{s.name}</TableCell>
                    <TableCell className="text-xs font-mono">{s.roll}</TableCell>
                    <TableCell className="text-xs font-semibold text-rose-600">{s.attendancePct}%</TableCell>
                    <TableCell className="text-xs text-ink-muted-80">{s.classesAttended} / {s.classesTotal}</TableCell>
                    <TableCell>
                      <Badge className={`text-[9px] border-none px-2 py-0.5 rounded-full ${
                        s.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        s.status === 'warned' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {s.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {s.status === 'excused' ? (
                        <span className="text-[10px] text-emerald-600 font-semibold">Medical Exception Applied</span>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleSendWarning(s.id, s.name)}
                            className="h-8 text-[10px] border-[#e0e0e0] text-ink hover:bg-canvas-parchment font-semibold"
                          >
                            <Send className="h-3 w-3 mr-1" /> Warn
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleExcuseAbsence(s.id, s.name)}
                            className="h-8 text-[10px] bg-action-blue text-white font-semibold"
                          >
                            <HeartPulse className="h-3 w-3 mr-1" /> Excuse
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* --- Schedule Modal Form Dialog --- */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="rounded-[18px] bg-white border border-[#e0e0e0] shadow-none w-11/12 max-w-md font-sans">
          <form onSubmit={handleCreateSchedule}>
            <DialogHeader className="pb-3 border-b mb-4">
              <DialogTitle className="text-base font-semibold text-ink">Register Timetable Lecture</DialogTitle>
              <DialogDescription className="text-xs text-ink-muted-80">Add a schedule slot to the active batch program.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Course Title</label>
                <Input
                  type="text"
                  placeholder="e.g. Computer Networks"
                  value={formCourse}
                  onChange={(e) => setFormCourse(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Subject Code</label>
                <Input
                  type="text"
                  placeholder="CS-301"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">Day</label>
                  <select 
                    value={formDay}
                    onChange={(e) => setFormDay(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#e0e0e0] px-3 text-xs bg-white text-ink focus-visible:outline-none"
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">Time Slot</label>
                  <Input
                    type="text"
                    placeholder="10:00 AM - 11:30 AM"
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">Instructor</label>
                  <Input
                    type="text"
                    placeholder="e.g. Dr. Amitabh Roy"
                    value={formInstructor}
                    onChange={(e) => setFormInstructor(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">Class Room</label>
                  <Input
                    type="text"
                    placeholder="Room-304"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 border-t pt-3 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsScheduleOpen(false)} className="rounded-full">
                Cancel
              </Button>
              <Button type="submit" className="bg-action-blue text-white rounded-full">
                Add Slot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default CoordinatorDashboard;
