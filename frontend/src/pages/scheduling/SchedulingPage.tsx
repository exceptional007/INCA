import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Calendar, Play, Clock, Sparkles } from 'lucide-react';
import api from '../../api/axios';

export const SchedulingPage: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const [startDate, setStartDate] = useState('2026-08-21');
  const [endDate, setEndDate] = useState('2026-08-27');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [schedRes, tempRes] = await Promise.all([
        api.get('/schedules'),
        api.get('/schedule-templates'),
      ]);
      setSchedules(schedRes.data.data || []);
      setTemplates(tempRes.data.data || []);
    } catch (err) {
      console.error('Error fetching schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setMsg(null);
    try {
      const response = await api.post('/schedules/generate', { startDate, endDate });
      setMsg(response.data.message);
      fetchData();
      setTimeout(() => setIsGenerateModalOpen(false), 1500);
    } catch (err: any) {
      setMsg(err.response?.data?.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getDayName = (day: number) => {
    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[day] || `Day ${day}`;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Timetables & Schedules</h1>
          <p className="text-sm text-slate-400">Weekly recurring templates and auto-generated daily lectures</p>
        </div>

        <Button
          variant="primary"
          icon={<Play className="w-4 h-4" />}
          onClick={() => setIsGenerateModalOpen(true)}
        >
          Generate Semester Schedule
        </Button>
      </div>

      {/* Templates Summary Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" /> Weekly Templates ({templates.length})
        </h2>
        {isLoading ? (
          <LoadingSpinner />
        ) : templates.length === 0 ? (
          <Card className="p-6 text-center text-slate-400 text-sm">
            No weekly templates created yet.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <Card key={t.id} hoverable className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="indigo">{getDayName(t.dayOfWeek)}</Badge>
                  <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5" /> {t.startTime} - {t.endTime}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">{t.subject?.name || 'Subject'}</h3>
                  <p className="text-xs text-slate-400">Section: {t.section?.name || 'A'}</p>
                </div>
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
                  <span>Room: {t.room?.code || '101'}</span>
                  <span>Faculty: {t.faculty?.firstName || 'Faculty'}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Generated Schedules List */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" /> Generated Daily Schedules ({schedules.length})
        </h2>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Date</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Section & Room</th>
                  <th className="p-4">Faculty</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {schedules.slice(0, 10).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="p-4 font-mono text-xs text-slate-300">
                      {new Date(s.lectureDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-medium text-slate-100">{s.template?.subject?.name || 'Lecture'}</td>
                    <td className="p-4 text-xs text-slate-400">
                      Section {s.template?.section?.name || '—'} ({s.template?.room?.code || '—'})
                    </td>
                    <td className="p-4 text-xs text-slate-300">{s.template?.faculty?.firstName || '—'}</td>
                    <td className="p-4">
                      <Badge
                        variant={
                          s.status === 'COMPLETED'
                            ? 'success'
                            : s.status === 'CANCELLED'
                            ? 'danger'
                            : s.status === 'RESCHEDULED'
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {s.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Generate Schedules Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Semester Daily Schedules"
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          <p className="text-xs text-slate-400">
            Select a date range to automatically generate lecture schedule rows from active weekly templates.
          </p>

          {msg && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              {msg}
            </div>
          )}

          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />

          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsGenerateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isGenerating}>
              Run Generator
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
