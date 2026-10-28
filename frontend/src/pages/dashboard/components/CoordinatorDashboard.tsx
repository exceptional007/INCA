import React, { useState } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import {
  Users,
  AlertTriangle,
  HeartPulse,
  CheckCircle2,
  Layers,
  ArrowRight,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCoordinatorDashboardSummary } from '@/hooks/useAcademicQueries';

export const CoordinatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'logs' | 'escalations'>('overview');
  const [warnedStudentIds, setWarnedStudentIds] = useState<Set<string>>(new Set());

  // Fetch real summary from backend
  const { data: summaryData, isLoading, isError, refetch, isFetching } = useCoordinatorDashboardSummary(
    selectedSectionId || undefined,
  );

  const section = summaryData?.section;
  const availableSections: any[] = summaryData?.availableSections || [];
  const totalStudents: number = summaryData?.totalStudents ?? 0;
  const attendanceRate: number = summaryData?.sectionAttendanceRate ?? 0;
  const shortfallStudents: any[] = summaryData?.shortfallStudents || [];
  const todaySchedules: any[] = summaryData?.todaySchedules || [];
  const recentSessions: any[] = summaryData?.recentSessions || [];

  const shortfallCount = shortfallStudents.length;
  const compliantCount = Math.max(0, totalStudents - shortfallCount);

  const handleSendWarning = (student: any) => {
    setWarnedStudentIds(prev => new Set(prev).add(student.id));
    toast.success(`Academic shortfall notification flagged for ${student.name} (${student.roll}).`);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Title & Section Scope Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">
            Institutional Academic Coordination
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-ink mt-0.5">Program Coordinator Hub</h2>
          <p className="text-xs text-ink-muted-80">
            Currently scoped cohort:{' '}
            <strong className="text-ink">
              {section?.displayName || section?.name || 'Academic Batch Roster'}
            </strong>
            {section?.department && (
              <span className="ml-2 text-ink-muted-48">({section.department})</span>
            )}
          </p>
        </div>

        {/* Section Switcher & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {availableSections.length > 1 && (
            <div className="flex items-center gap-1.5 bg-white border border-[#e0e0e0] rounded-full px-3 py-1 shadow-2xs">
              <Layers className="h-3.5 w-3.5 text-action-blue shrink-0" />
              <select
                value={selectedSectionId || section?.id || ''}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="text-xs font-semibold text-ink bg-transparent focus:outline-none cursor-pointer pr-2"
              >
                {availableSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            disabled={isFetching}
            className="rounded-full h-8 px-3 text-xs border-[#e0e0e0]"
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${isFetching ? 'animate-spin text-action-blue' : ''}`} />
            Sync
          </Button>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/80 overflow-x-auto max-w-full scrollbar-none">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Batch Overview
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'schedule'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Schedules ({todaySchedules.length})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Conducted Logs
            </button>
            <button
              onClick={() => setActiveTab('escalations')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'escalations'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Escalations {shortfallCount > 0 && `(${shortfallCount})`}
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white rounded-[18px] border border-[#e0e0e0]">
          <Loader2 className="h-8 w-8 animate-spin text-action-blue" />
          <p className="text-xs text-ink-muted-80 font-medium">Aggregating live section records & attendance metrics...</p>
        </div>
      )}

      {/* Error state */}
      {!isLoading && isError && (
        <div className="p-6 bg-red-50/50 border border-red-200 rounded-[18px] text-center space-y-3">
          <AlertTriangle className="h-6 w-6 text-red-600 mx-auto" />
          <h3 className="text-sm font-semibold text-red-900">Failed to load coordinator cohort data</h3>
          <p className="text-xs text-red-700">The attendance and timetable services are temporarily unreachable.</p>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="rounded-full text-xs">
            Retry Connection
          </Button>
        </div>
      )}

      {/* --- Tab Content: Overview --- */}
      {!isLoading && !isError && activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Active Cohort Size</span>
                <Users className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">{totalStudents}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Enrolled students in section</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Attendance Average</span>
                <CheckCircle2 className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">{attendanceRate}%</span>
                <p className={`text-[10px] font-semibold mt-1 ${attendanceRate >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {attendanceRate >= 75 ? 'Healthy threshold average' : 'Below institutional target (75%)'}
                </p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Compliant Students</span>
                <HeartPulse className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-emerald-600">{compliantCount}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">≥75% attendance record</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Under Alert Warning</span>
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
              </div>
              <div className="mt-4">
                <span className={`text-2xl font-semibold ${shortfallCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {shortfallCount}
                </span>
                <p className="text-[10px] text-[#ff9500] font-semibold mt-1">
                  {shortfallCount > 0 ? 'Requires coordinator review' : 'No shortfall alerts active'}
                </p>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-7">
            {/* Active alerts */}
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-4 p-6">
              <div className="pb-4 border-b flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-ink">Active Batch Alerts</CardTitle>
                  <CardDescription className="text-xs text-ink-muted-80">
                    Real shortfall alerts (&lt;75% attendance) for {section?.displayName || 'current section'}.
                  </CardDescription>
                </div>
                {shortfallCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {shortfallCount} Flagged
                  </Badge>
                )}
              </div>
              <div className="mt-6 space-y-4">
                {shortfallStudents.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="text-xs font-semibold text-ink">All enrolled students meet the attendance threshold</p>
                    <p className="text-[11px] text-ink-muted-48">No students in this section currently require escalation.</p>
                  </div>
                ) : (
                  shortfallStudents.slice(0, 5).map((student) => {
                    const isWarned = warnedStudentIds.has(student.id);
                    return (
                      <div key={student.id} className="flex justify-between items-center border-b pb-3.5 last:border-0 last:pb-0">
                        <div>
                          <p className="text-xs font-semibold text-ink">{student.name} ({student.roll})</p>
                          <p className="text-[10px] text-rose-600 mt-0.5 font-semibold">
                            Critical Shortfall: {student.attendancePct}% ({student.classesAttended}/{student.classesTotal} attended)
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleSendWarning(student)}
                            size="sm"
                            disabled={isWarned}
                            className={`text-[11px] h-8 px-3 rounded-full ${
                              isWarned
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-action-blue hover:opacity-95 text-white'
                            }`}
                          >
                            {isWarned ? 'Notice Dispatched' : 'Issue Notice'}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Quick Batch Actions */}
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-3 p-6 flex flex-col justify-between">
              <div>
                <div className="pb-4 border-b">
                  <CardTitle className="text-base font-semibold text-ink">Coordination Tools</CardTitle>
                  <CardDescription className="text-xs text-ink-muted-80">Roster & report management.</CardDescription>
                </div>
                <div className="mt-6 space-y-3">
                  <div
                    onClick={() => setActiveTab('schedule')}
                    className="flex justify-between items-center p-3.5 rounded-xl border border-[#e0e0e0] hover:bg-canvas-parchment/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-xs font-semibold text-ink">Inspect Section Timetable</span>
                      <p className="text-[10px] text-ink-muted-48">View current week lecture slots</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-action-blue" />
                  </div>

                  <div
                    onClick={() => navigate('/reports')}
                    className="flex justify-between items-center p-3.5 rounded-xl border border-[#e0e0e0] hover:bg-canvas-parchment/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-xs font-semibold text-ink">Official Attendance Reports</span>
                      <p className="text-[10px] text-ink-muted-48">Generate institutional PDF/CSV exports</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-action-blue" />
                  </div>

                  <div
                    onClick={() => setActiveTab('escalations')}
                    className="flex justify-between items-center p-3.5 rounded-xl border border-[#e0e0e0] hover:bg-canvas-parchment/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-xs font-semibold text-ink">Shortfall Action Register</span>
                      <p className="text-[10px] text-ink-muted-48">Review students under minimum threshold</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {shortfallCount} Active
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t text-[11px] text-ink-muted-80 flex items-center justify-between">
                <span>Database Sync Active</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* --- Tab Content: Schedule --- */}
      {!isLoading && !isError && activeTab === 'schedule' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <div className="pb-4 border-b flex justify-between items-center">
            <div>
              <CardTitle className="text-base font-semibold text-ink">Section Timetable Schedule</CardTitle>
              <CardDescription className="text-xs text-ink-muted-80">
                Scheduled lecture slots for {section?.displayName || 'current section'}.
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate('/scheduling')}
              size="sm"
              className="bg-action-blue text-white rounded-full text-xs h-8 px-4"
            >
              Manage Timetables
            </Button>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[#e0e0e0]">
            <Table>
              <TableHeader className="bg-canvas-parchment/40">
                <TableRow>
                  <TableHead className="text-xs font-bold text-ink">Subject / Course</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Code</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Day</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Time Slot</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Instructor</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Room</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaySchedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-ink-muted-48 text-xs">
                      No active lecture schedules registered for this section.
                    </TableCell>
                  </TableRow>
                ) : (
                  todaySchedules.map((slot) => (
                    <TableRow key={slot.id} className="hover:bg-canvas-parchment/20">
                      <TableCell className="text-xs font-semibold text-ink">{slot.courseName}</TableCell>
                      <TableCell className="text-xs font-mono text-ink-muted-80">{slot.code}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">{slot.day}</TableCell>
                      <TableCell className="text-xs font-mono text-ink-muted-80">{slot.timeSlot}</TableCell>
                      <TableCell className="text-xs text-ink">{slot.instructor}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">
                        <Badge variant="outline" className="text-[10px] rounded-full">
                          {slot.room}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          className={`text-[9px] rounded-full ${
                            slot.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : slot.status === 'CANCELLED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {slot.status || 'SCHEDULED'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* --- Tab Content: Logs --- */}
      {!isLoading && !isError && activeTab === 'logs' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <div className="pb-4 border-b">
            <CardTitle className="text-base font-semibold text-ink">Conducted Attendance Sessions</CardTitle>
            <CardDescription className="text-xs text-ink-muted-80">
              Verified faculty submission history for {section?.displayName || 'this section'}.
            </CardDescription>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[#e0e0e0]">
            <Table>
              <TableHeader className="bg-canvas-parchment/40">
                <TableRow>
                  <TableHead className="text-xs font-bold text-ink">Course</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Code</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Date</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Conducted By</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Turnout</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Attendance Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-ink-muted-48 text-xs">
                      No attendance sessions have been submitted for this section yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentSessions.map((log) => {
                    const pct = log.total > 0 ? Math.round((log.present / log.total) * 100) : 0;
                    return (
                      <TableRow key={log.id} className="hover:bg-canvas-parchment/20">
                        <TableCell className="text-xs font-semibold text-ink">{log.course}</TableCell>
                        <TableCell className="text-xs font-mono text-ink-muted-80">{log.code}</TableCell>
                        <TableCell className="text-xs text-ink-muted-80">{log.date}</TableCell>
                        <TableCell className="text-xs text-ink">{log.instructor}</TableCell>
                        <TableCell className="text-xs font-semibold text-ink">
                          {log.present} / {log.total} present
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            className={`text-[9px] rounded-full ${
                              pct >= 75
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {pct}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* --- Tab Content: Escalations --- */}
      {!isLoading && !isError && activeTab === 'escalations' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <div className="pb-4 border-b flex justify-between items-center">
            <div>
              <CardTitle className="text-base font-semibold text-ink">Attendance Shortfall Escalation Register</CardTitle>
              <CardDescription className="text-xs text-ink-muted-80">
                Official institutional register of students under the 75% attendance threshold.
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate('/reports')}
              size="sm"
              variant="outline"
              className="rounded-full text-xs h-8 px-4 border-[#e0e0e0]"
            >
              Export Report
            </Button>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[#e0e0e0]">
            <Table>
              <TableHeader className="bg-canvas-parchment/40">
                <TableRow>
                  <TableHead className="text-xs font-bold text-ink">Roll Number</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Student Name</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Attendance %</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Attended / Total</TableHead>
                  <TableHead className="text-xs font-bold text-ink">Shortfall Gap</TableHead>
                  <TableHead className="text-xs font-bold text-ink text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shortfallStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 space-y-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                      <p className="text-xs font-semibold text-ink">No shortfall escalations</p>
                      <p className="text-[11px] text-ink-muted-48">
                        All students in {section?.displayName || 'this section'} have met or exceeded the 75% attendance criterion.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  shortfallStudents.map((stud) => {
                    const isWarned = warnedStudentIds.has(stud.id);
                    const needed = Math.max(1, Math.ceil((0.75 * stud.classesTotal - stud.classesAttended) / 0.25));
                    return (
                      <TableRow key={stud.id} className="hover:bg-canvas-parchment/20">
                        <TableCell className="text-xs font-mono font-semibold text-ink">{stud.roll}</TableCell>
                        <TableCell className="text-xs font-semibold text-ink">{stud.name}</TableCell>
                        <TableCell className="text-xs">
                          <span className="font-bold text-rose-600">{stud.attendancePct}%</span>
                        </TableCell>
                        <TableCell className="text-xs text-ink-muted-80">
                          {stud.classesAttended} / {stud.classesTotal} classes
                        </TableCell>
                        <TableCell className="text-xs text-ink-muted-80">
                          <span className="text-[11px] text-amber-700">Need ~{needed} consecutive classes</span>
                        </TableCell>
                        <TableCell className="text-xs text-right space-x-2">
                          <Button
                            onClick={() => handleSendWarning(stud)}
                            size="sm"
                            disabled={isWarned}
                            className={`rounded-full text-[11px] h-7 px-3 ${
                              isWarned
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-action-blue hover:opacity-95 text-white'
                            }`}
                          >
                            {isWarned ? 'Warned' : 'Dispatch Warning'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};
