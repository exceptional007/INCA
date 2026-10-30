import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Download,
  Calendar,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  RefreshCw,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/axios';

interface FacultySubjectItem {
  id: string;
  code: string;
  name: string;
  sections: string[];
  totalSessionsCount: number;
}

interface StudentDatewiseRecord {
  id: string;
  date: string;
  timeSlot: string;
  room: string;
  subjectId?: string;
  subjectCode: string;
  subjectName: string;
  sectionName: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
}

interface StudentAttendanceData {
  student: {
    id: string;
    name: string;
    collegeId: string;
    rollNumber: string;
    email?: string;
    sectionName: string;
    semesterNumber?: number;
    programName?: string;
    departmentName?: string;
  };
  overall: {
    totalClasses: number;
    attended: number;
    missed: number;
    percentage: number;
    isShortfall: boolean;
    eligibilityStatus: 'ELIGIBLE' | 'SHORTFALL';
  };
  bySubject: Array<{
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    total: number;
    attended: number;
    missed: number;
    percentage: number;
  }>;
  datewiseHistory: StudentDatewiseRecord[];
  dateRange: { startDate: string | null; endDate: string | null };
}

interface SubjectRosterData {
  subject: {
    id: string;
    code: string;
    name: string;
  };
  totalSessions: number;
  totalStudents: number;
  shortfallCount: number;
  averageAttendancePct: number;
  students: Array<{
    student: {
      id: string;
      name: string;
      rollNumber: string;
      sectionName: string;
    };
    attended: number;
    totalClasses: number;
    missed: number;
    percentage: number;
    isShortfall: boolean;
  }>;
}

