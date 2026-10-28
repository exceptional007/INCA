import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  ArrowLeft,
  Building2,
  Mail,
  BookOpen,
  ArrowRight,
  Clock,
  Briefcase,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface FacultyReportData {
  faculty: {
    id: string;
    name: string;
    employeeCode: string;
    designation: string;
    email?: string;
    departmentName?: string;
  };
  totalSessionsConducted: number;
  totalStudentsMarked: number;
  averageClassAttendancePct: number;
  bySubject: Array<{
    subjectId?: string;
    subject: string;
    code: string;
    sectionName: string;
    sessionsConducted: number;
    totalStudentsMarked: number;
    attendanceRate: number;
  }>;
  recentSessions: Array<{
    id: string;
    date: string;
    subjectName: string;
    subjectCode: string;
    subjectId?: string;
    sectionName: string;
    studentsPresent: number;
    studentsMarked: number;
    attendanceRate: number;
  }>;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
}

interface FacultyReportViewProps {
  data: FacultyReportData;
  onBack: () => void;
  onDrillDownSubject?: (subjectId: string) => void;
}

export const FacultyReportView: React.FC<FacultyReportViewProps> = ({
  data,
  onBack,
  onDrillDownSubject,
}) => {
  const { faculty, totalSessionsConducted, totalStudentsMarked, averageClassAttendancePct, bySubject, recentSessions } = data;

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
          variant={averageClassAttendancePct >= 75 ? 'success' : 'default'}
          className="text-xs font-bold py-1 px-3 w-fit"
        >
          {averageClassAttendancePct}% Average Class Turnout
        </Badge>
      </div>

      {/* Faculty Profile Card */}
      <Card className="border border-border/80 shadow-2xs bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{faculty.name}</h2>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-foreground font-semibold">
                    {faculty.employeeCode}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Briefcase className="w-3.5 h-3.5" /> {faculty.designation}
                  </span>
                  {faculty.departmentName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> {faculty.departmentName}
                    </span>
                  )}
                  {faculty.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {faculty.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-muted/40 font-medium py-1 px-2.5">
                {bySubject.length} Course & Section Allocations
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Sessions Conducted */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sessions Conducted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{totalSessionsConducted}</div>
            <p className="text-xs text-muted-foreground mt-1">Submitted lecture sessions</p>
          </CardContent>
        </Card>

        {/* Total Students Evaluated */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Students Evaluated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{totalStudentsMarked.toLocaleString()}</span>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Individual attendance instances marked</p>
          </CardContent>
        </Card>

        {/* Average Class Attendance */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Class Turnout Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold tracking-tight ${
                  averageClassAttendancePct >= 75 ? 'text-success' : 'text-foreground'
                }`}
              >
                {averageClassAttendancePct}%
              </span>
              <span className="text-xs text-muted-foreground">mean</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Student attendance rate across faculty classes</p>
          </CardContent>
        </Card>
      </div>

      {/* Recharts Sessions Chart */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Sessions Conducted Per Course</CardTitle>
          <CardDescription className="text-xs">Classroom sessions taken across assigned subjects and sections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full pt-2">
            {bySubject.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No teaching sessions recorded for this faculty member.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySubject} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="code" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    formatter={(val: any) => [`${val} Sessions`, 'Conducted']}
                    labelFormatter={(lbl: any, payload: any) => {
                      const item = payload?.[0]?.payload;
                      return item ? `${item.subject} (${item.code || lbl}) - Sec ${item.sectionName}` : lbl;
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="sessionsConducted" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subject Allocations Table */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Teaching Allocations & Course Turnout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-semibold text-left">
                  <th className="py-2.5 px-3">Subject Code</th>
                  <th className="py-2.5 px-3">Subject Name</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3">Sessions Conducted</th>
                  <th className="py-2.5 px-3">Students Evaluated</th>
                  <th className="py-2.5 px-3">Student Turnout %</th>
                  <th className="py-2.5 px-3 text-right">Drill-Down</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {bySubject.map((sub, idx) => (
                  <tr key={sub.subjectId || idx} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-foreground">{sub.code || '—'}</td>
                    <td className="py-2.5 px-3 font-medium text-foreground">{sub.subject}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">Sec {sub.sectionName}</td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">{sub.sessionsConducted}</td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">{sub.totalStudentsMarked}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold ${sub.attendanceRate >= 75 ? 'text-success' : 'text-foreground'}`}>
                        {sub.attendanceRate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {sub.subjectId && onDrillDownSubject && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDrillDownSubject(sub.subjectId!)}
                          className="h-7 px-2 text-xs gap-1 text-primary cursor-pointer"
                        >
                          <span>Subject Report</span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sessions Table */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Recent Teaching Sessions Conducted
          </CardTitle>
          <CardDescription className="text-xs">
            Recent classroom sessions submitted by {faculty.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No recent sessions recorded.</p>
          ) : (
            <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10 border-b border-border/60">
                  <tr className="text-muted-foreground font-semibold text-left">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Present / Total</th>
                    <th className="py-2.5 px-3">Session Turnout %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentSessions.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">{rec.date}</td>
                      <td className="py-2 px-3 font-medium text-foreground">
                        {rec.subjectName} <span className="font-mono text-muted-foreground">({rec.subjectCode})</span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">Sec {rec.sectionName}</td>
                      <td className="py-2 px-3 font-mono text-muted-foreground">
                        {rec.studentsPresent} / {rec.studentsMarked}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`font-semibold ${rec.attendanceRate >= 75 ? 'text-success' : 'text-foreground'}`}>
                          {rec.attendanceRate}%
                        </span>
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
