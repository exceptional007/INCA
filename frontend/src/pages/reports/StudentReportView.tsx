import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Clock,
  ArrowRight,
  Mail,
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

interface StudentReportData {
  student: {
    id: string;
    name: string;
    collegeId: string;
    rollNumber: string;
    email?: string;
    sectionId?: string;
    sectionName?: string;
    semesterNumber?: number;
    programName?: string;
    programShortName?: string;
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
    subjectId?: string;
    subjectCode?: string;
    subject: string;
    totalClasses: number;
    attended: number;
    missed: number;
    percentage: number;
    isShortfall: boolean;
  }>;
  attendanceHistory: Array<{
    id: string;
    date: string;
    subjectName: string;
    subjectCode: string;
    subjectId?: string;
    facultyName: string;
    status: string;
    remarks: string;
  }>;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
}

interface StudentReportViewProps {
  data: StudentReportData;
  onBack: () => void;
  onDrillDownSubject?: (subjectId: string) => void;
  onDrillDownSection?: (sectionId: string) => void;
}

export const StudentReportView: React.FC<StudentReportViewProps> = ({
  data,
  onBack,
  onDrillDownSubject,
  onDrillDownSection,
}) => {
  const { student, overall, bySubject, attendanceHistory } = data;

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
          variant={overall.isShortfall ? 'destructive' : 'success'}
          className="text-xs font-bold py-1 px-3 w-fit"
        >
          {overall.isShortfall ? 'Statutory Shortfall (<75%)' : 'Eligible for Examinations'}
        </Badge>
      </div>

      {/* Student Identity Card */}
      <Card className="border border-border/80 shadow-2xs bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{student.name}</h2>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-foreground font-semibold">
                    {student.rollNumber}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
                  {student.collegeId && <span>College ID: <strong className="text-foreground">{student.collegeId}</strong></span>}
                  {student.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {student.email}
                    </span>
                  )}
                  {student.departmentName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {student.departmentName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Academic Placement Tags */}
            <div className="flex flex-wrap items-center gap-2">
              {student.programName && (
                <Badge variant="outline" className="text-xs bg-muted/40 font-medium">
                  {student.programShortName || student.programName}
                </Badge>
              )}
              {student.semesterNumber && (
                <Badge variant="outline" className="text-xs bg-muted/40 font-medium">
                  Semester {student.semesterNumber}
                </Badge>
              )}
              {student.sectionName && (
                <Badge
                  variant="outline"
                  onClick={() => student.sectionId && onDrillDownSection?.(student.sectionId)}
                  className={`text-xs bg-muted/40 font-medium ${
                    student.sectionId ? 'cursor-pointer hover:bg-muted' : ''
                  }`}
                >
                  Section {student.sectionName}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance Rate */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Overall Turnout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold tracking-tight ${
                  overall.isShortfall ? 'text-destructive' : 'text-success'
                }`}
              >
                {overall.percentage}%
              </span>
              <span className="text-xs text-muted-foreground">of classes</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Minimum 75% required by regulations
            </p>
          </CardContent>
        </Card>

        {/* Total Classes */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Eligible Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {overall.totalClasses}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Conducted sessions in student section
            </p>
          </CardContent>
        </Card>

        {/* Classes Attended */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Classes Attended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-success flex items-center gap-1.5">
              <span>{overall.attended}</span>
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Present, late, or condoned excused
            </p>
          </CardContent>
        </Card>

        {/* Classes Missed */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Classes Missed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-1.5">
              <span>{overall.missed}</span>
              {overall.missed > 0 && <AlertTriangle className="w-5 h-5 text-destructive" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unexcused absences recorded
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Chart: Subject-wise attendance */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Subject-wise Attendance Turnout</span>
            <Badge variant="outline" className="text-[10px] font-medium">75% Redline</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Performance comparison across individual enrolled courses with 75% statutory eligibility reference line
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full pt-2">
            {bySubject.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No subject records found.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySubject} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="subjectCode"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    unit="%"
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val}% Attendance`, 'Turnout']}
                    labelFormatter={(lbl: any, payload: any) => {
                      const item = payload?.[0]?.payload;
                      return item ? `${item.subject} (${item.subjectCode || lbl})` : lbl;
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <ReferenceLine
                    y={75}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: '75%', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }}
                  />
                  <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                    {bySubject.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.percentage >= 75 ? '#22c55e' : '#ef4444'}
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
            <BookOpen className="w-4 h-4 text-primary" /> Subject-wise Attendance Breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            Detailed attendance metrics broken down by individual course
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-semibold text-left">
                  <th className="py-2.5 px-3">Subject Code</th>
                  <th className="py-2.5 px-3">Subject Name</th>
                  <th className="py-2.5 px-3">Classes Attended</th>
                  <th className="py-2.5 px-3">Classes Missed</th>
                  <th className="py-2.5 px-3">Total Classes</th>
                  <th className="py-2.5 px-3">Attendance %</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Drill-Down</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {bySubject.map((sub, idx) => (
                  <tr key={sub.subjectId || idx} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                      {sub.subjectCode || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground">{sub.subject}</td>
                    <td className="py-2.5 px-3 text-success font-mono font-semibold">{sub.attended}</td>
                    <td className="py-2.5 px-3 text-destructive font-mono">{sub.missed}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{sub.totalClasses}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold ${sub.isShortfall ? 'text-destructive' : 'text-success'}`}>
                        {sub.percentage}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={sub.isShortfall ? 'destructive' : 'success'}
                        className="text-[10px]"
                      >
                        {sub.isShortfall ? 'Shortfall (<75%)' : 'Eligible'}
                      </Badge>
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

      {/* Chronological Attendance History Table */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Session-by-Session Attendance Log
          </CardTitle>
          <CardDescription className="text-xs">
            Chronological audit trail of lecture sessions attended or missed by the student
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No individual session records found.</p>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10 border-b border-border/60">
                  <tr className="text-muted-foreground font-semibold text-left">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Faculty / Evaluator</th>
                    <th className="py-2.5 px-3">Attendance Status</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {attendanceHistory.map((h) => {
                    const isAttended = h.status === 'PRESENT' || h.status === 'LATE' || h.status === 'EXCUSED';
                    return (
                      <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">{h.date}</td>
                        <td className="py-2 px-3 font-medium text-foreground">
                          {h.subjectName} {h.subjectCode && <span className="font-mono text-muted-foreground">({h.subjectCode})</span>}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{h.facultyName}</td>
                        <td className="py-2 px-3">
                          <Badge
                            variant={isAttended ? 'success' : 'destructive'}
                            className="text-[10px] font-semibold"
                          >
                            {h.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground italic">{h.remarks || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
