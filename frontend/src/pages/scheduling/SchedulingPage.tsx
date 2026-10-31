import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, Sparkles, RefreshCw, Calendar, Upload } from 'lucide-react';
import { TimetableViewer } from '@/components/timetable/TimetableViewer';
import { FacultyTimetableViewer } from '@/components/timetable/FacultyTimetableViewer';
import { DemoAttendanceModal } from '@/components/timetable/DemoAttendanceModal';
import { TimetableImportPage } from '@/pages/academic/import/TimetableImportPage';
import api from '../../api/axios';
import { useAuth } from '@/context/AuthContext';

export const SchedulingPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as 'schedules' | 'import') || 'schedules';

  const roleCode = user?.role?.code || (typeof (user as any)?.role === 'string' ? (user as any).role : '');
  const isSuperAdmin = roleCode === 'SUPER_ADMIN';
  const isFaculty = roleCode === 'FACULTY' || !!user?.faculty;
  const isAdminOrHOD = ['SUPER_ADMIN', 'ADMIN', 'HOD'].includes(roleCode);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);
  const monthLaterIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(monthLaterIso);
  const [msg, setMsg] = useState<string | null>(null);

  // Demo Attendance Modal states
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoSchedule, setDemoSchedule] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleTabChange = (tab: 'schedules' | 'import') => {
    setSearchParams(tab === 'schedules' ? {} : { tab });
  };

  const handleSyncTimetables = async () => {
    setIsSyncing(true);
    try {
      await api.post('/admin/timetable-imports/sync-schedules');
    } catch (e) {
      console.error('Failed to sync timetables:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setMsg(null);
    try {
      const response = await api.post('/schedules/generate', { startDate, endDate });
      setMsg(response.data.message);
      setTimeout(() => setIsGenerateModalOpen(false), 1500);
    } catch (err: any) {
      setMsg(err.response?.data?.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Faculty view has its dedicated past & upcoming lecture viewer without admin configurations or import tabs
  if (isFaculty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Timetables & Schedules</h1>
          <p className="text-xs text-muted-foreground">
            View your assigned lecture timetable and verify past classroom attendance
          </p>
        </div>
        <FacultyTimetableViewer />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Timetables & Schedules</h1>
          <p className="text-xs text-muted-foreground">
            {currentTab === 'import'
              ? 'Automated AI extraction, match verification, and scheduling of academic master timetables.'
              : 'Academic configuration timetable management and daily lecture schedule generator.'}
          </p>
        </div>

        {/* Tab Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl border border-border/80">
            <button
              onClick={() => handleTabChange('schedules')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                currentTab === 'schedules'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Timetables & Schedules
            </button>
            <button
              onClick={() => handleTabChange('import')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                currentTab === 'import'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Timetable PDF Import
            </button>
          </div>

          {currentTab === 'schedules' && !isSuperAdmin && isAdminOrHOD && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setDemoSchedule(null);
                  setIsDemoModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 h-8 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Demo: Test Student Attendance
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncTimetables}
                disabled={isSyncing}
                className="flex items-center gap-1.5 h-8 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
                Sync Daily Sessions
              </Button>
              <Button size="sm" onClick={() => setIsGenerateModalOpen(true)} className="h-8 text-xs">
                <Play className="w-3.5 h-3.5 mr-1" />
                Generate Semester Schedule
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {currentTab === 'schedules' ? (
        <section>
          <TimetableViewer />
        </section>
      ) : (
        <section>
          <TimetableImportPage embedded />
        </section>
      )}

      {/* Generate Schedules Dialog */}
      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Generate Semester Schedules</DialogTitle>
            <DialogDescription>
              Select a date range to automatically generate daily lecture sessions from active weekly timetable templates.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerate} className="space-y-4 pt-2">
            {msg && (
              <div className="p-3 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                {msg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-xs">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-xs">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsGenerateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isGenerating}>
                {isGenerating ? "Generating..." : "Run Generator"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Demo Attendance Modal */}
      <DemoAttendanceModal
        open={isDemoModalOpen}
        onOpenChange={setIsDemoModalOpen}
        scheduleId={demoSchedule?.id}
        lectureDetails={demoSchedule ? {
          subjectName: demoSchedule.template?.subject?.name,
          subjectCode: demoSchedule.template?.subject?.code,
          facultyName: `${demoSchedule.template?.faculty?.firstName || ''} ${demoSchedule.template?.faculty?.lastName || ''}`.trim(),
          roomNumber: demoSchedule.template?.room?.code,
          sectionName: demoSchedule.template?.section?.name,
          startTime: demoSchedule.template?.startTime,
          endTime: demoSchedule.template?.endTime,
        } : undefined}
        onSuccess={() => {}}
      />
    </div>
  );
};