export const FacultyReportsWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'student' | 'subject'>('student');

  // Metadata context (faculty's subjects)
  const [subjects, setSubjects] = useState<FacultySubjectItem[]>([]);

  // Tab 1: Single Student Search State
  const [rollNumberInput, setRollNumberInput] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [studentData, setStudentData] = useState<StudentAttendanceData | null>(null);
  const [isSearchingStudent, setIsSearchingStudent] = useState<boolean>(false);
  const [isExportingStudentCsv, setIsExportingStudentCsv] = useState<boolean>(false);

  // Tab 2: Overall Subject Roster State
  const [rosterSubjectId, setRosterSubjectId] = useState<string>('');
  const [rosterStartDate, setRosterStartDate] = useState<string>('');
  const [rosterEndDate, setRosterEndDate] = useState<string>('');
  const [rosterData, setRosterData] = useState<SubjectRosterData | null>(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [isExportingSubjectCsv, setIsExportingSubjectCsv] = useState<boolean>(false);

  // Fetch faculty context (assigned subjects) on mount
  const fetchFacultyContext = useCallback(async () => {
    try {
      const res = await api.get('/reports/faculty-portal/context');
      const loadedSubjects: FacultySubjectItem[] = res.data?.data?.subjects || [];
      setSubjects(loadedSubjects);

      if (loadedSubjects.length > 0 && !rosterSubjectId) {
        setRosterSubjectId(loadedSubjects[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load faculty report context:', err);
      toast.error('Could not load assigned subjects. Please refresh.');
    }
  }, [rosterSubjectId]);

  useEffect(() => {
    fetchFacultyContext();
  }, [fetchFacultyContext]);

  // Search single student attendance
  const handleSearchStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = rollNumberInput.trim();
    if (!trimmed) {
      toast.error('Please enter a student roll number');
      return;
    }

    setIsSearchingStudent(true);
    try {
      const params = new URLSearchParams();
      params.append('rollNumber', trimmed);
      if (selectedSubjectId && selectedSubjectId !== 'ALL') {
        params.append('subjectId', selectedSubjectId);
      }
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/reports/faculty-portal/student-attendance?${params.toString()}`);
      setStudentData(res.data?.data || null);
      toast.success(`Loaded attendance report for Roll No: ${trimmed}`);
    } catch (err: any) {
      console.error('Failed to search student attendance:', err);
      const msg = err.response?.data?.message || `No records found for roll number "${trimmed}".`;
      toast.error(msg);
      setStudentData(null);
    } finally {
      setIsSearchingStudent(false);
    }
  };

  // Export CSV for single student
  const handleExportStudentCsv = async () => {
    if (!studentData?.student?.rollNumber) {
      toast.error('Please search for a student first before exporting.');
      return;
    }

    setIsExportingStudentCsv(true);
    try {
      const params = new URLSearchParams();
      params.append('rollNumber', studentData.student.rollNumber);
      if (selectedSubjectId && selectedSubjectId !== 'ALL') {
        params.append('subjectId', selectedSubjectId);
      }
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/reports/faculty-portal/export-student-csv?${params.toString()}`, {
        responseType: 'blob',
      });

      const disposition = res.headers['content-disposition'];
      let filename = `student-attendance-${studentData.student.rollNumber}.csv`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported CSV for ${studentData.student.name}`);
    } catch (err: any) {
      console.error('Failed to export student CSV:', err);
      toast.error('Failed to download student attendance CSV.');
    } finally {
      setIsExportingStudentCsv(false);
    }
  };

  // Fetch overall subject roster
  const fetchSubjectRoster = useCallback(
    async (subjId?: string, start?: string, end?: string) => {
      const targetSubjId = subjId || rosterSubjectId;
      if (!targetSubjId) return;

      setIsLoadingRoster(true);
      try {
        const params = new URLSearchParams();
        if (start) params.append('startDate', start);
        if (end) params.append('endDate', end);

        const res = await api.get(
          `/reports/faculty-portal/subject-roster/${encodeURIComponent(targetSubjId)}${
            params.toString() ? `?${params.toString()}` : ''
          }`
        );
        setRosterData(res.data?.data || null);
      } catch (err: any) {
        console.error('Failed to load subject roster:', err);
        toast.error('Failed to load subject attendance roster.');
        setRosterData(null);
      } finally {
        setIsLoadingRoster(false);
      }
    },
    [rosterSubjectId]
  );

  useEffect(() => {
    if (activeTab === 'subject' && rosterSubjectId) {
      fetchSubjectRoster(rosterSubjectId, rosterStartDate, rosterEndDate);
    }
  }, [activeTab, rosterSubjectId, rosterStartDate, rosterEndDate, fetchSubjectRoster]);

  // Export CSV for overall subject roster
  const handleExportSubjectCsv = async () => {
    if (!rosterSubjectId) {
      toast.error('Please select a subject to export.');
      return;
    }

    setIsExportingSubjectCsv(true);
    try {
      const params = new URLSearchParams();
      params.append('subjectId', rosterSubjectId);
      if (rosterStartDate) params.append('startDate', rosterStartDate);
      if (rosterEndDate) params.append('endDate', rosterEndDate);

      const res = await api.get(`/reports/faculty-portal/export-subject-csv?${params.toString()}`, {
        responseType: 'blob',
      });

      const disposition = res.headers['content-disposition'];
      let filename = `subject-attendance-roster.csv`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Exported overall subject attendance roster CSV');
    } catch (err: any) {
      console.error('Failed to export subject CSV:', err);
      toast.error('Failed to download subject attendance roster CSV.');
    } finally {
      setIsExportingSubjectCsv(false);
    }
  };

  // Switch to student view from roster table
  const handleQuickViewStudent = (rollNum: string) => {
    setRollNumberInput(rollNum);
    setSelectedSubjectId(rosterSubjectId || 'ALL');
    setActiveTab('student');
    // Trigger search
    setTimeout(() => {
      const params = new URLSearchParams();
      params.append('rollNumber', rollNum);
      if (rosterSubjectId) params.append('subjectId', rosterSubjectId);
      api
        .get(`/reports/faculty-portal/student-attendance?${params.toString()}`)
        .then((res) => {
          setStudentData(res.data?.data || null);
          toast.success(`Loaded attendance report for Roll No: ${rollNum}`);
        })
        .catch((err) => {
          console.error(err);
        });
    }, 100);
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-primary tracking-widest font-semibold">
              ASSAM Faculty Intelligence
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/20 text-primary">
              FACULTY
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
            Faculty Reports & Analytics Workspace
          </h1>
          <p className="text-xs text-muted-foreground">
            Search individual student datewise attendance or review overall subject attendance rosters.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl border border-border/80 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('student')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'student'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Student Attendance Search
          </button>
          <button
            onClick={() => setActiveTab('subject')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'subject'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Overall Subject Roster
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: INDIVIDUAL STUDENT DATEWISE ATTENDANCE                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'student' && (
        <div className="space-y-6">
          {/* Search Card */}
          <Card className="bg-card border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Search className="w-4 h-4 text-primary" />
                Find Student Datewise Attendance
              </CardTitle>
              <CardDescription className="text-xs">
                Enter a student's roll number to inspect their complete datewise attendance record for your assigned subjects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchStudent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Roll Number Input */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Student Roll Number *
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="e.g. 2024BCSE001 or CSE-01"
                        value={rollNumberInput}
                        onChange={(e) => setRollNumberInput(e.target.value)}
                        className="pl-9 h-9 text-xs font-mono font-medium"
                        required
                      />
                    </div>
                  </div>

                  {/* Subject Filter (if multiple subjects taught) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Assigned Subject
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-ring"
                    >
                      <option value="ALL">All My Assigned Subjects</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Button */}
                  <div className="flex items-end gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSearchingStudent}
                      className="h-9 text-xs font-semibold w-full flex items-center justify-center gap-1.5"
                    >
                      {isSearchingStudent ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          Search Student
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Optional Date Filter Accordion */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium">Filter Date Range:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 text-xs w-36"
                    />
                    <span className="text-xs">to</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 text-xs w-36"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
                    >
                      Clear Dates
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Student Report Results View */}
          {isSearchingStudent ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs font-medium">Retrieving student datewise attendance records...</p>
            </div>
          ) : studentData ? (
            <div className="space-y-6">
              {/* Student Header Card & Metrics */}
              <Card className="bg-card border-border shadow-xs overflow-hidden">
                <div className="p-5 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                      {studentData.student.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-foreground">
                          {studentData.student.name}
                        </h2>
                        <Badge variant="outline" className="text-xs font-mono font-bold text-primary border-primary/30">
                          {studentData.student.rollNumber}
                        </Badge>
                        <Badge
                          variant={studentData.overall.percentage >= 75 ? 'default' : 'destructive'}
                          className="text-[10px] font-semibold"
                        >
                          {studentData.overall.percentage >= 75 ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> ELIGIBLE ({studentData.overall.percentage}%)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> SHORTFALL ({studentData.overall.percentage}%)
                            </span>
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Section: <span className="font-medium text-foreground">{studentData.student.sectionName}</span>
                        {studentData.student.programName && ` • ${studentData.student.programName}`}
                        {studentData.student.departmentName && ` • ${studentData.student.departmentName}`}
                      </p>
                    </div>
                  </div>

                  {/* Export CSV for this student */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportStudentCsv}
                    disabled={isExportingStudentCsv}
                    className="flex items-center gap-2 self-start sm:self-auto bg-card hover:bg-muted font-medium text-xs shadow-2xs"
                  >
                    {isExportingStudentCsv ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-primary" />
                    )}
                    Export Student CSV
                  </Button>
                </div>

                {/* 4 Summary Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
                  <div className="p-4 flex flex-col">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Total Classes
                    </span>
                    <span className="text-2xl font-bold text-foreground mt-1">
                      {studentData.overall.totalClasses}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Lectures conducted by you
                    </span>
                  </div>

                  <div className="p-4 flex flex-col">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Classes Attended
                    </span>
                    <span className="text-2xl font-bold text-emerald-600 mt-1">
                      {studentData.overall.attended}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Present or excused
                    </span>
                  </div>

                  <div className="p-4 flex flex-col">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Classes Missed
                    </span>
                    <span className="text-2xl font-bold text-rose-600 mt-1">
                      {studentData.overall.missed}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Unexcused absences
                    </span>
                  </div>

                  <div className="p-4 flex flex-col">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Attendance Rate
                    </span>
                    <span
                      className={`text-2xl font-bold mt-1 ${
                        studentData.overall.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {studentData.overall.percentage}%
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Threshold requirement: 75%
                    </span>
                  </div>
                </div>
              </Card>

              {/* Subject Breakdown if taught multiple subjects */}
              {studentData.bySubject && studentData.bySubject.length > 1 && (
                <Card className="bg-card border-border shadow-xs">
                  <CardHeader className="py-3 px-4 border-b border-border">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Subject-Wise Performance (Taught by You)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Subject</TableHead>
                          <TableHead className="text-xs text-center">Attended / Total</TableHead>
                          <TableHead className="text-xs text-center">Attendance %</TableHead>
                          <TableHead className="text-xs text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentData.bySubject.map((sub) => (
                          <TableRow key={sub.subjectId}>
                            <TableCell className="text-xs font-medium">
                              <span className="font-mono font-bold text-primary mr-2">[{sub.subjectCode}]</span>
                              {sub.subjectName}
                            </TableCell>
                            <TableCell className="text-xs text-center font-mono">
                              {sub.attended} / {sub.total}
                            </TableCell>
                            <TableCell className="text-xs text-center font-bold">
                              <span
                                className={
                                  sub.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'
                                }
                              >
                                {sub.percentage}%
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              <Badge
                                variant={sub.percentage >= 75 ? 'outline' : 'secondary'}
                                className={`text-[10px] ${
                                  sub.percentage >= 75
                                    ? 'border-emerald-500 text-emerald-600'
                                    : 'border-rose-500 text-rose-600'
                                }`}
                              >
                                {sub.percentage >= 75 ? 'Eligible' : 'Shortfall'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Datewise Attendance History Table */}
              <Card className="bg-card border-border shadow-xs">
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Datewise Classroom Attendance Log
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Chronological record of every lecture session conducted by you for this student.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {studentData.datewiseHistory.length} Record{studentData.datewiseHistory.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {studentData.datewiseHistory.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-xs">
                      No attendance sessions recorded for this student in the selected timeframe.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-bold">Date</TableHead>
                          <TableHead className="text-xs font-bold">Time Slot</TableHead>
                          <TableHead className="text-xs font-bold">Subject</TableHead>
                          <TableHead className="text-xs font-bold">Room</TableHead>
                          <TableHead className="text-xs font-bold">Status</TableHead>
                          <TableHead className="text-xs font-bold">Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentData.datewiseHistory.map((rec) => (
                          <TableRow key={rec.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="text-xs font-medium whitespace-nowrap">
                              {new Date(rec.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {rec.timeSlot}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              <span className="font-mono text-primary font-semibold mr-1.5">
                                {rec.subjectCode}
                              </span>
                              {rec.subjectName}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-muted-foreground/70" />
                                {rec.room}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              <Badge
                                variant={
                                  rec.status === 'PRESENT'
                                    ? 'default'
                                    : rec.status === 'LATE'
                                    ? 'outline'
                                    : rec.status === 'EXCUSED'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                                className={`text-[10px] font-semibold ${
                                  rec.status === 'PRESENT'
                                    ? 'bg-emerald-600 text-white'
                                    : rec.status === 'LATE'
                                    ? 'border-amber-500 text-amber-600'
                                    : ''
                                }`}
                              >
                                {rec.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {rec.remarks || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Initial Empty State */
            <Card className="bg-card border-border/80 border-dashed p-12 text-center shadow-none">
              <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-muted-foreground">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No Student Selected</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Type a student roll number above to display their verified datewise attendance history, attendance percentage, and download a CSV report.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: OVERALL SUBJECT ROSTER & EXPORT                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'subject' && (
        <div className="space-y-6">
          {/* Subject Selector & Export Bar */}
          <Card className="bg-card border-border shadow-xs">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                  {/* Select Subject */}
                  <div className="space-y-1 sm:w-80">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Select Subject *
                    </label>
                    <select
                      value={rosterSubjectId}
                      onChange={(e) => setRosterSubjectId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-ring"
                    >
                      {subjects.length === 0 ? (
                        <option value="">No assigned subjects found</option>
                      ) : (
                        subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name} {s.sections.length > 0 ? `(${s.sections.join(', ')})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Date range filters */}
                  <div className="flex items-center gap-2 pt-4 sm:pt-0">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        From
                      </label>
                      <Input
                        type="date"
                        value={rosterStartDate}
                        onChange={(e) => setRosterStartDate(e.target.value)}
                        className="h-9 text-xs w-36"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        To
                      </label>
                      <Input
                        type="date"
                        value={rosterEndDate}
                        onChange={(e) => setRosterEndDate(e.target.value)}
                        className="h-9 text-xs w-36"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions: Refresh & Export CSV */}
                <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSubjectRoster(rosterSubjectId, rosterStartDate, rosterEndDate)}
                    disabled={isLoadingRoster}
                    className="h-9 text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoster ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleExportSubjectCsv}
                    disabled={isExportingSubjectCsv || !rosterSubjectId}
                    className="h-9 text-xs font-semibold flex items-center gap-1.5 bg-primary text-primary-foreground shadow-xs"
                  >
                    {isExportingSubjectCsv ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Export Overall Subject CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Roster Display */}
          {isLoadingRoster ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading overall subject attendance roster...</p>
            </div>
          ) : rosterData ? (
            <div className="space-y-6">
              {/* Subject KPI Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card border-border shadow-xs p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Total Sessions
                  </span>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-foreground">{rosterData.totalSessions}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Conducted by you</p>
                  </div>
                </Card>

                <Card className="bg-card border-border shadow-xs p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Enrolled Students
                  </span>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-foreground">{rosterData.totalStudents}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Evaluated in class</p>
                  </div>
                </Card>

                <Card className="bg-card border-border shadow-xs p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Average Turnout
                  </span>
                  <div className="mt-2">
                    <span
                      className={`text-2xl font-bold ${
                        rosterData.averageAttendancePct >= 75 ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {rosterData.averageAttendancePct}%
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Average attendance rate</p>
                  </div>
                </Card>

                <Card className="bg-card border-border shadow-xs p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Shortfall (&lt;75%)
                  </span>
                  <div className="mt-2">
                    <span
                      className={`text-2xl font-bold ${
                        rosterData.shortfallCount > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {rosterData.shortfallCount}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Students below threshold</p>
                  </div>
                </Card>
              </div>

              {/* Enrolled Students Table */}
              <Card className="bg-card border-border shadow-xs">
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Overall Student Attendance Roster: {rosterData.subject.name} ({rosterData.subject.code})
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Complete student list with class counts, attendance rate, and direct link to inspect datewise records.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {rosterData.students.length} Student{rosterData.students.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {rosterData.students.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-xs">
                      No attendance records submitted for this subject yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-bold">Roll Number</TableHead>
                          <TableHead className="text-xs font-bold">Student Name</TableHead>
                          <TableHead className="text-xs font-bold">Section</TableHead>
                          <TableHead className="text-xs font-bold text-center">Attended / Total</TableHead>
                          <TableHead className="text-xs font-bold text-center">Attendance %</TableHead>
                          <TableHead className="text-xs font-bold text-center">Status</TableHead>
                          <TableHead className="text-xs font-bold text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rosterData.students.map((r) => (
                          <TableRow key={r.student.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="text-xs font-mono font-bold text-primary whitespace-nowrap">
                              {r.student.rollNumber}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {r.student.name}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.student.sectionName}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-center">
                              {r.attended} / {r.totalClasses}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-center">
                              <span className={r.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}>
                                {r.percentage}%
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-center">
                              <Badge
                                variant={r.isShortfall ? 'destructive' : 'default'}
                                className={`text-[10px] ${
                                  !r.isShortfall ? 'bg-emerald-600 text-white' : ''
                                }`}
                              >
                                {r.isShortfall ? 'Shortfall (<75%)' : 'Eligible'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleQuickViewStudent(r.student.rollNumber)}
                                className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10 flex items-center gap-1 ml-auto"
                              >
                                View Datewise
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-card border-border/80 border-dashed p-12 text-center shadow-none">
              <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-muted-foreground">
                <BookOpen className="w-10 h-10 mb-2 opacity-50 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">No Subject Selected</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose one of your assigned subjects above to view the overall attendance roster.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

