import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Layers,
  ArrowLeft,
  Users,
  BookOpen,
  AlertTriangle,
  Search,
  ArrowRight,
  Building2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';

interface SectionReportData {
  section: {
    id: string;
    name: string;
    semesterNumber?: number;
    programName?: string;
    programShortName?: string;
    departmentName?: string;
    totalRegisteredStudents?: number;
  };
  totalSessions: number;
  evaluatedStudentsCount: number;
  overallAttendancePct: number;
  shortfallCount: number;
  bySubject: Array<{
    subjectId: string;
    name: string;
    code: string;
    totalSessions: number;
    attendanceRate: number;
  }>;
  students: Array<{
    student: {
      id: string;
      name: string;
      rollNumber: string;
      collegeId?: string;
    };
    overall: {
      totalClasses: number;
      attended: number;
      missed: number;
      percentage: number;
    };
    isShortfall: boolean;
  }>;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
}

interface SectionReportViewProps {
  data: SectionReportData;
  onBack: () => void;
  onDrillDownStudent: (studentId: string) => void;
  onDrillDownSubject: (subjectId: string) => void;
}

export const SectionReportView: React.FC<SectionReportViewProps> = ({
  data,
  onBack,
  onDrillDownStudent,
  onDrillDownSubject,
}) => {
  const { section, totalSessions, evaluatedStudentsCount, overallAttendancePct, shortfallCount, bySubject, students } = data;
  const [searchTerm, setSearchTerm] = useState('');
  const [shortfallOnly, setShortfallOnly] = useState(false);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (shortfallOnly) {
      list = list.filter((s) => s.isShortfall);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.student.name.toLowerCase().includes(term) ||
          s.student.rollNumber.toLowerCase().includes(term),
      );
    }
    return list;
  }, [students, searchTerm, shortfallOnly]);

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-xs font-semibold cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Overview / Reports</span>
        </Button>

        <Badge
          variant={overallAttendancePct >= 75 ? 'success' : 'destructive'}
          className="text-xs font-bold py-1 px-3 w-fit"
        >
          {overallAttendancePct}% Section Turnout
        </Badge>
      </div>

      {/* Section Identity Card */}
      <Card className="border border-border/80 shadow-2xs bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Section {section.name}</h2>
                  {section.semesterNumber && (
                    <Badge variant="outline" className="text-xs font-semibold">
                      Semester {section.semesterNumber}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
                  {section.departmentName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {section.departmentName}
                    </span>
                  )}
                  {section.programName && <span>{section.programShortName || section.programName}</span>}
                  <span>{section.totalRegisteredStudents || students.length} Registered Students</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-muted/40 font-medium py-1 px-2.5">
                {bySubject.length} Active Courses Taught
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Attendance */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Section Turnout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold tracking-tight ${
                  overallAttendancePct >= 75 ? 'text-success' : 'text-destructive'
                }`}
              >
                {overallAttendancePct}%
              </span>
              <span className="text-xs text-muted-foreground">overall</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Mean attendance across all subjects</p>
          </CardContent>
        </Card>

        {/* Sessions Conducted */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">Class sessions conducted in this section</p>
          </CardContent>
        </Card>

        {/* Evaluated Students */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Evaluated Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{evaluatedStudentsCount}</span>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Students with attendance records</p>
          </CardContent>
        </Card>

        {/* Shortfall Count */}
        <Card className="border border-destructive/30 bg-destructive/5 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-destructive uppercase tracking-wider">
              Shortfall Students (&lt;75%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
              <span>{shortfallCount}</span>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Section students below exam threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Recharts: Subject Turnout Chart */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Subject-wise Turnout for Section {section.name}</CardTitle>
          <CardDescription className="text-xs">Turnout percentage by subject taught in this section</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full pt-2">
            {bySubject.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No subject records found for this section.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySubject} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="code" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    formatter={(val: any) => [`${val}% Attendance`, 'Turnout']}
                    labelFormatter={(lbl: any, payload: any) => {
                      const item = payload?.[0]?.payload;
                      return item ? `${item.name} (${lbl})` : lbl;
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" />
                  <Bar dataKey="attendanceRate" radius={[4, 4, 0, 0]}>
                    {bySubject.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.attendanceRate >= 75 ? '#22c55e' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subject Breakdown Table */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Subject Courses in Section
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-semibold text-left">
                  <th className="py-2.5 px-3">Subject Code</th>
                  <th className="py-2.5 px-3">Course Name</th>
                  <th className="py-2.5 px-3">Conducted Sessions</th>
                  <th className="py-2.5 px-3">Turnout Rate %</th>
                  <th className="py-2.5 px-3 text-right">Drill-Down</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {bySubject.map((sub) => (
                  <tr key={sub.subjectId} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-foreground">{sub.code}</td>
                    <td className="py-2.5 px-3 font-medium text-foreground">{sub.name}</td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">{sub.totalSessions}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold ${sub.attendanceRate >= 75 ? 'text-success' : 'text-destructive'}`}>
                        {sub.attendanceRate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDrillDownSubject(sub.subjectId)}
                        className="h-7 px-2 text-xs gap-1 text-primary cursor-pointer"
                      >
                        <span>Subject Report</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Student Roster Table */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Section Student Roster
            </CardTitle>
            <CardDescription className="text-xs">
              Individual student attendance standings in Section {section.name}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={shortfallOnly ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setShortfallOnly(!shortfallOnly)}
              className="text-xs h-8 gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{shortfallOnly ? 'Show All Students' : 'Shortfall Only (<75%)'}</span>
            </Button>

            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No students found matching filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-semibold text-left">
                    <th className="py-2.5 px-3">Roll Number</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Attended Classes</th>
                    <th className="py-2.5 px-3">Missed Classes</th>
                    <th className="py-2.5 px-3">Total Classes</th>
                    <th className="py-2.5 px-3">Overall Turnout</th>
                    <th className="py-2.5 px-3">Eligibility Status</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredStudents.map((st) => (
                    <tr
                      key={st.student.id}
                      onClick={() => onDrillDownStudent(st.student.id)}
                      className="hover:bg-muted/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                        {st.student.rollNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">{st.student.name}</td>
                      <td className="py-2.5 px-3 text-success font-mono font-semibold">{st.overall.attended}</td>
                      <td className="py-2.5 px-3 text-destructive font-mono">{st.overall.missed}</td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono">{st.overall.totalClasses}</td>
                      <td className="py-2.5 px-3">
                        <span className={`font-bold ${st.isShortfall ? 'text-destructive' : 'text-success'}`}>
                          {st.overall.percentage}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={st.isShortfall ? 'destructive' : 'success'}
                          className="text-[10px]"
                        >
                          {st.isShortfall ? 'Shortfall (<75%)' : 'Eligible'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-primary group-hover:translate-x-0.5 transition-transform"
                        >
                          <span>Profile</span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
