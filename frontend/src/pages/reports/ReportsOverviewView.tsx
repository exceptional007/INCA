import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

interface InstitutionalOverviewData {
  metrics: {
    totalStudents: number;
    activeStudents: number;
    inactiveStudents: number;
    totalFaculty: number;
    activeFaculty: number;
    inactiveFaculty: number;
    totalDepartments: number;
    totalSections: number;
    totalSubjects: number;
    scheduledClassesCount: number;
    cancelledClassesCount: number;
    conductedSessionsCount: number;
    totalEvaluatedRecords: number;
    presentRecords: number;
    absentRecords: number;
    overallAttendanceRate: number;
    shortfallCount: number;
    evaluatedStudentsCount: number;
    attendanceAuditsCount: number;
  };
  distribution: {
    above75: number;
    between65and75: number;
    below65: number;
  };
  attendanceTrends: Array<{
    date: string;
    present: number;
    absent: number;
    total: number;
    rate: number;
  }>;
  departmentSummaries: Array<{
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    sessionsCount: number;
    totalRecords: number;
    presentRecords: number;
    attendanceRate: number;
  }>;
  topShortfallStudents: Array<{
    id: string;
    name: string;
    rollNumber: string;
    departmentName: string;
    sectionName: string;
    totalClasses: number;
    attended: number;
    missed: number;
    percentage: number;
    severity: 'moderate' | 'critical';
  }>;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
}

interface ReportsOverviewViewProps {
  data: InstitutionalOverviewData;
  onDrillDownStudent: (studentId: string) => void;
  onDrillDownDepartment: (departmentId: string) => void;
}

