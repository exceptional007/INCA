import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/data-table';
import { BarChart3, AlertTriangle, Search, Target } from 'lucide-react';
import api from '../../api/axios';
import { type ColumnDef } from '@tanstack/react-table';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<'student' | 'section' | 'subject' | 'faculty'>('subject');
  const [targetId, setTargetId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [reportData, setReportData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetId) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      let endpoint = `/reports/${reportType}/${targetId}`;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const res = await api.get(endpoint);
      setReportData(res.data.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to fetch report');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'rollNumber',
      header: 'Roll Number',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold">
          {row.original.student?.rollNumber || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Student Name',
      cell: ({ row }) => <span className="font-medium">{row.original.student?.name || 'Student'}</span>,
    },
    {
      id: 'attended',
      header: 'Attended / Total',
      cell: ({ row }) => {
        const st = row.original;
        const attended = st.attended ?? st.overall?.attended;
        const total = st.totalClasses ?? st.overall?.totalClasses;
        return <span className="text-muted-foreground">{attended} / {total}</span>;
      },
    },
    {
      id: 'percentage',
      header: 'Percentage',
      cell: ({ row }) => {
        const st = row.original;
        const pct = st.percentage ?? st.overall?.percentage ?? 0;
        return (
          <span className={`font-bold ${pct < 75 ? 'text-destructive' : 'text-success'}`}>
            {pct}%
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const st = row.original;
        const pct = st.percentage ?? st.overall?.percentage ?? 0;
        const isShortfall = st.isShortfall || pct < 75;
        return (
          <Badge variant={isShortfall ? 'destructive' : 'outline'} className={!isShortfall ? 'text-success border-success' : ''}>
            {isShortfall ? 'Shortfall (<75%)' : 'Eligible'}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Shortfall Analytics</h1>
          <p className="text-sm text-muted-foreground">Generate student, subject, section, and faculty attendance summaries</p>
        </div>
      </div>

      {/* Controls & Filter Form */}
      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
          <CardDescription>Select report type and target entity.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={fetchReport} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 p-1 bg-muted rounded-xl max-w-fit">
              {(['subject', 'student', 'section', 'faculty'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setReportType(t);
                    setTargetId('');
                    setReportData(null);
                  }}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all capitalize cursor-pointer ${
                    reportType === t
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label>{reportType.toUpperCase()} ID</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Enter ${reportType} UUID...`}
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Start Date (Optional)</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isLoading} className="gap-2">
                {isLoading ? "Generating..." : <><BarChart3 className="w-4 h-4" /> Generate Report</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {errorMsg && (
        <Card className="p-4 bg-destructive/10 border-destructive/20 text-destructive text-sm font-medium">
          {errorMsg}
        </Card>
      )}

      {/* Report Data Views */}
      {reportData && !isLoading && (
        <div className="space-y-6">
          {/* Header summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4" /> Target Entity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reportData.subject?.name || reportData.student?.name || reportData.section?.name || reportData.faculty?.name || 'Target'}
                </div>
              </CardContent>
            </Card>

            {reportData.shortfallCount !== undefined && (
              <Card className="border-l-4 border-l-destructive">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" /> Shortfall Warning (&lt; 75%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {reportData.shortfallCount} Students
                  </div>
                </CardContent>
              </Card>
            )}

            {reportData.totalSessions !== undefined && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">
                    Total Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {reportData.totalSessions} Conducted
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Detailed Student List */}
          {reportData.students && (
            <Card>
              <CardHeader>
                <CardTitle>Student Attendance Breakdowns</CardTitle>
                <CardDescription>Individual attendance records for the target entity.</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable columns={columns} data={reportData.students} searchKey="name" />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
