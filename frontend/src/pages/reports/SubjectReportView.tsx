import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  ArrowLeft,
  Users,
  AlertTriangle,
  Search,
  ArrowRight,
  Building2,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

interface SubjectReportData {
  subject: {
    id: string;
    name: string;
    code: string;
    type?: string;
    isLab?: boolean;
    semesterNumber?: number;
    programName?: string;
    departmentName?: string;
  };
  totalSessions: number;
  enrolledStudentsCount: number;
  averageAttendancePct: number;
  shortfallCount: number;
  distribution: {
    above75: number;
    between65and75: number;
    below65: number;
  };
  bySection: Array<{
    sectionId: string;
    sectionName: string;
    sessionsCount: number;
    attendanceRate: number;
  }>;
  students: Array<{
    student: {
      id: string;
      name: string;
      rollNumber: string;
      collegeId?: string;
      sectionName?: string;
    };
    totalClasses: number;
    attended: number;
    missed: number;
    percentage: number;
    isShortfall: boolean;
  }>;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
}

interface SubjectReportViewProps {
  data: SubjectReportData;
  onBack: () => void;
  onDrillDownStudent: (studentId: string) => void;
  onDrillDownSection: (sectionId: string) => void;
}

export const SubjectReportView: React.FC<SubjectReportViewProps> = ({
  data,
  onBack,
  onDrillDownStudent,
  onDrillDownSection,
}) => {
  const { subject, totalSessions, enrolledStudentsCount, averageAttendancePct, shortfallCount, distribution, bySection, students } = data;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShortfallOnly, setFilterShortfallOnly] = useState(false);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (filterShortfallOnly) {
      list = list.filter((s) => s.isShortfall);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.student.name.toLowerCase().includes(term) ||
          s.student.rollNumber.toLowerCase().includes(term) ||
          (s.student.sectionName && s.student.sectionName.toLowerCase().includes(term)),
      );
    }
    return list;
  }, [students, searchTerm, filterShortfallOnly]);

  const distributionChartData = [
    { name: 'Eligible (≥75%)', count: distribution.above75, color: '#22c55e' },
    { name: 'Warning (65-74%)', count: distribution.between65and75, color: '#f59e0b' },
    { name: 'Critical (<65%)', count: distribution.below65, color: '#ef4444' },
  ];

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
          variant={averageAttendancePct >= 75 ? 'success' : 'destructive'}
          className="text-xs font-bold py-1 px-3 w-fit"
        >
          {averageAttendancePct}% Overall Turnout
        </Badge>
      </div>

      {/* Subject Identity Banner */}
      <Card className="border border-border/80 shadow-2xs bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{subject.name}</h2>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-foreground font-semibold">
                    {subject.code}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
                  {subject.departmentName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {subject.departmentName}
                    </span>
                  )}
                  {subject.programName && <span>{subject.programName}</span>}
                  {subject.semesterNumber && <span>Semester {subject.semesterNumber}</span>}
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    {subject.type || 'THEORY'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-muted/40 font-medium py-1 px-2.5">
                {bySection.length} Assigned Sections
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Turnout */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average Turnout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold tracking-tight ${
                  averageAttendancePct >= 75 ? 'text-success' : 'text-destructive'
                }`}
              >
                {averageAttendancePct}%
              </span>
              <span className="text-xs text-muted-foreground">mean</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average student attendance across lectures</p>
          </CardContent>
        </Card>

        {/* Sessions Conducted */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Conducted Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">Submitted attendance sessions</p>
          </CardContent>
        </Card>

        {/* Evaluated Students */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Enrolled Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{enrolledStudentsCount}</span>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Students marked in sessions</p>
          </CardContent>
        </Card>

        {/* Shortfall Alert */}
        <Card className="border border-destructive/30 bg-destructive/5 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-destructive uppercase tracking-wider">
              Shortfall Count (&lt;75%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
              <span>{shortfallCount}</span>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Students ineligible for exam in this course</p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Distribution Chart */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Course Attendance Distribution</CardTitle>
            <CardDescription className="text-xs">Count of students in each attendance tier for {subject.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    formatter={(val: any) => [`${val} Students`, 'Count']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distributionChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Section-wise Attendance Breakdown */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Section Comparison</CardTitle>
            <CardDescription className="text-xs">Turnout percentage by section taking this subject</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full pt-2">
              {bySection.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No section-level data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySection} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="sectionName" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      formatter={(val: any) => [`${val}% Attendance`, 'Turnout']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="attendanceRate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section List Table */}
      {bySection.length > 0 && (
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Associated Sections & Teaching Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-semibold text-left">
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Conducted Sessions</th>
                    <th className="py-2.5 px-3">Turnout %</th>
                    <th className="py-2.5 px-3 text-right">Drill-Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {bySection.map((sec) => (
                    <tr key={sec.sectionId} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-foreground">Section {sec.sectionName}</td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">{sec.sessionsCount}</td>
                      <td className="py-2.5 px-3">
                        <span className={`font-bold ${sec.attendanceRate >= 75 ? 'text-success' : 'text-destructive'}`}>
                          {sec.attendanceRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDrillDownSection(sec.sectionId)}
                          className="h-7 px-2 text-xs gap-1 text-primary cursor-pointer"
                        >
                          <span>Section Report</span>
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
      )}

      {/* Student Attendance Roster Table */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Student Course Attendance Roster
            </CardTitle>
            <CardDescription className="text-xs">
              All students evaluated for {subject.name}. Click any row to view full student profile.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={filterShortfallOnly ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFilterShortfallOnly(!filterShortfallOnly)}
              className="text-xs h-8 gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{filterShortfallOnly ? 'Show All Students' : 'Shortfall Only (<75%)'}</span>
            </Button>

            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search roster..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No student records match search criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-semibold text-left">
                    <th className="py-2.5 px-3">Roll Number</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Attended Classes</th>
                    <th className="py-2.5 px-3">Missed Classes</th>
                    <th className="py-2.5 px-3">Total Classes</th>
                    <th className="py-2.5 px-3">Attendance %</th>
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
                      <td className="py-2.5 px-3 text-muted-foreground">Sec {st.student.sectionName || '—'}</td>
                      <td className="py-2.5 px-3 text-success font-mono font-semibold">{st.attended}</td>
                      <td className="py-2.5 px-3 text-destructive font-mono">{st.missed}</td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono">{st.totalClasses}</td>
                      <td className="py-2.5 px-3">
                        <span className={`font-bold ${st.isShortfall ? 'text-destructive' : 'text-success'}`}>
                          {st.percentage}%
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