export const ReportsOverviewView: React.FC<ReportsOverviewViewProps> = ({
  data,
  onDrillDownStudent,
  onDrillDownDepartment,
}) => {
  const { metrics, distribution, attendanceTrends, departmentSummaries, topShortfallStudents } = data;

  const totalEvaluated = distribution.above75 + distribution.between65and75 + distribution.below65 || 1;
  const goodPct = Math.round((distribution.above75 / totalEvaluated) * 100);
  const warnPct = Math.round((distribution.between65and75 / totalEvaluated) * 100);
  const critPct = Math.round((distribution.below65 / totalEvaluated) * 100);

  return (
    <div className="space-y-6">
      {/* Institutional Overview KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Attendance Rate */}
        <Card className="border border-border/80 shadow-2xs relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Overall Attendance Rate</span>
              <Activity className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold tracking-tight ${
                  metrics.overallAttendanceRate >= 75 ? 'text-foreground' : 'text-destructive'
                }`}
              >
                {metrics.overallAttendanceRate}%
              </span>
              <Badge
                variant={metrics.overallAttendanceRate >= 75 ? 'success' : 'destructive'}
                className="text-[10px] font-semibold"
              >
                {metrics.overallAttendanceRate >= 75 ? 'Eligible Tier' : 'Shortfall Alert'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.presentRecords.toLocaleString()} of {metrics.totalEvaluatedRecords.toLocaleString()} attendance records present
            </p>
          </CardContent>
        </Card>

        {/* Shortfall Risk Count */}
        <Card className="border border-destructive/30 bg-destructive/5 shadow-2xs relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center justify-between">
              <span>Students in Shortfall (&lt;75%)</span>
              <ShieldAlert className="w-4 h-4 text-destructive" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-destructive">
                {metrics.shortfallCount}
              </span>
              <span className="text-xs text-destructive/80 font-medium">
                ({Math.round(((metrics.shortfallCount) / (metrics.activeStudents || 1)) * 100)}% of cohort)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Below statutory 75% exam eligibility threshold
            </p>
          </CardContent>
        </Card>

        {/* Active Campus Cohort */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Active Students / Faculty</span>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {metrics.activeStudents.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                / {metrics.activeFaculty} Faculty
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {metrics.totalDepartments} departments & {metrics.totalSections} sections
            </p>
          </CardContent>
        </Card>

        {/* Academic Operations */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Classes Conducted</span>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {metrics.conductedSessionsCount}
              </span>
              <span className="text-xs text-muted-foreground">
                Sessions ({metrics.scheduledClassesCount} scheduled)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.cancelledClassesCount} cancelled • {metrics.attendanceAuditsCount} records audited
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Distribution Cards */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Student Attendance Distribution & Shortfall Tiers
          </CardTitle>
          <CardDescription className="text-xs">
            Categorization based on statutory 75% attendance threshold for examined coursework
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Good Standing */}
            <div className="p-4 rounded-xl border border-success/30 bg-success/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-success flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> High Attendance (≥ 75%)
                </span>
                <Badge variant="success" className="text-[10px]">Eligible</Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {distribution.above75}{' '}
                <span className="text-xs font-normal text-muted-foreground">students</span>
              </div>
              <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                <div className="bg-success h-full rounded-full" style={{ width: `${goodPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">{goodPct}% of evaluated cohort</p>
            </div>

            {/* Moderate Risk */}
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Moderate Shortfall (65% – 74%)
                </span>
                <Badge variant="warning" className="text-[10px]">Warning</Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {distribution.between65and75}{' '}
                <span className="text-xs font-normal text-muted-foreground">students</span>
              </div>
              <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${warnPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">{warnPct}% of cohort at immediate risk</p>
            </div>

            {/* Critical Shortfall */}
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Severe Shortfall (&lt; 65%)
                </span>
                <Badge variant="destructive" className="text-[10px]">Critical</Badge>
              </div>
              <div className="text-2xl font-bold text-destructive">
                {distribution.below65}{' '}
                <span className="text-xs font-normal text-muted-foreground">students</span>
              </div>
              <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                <div className="bg-destructive h-full rounded-full" style={{ width: `${critPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">{critPct}% ineligible without condonation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend Line Chart */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Turnout & Attendance Trends Over Time</span>
              <Badge variant="outline" className="text-[10px] font-medium">Turnout %</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Daily turnout percentage across recorded academic sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full pt-2">
              {attendanceTrends.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs space-y-2">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                  <p>No historical attendance sessions recorded yet for this date range.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(str: string) => {
                        try {
                          const d = new Date(str);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        } catch {
                          return str;
                        }
                      }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      unit="%"
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val}% Attendance`, 'Turnout Rate']}
                      labelFormatter={(lbl: any) => `Date: ${lbl}`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#rateGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Department-wise Attendance Comparison Bar Chart */}
        <Card className="border border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Department Attendance Performance</span>
              <Badge variant="outline" className="text-[10px] font-medium">Comparison</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Average student attendance percentage grouped by department
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full pt-2">
              {departmentSummaries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs space-y-2">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                  <p>No department records available.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentSummaries} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="departmentCode"
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
                      labelFormatter={(lbl: any) => `Department Code: ${lbl}`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Bar dataKey="attendanceRate" radius={[4, 4, 0, 0]}>
                      {departmentSummaries.map((entry, index) => (
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
      </div>

      {/* Top Shortfall Students Drill-Down Table */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Priority Shortfall Students Requiring Administrative Review
            </CardTitle>
            <CardDescription className="text-xs">
              Students falling below the statutory 75% attendance threshold. Click any row to inspect complete student report.
            </CardDescription>
          </div>
          <Badge variant="destructive" className="text-xs">
            {topShortfallStudents.length} Students Listed
          </Badge>
        </CardHeader>
        <CardContent>
          {topShortfallStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-success" />
              <p className="font-medium text-foreground">No attendance shortfalls detected.</p>
              <p>All active students evaluated in this period maintain 75% or higher attendance.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-semibold text-left">
                    <th className="py-2.5 px-3">Roll Number</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Attended / Total</th>
                    <th className="py-2.5 px-3">Attendance %</th>
                    <th className="py-2.5 px-3">Shortfall Severity</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {topShortfallStudents.map((st) => (
                    <tr
                      key={st.id}
                      onClick={() => onDrillDownStudent(st.id)}
                      className="hover:bg-muted/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                        {st.rollNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground flex items-center gap-2">
                        {st.name}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{st.departmentName}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">Sec {st.sectionName}</td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono">
                        {st.attended} / {st.totalClasses}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-destructive">{st.percentage}%</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={st.severity === 'critical' ? 'destructive' : 'warning'}
                          className="text-[10px]"
                        >
                          {st.severity === 'critical' ? 'Severe (<65%)' : 'Moderate (<75%)'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-primary group-hover:translate-x-0.5 transition-transform"
                        >
                          <span>Inspect</span>
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

      {/* Department Performance Summaries Table */}
      <Card className="border border-border/80 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Department Turnout Breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            Academic departments and their aggregate classroom attendance performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-semibold text-left">
                  <th className="py-2.5 px-3">Department Name</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Conducted Sessions</th>
                  <th className="py-2.5 px-3">Total Evaluated Records</th>
                  <th className="py-2.5 px-3">Present Records</th>
                  <th className="py-2.5 px-3">Average Turnout</th>
                  <th className="py-2.5 px-3 text-right">Filter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {departmentSummaries.map((dept) => (
                  <tr key={dept.departmentId} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-foreground">{dept.departmentName}</td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">{dept.departmentCode}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{dept.sessionsCount}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{dept.totalRecords.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{dept.presentRecords.toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold ${
                          dept.attendanceRate >= 75 ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        {dept.attendanceRate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDrillDownDepartment(dept.departmentId)}
                        className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer"
                      >
                        <span>Filter Scope</span>
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
    </div>
  );
};
