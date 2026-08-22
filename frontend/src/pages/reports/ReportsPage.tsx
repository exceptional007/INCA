import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { BarChart3, AlertTriangle, Search } from 'lucide-react';
import api from '../../api/axios';

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

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Reports & Shortfall Analytics</h1>
        <p className="text-sm text-slate-400">Generate student, subject, section, and faculty attendance summaries</p>
      </div>

      {/* Controls & Filter Form */}
      <Card className="p-6">
        <form onSubmit={fetchReport} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['subject', 'student', 'section', 'faculty'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setReportType(t);
                  setTargetId('');
                  setReportData(null);
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all capitalize cursor-pointer ${
                  reportType === t
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t} Report
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label={`${reportType.toUpperCase()} ID`}
              placeholder={`Enter ${reportType} UUID...`}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              required
            />
            <Input
              label="Start Date (Optional)"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date (Optional)"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" isLoading={isLoading} icon={<BarChart3 className="w-4 h-4" />}>
              Generate Report
            </Button>
          </div>
        </form>
      </Card>

      {errorMsg && (
        <Card className="p-4 bg-rose-500/10 border-rose-500/20 text-rose-400 text-sm font-medium">
          {errorMsg}
        </Card>
      )}

      {/* Report Data Views */}
      {isLoading ? (
        <LoadingSpinner label="Generating report analytics..." />
      ) : reportData ? (
        <div className="space-y-6">
          {/* Header summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Entity</span>
              <div className="text-xl font-bold text-white mt-1">
                {reportData.subject?.name || reportData.student?.name || reportData.section?.name || reportData.faculty?.name || 'Target'}
              </div>
            </Card>

            {reportData.shortfallCount !== undefined && (
              <Card className="p-5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shortfall Warning (&lt; 75%)</span>
                <div className="text-xl font-bold text-amber-400 mt-1 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  {reportData.shortfallCount} Students
                </div>
              </Card>
            )}

            {reportData.totalSessions !== undefined && (
              <Card className="p-5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sessions</span>
                <div className="text-xl font-bold text-indigo-400 mt-1">
                  {reportData.totalSessions} Conducted
                </div>
              </Card>
            )}
          </div>

          {/* Detailed Student List with Shortfall Warning Badges */}
          {reportData.students && (
            <Card className="p-0 overflow-hidden">
              <div className="p-4 bg-slate-900/40 border-b border-slate-800 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Student Attendance Breakdowns
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="p-4">Roll Number</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Attended / Total</th>
                      <th className="p-4">Percentage</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {reportData.students.map((st: any, idx: number) => {
                      const isShortfall = st.isShortfall || (st.overall?.percentage < 75);
                      const pct = st.percentage ?? st.overall?.percentage ?? 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="p-4 font-mono text-xs text-indigo-400 font-semibold">{st.student?.rollNumber || '—'}</td>
                          <td className="p-4 font-medium text-slate-100">{st.student?.name || 'Student'}</td>
                          <td className="p-4 text-xs text-slate-300">
                            {st.attended ?? st.overall?.attended} / {st.totalClasses ?? st.overall?.totalClasses}
                          </td>
                          <td className="p-4 font-bold text-sm">
                            <span className={pct < 75 ? 'text-amber-400' : 'text-emerald-400'}>
                              {pct}%
                            </span>
                          </td>
                          <td className="p-4">
                            <Badge variant={isShortfall ? 'warning' : 'success'}>
                              {isShortfall ? 'Shortfall (<75%)' : 'Eligible'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
};
