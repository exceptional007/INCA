import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { DataTable } from '@/components/ui/data-table';
import { Play, Sparkles, UserCheck, RefreshCw } from 'lucide-react';
import { TimetableViewer } from '@/components/timetable/TimetableViewer';
import { DemoAttendanceModal } from '@/components/timetable/DemoAttendanceModal';
import api from '../../api/axios';
import { type ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/context/AuthContext';

export const SchedulingPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.code === 'SUPER_ADMIN';

  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const [startDate, setStartDate] = useState('2026-08-21');
  const [endDate, setEndDate] = useState('2026-08-27');
  const [msg, setMsg] = useState<string | null>(null);

  // Demo Attendance Modal states
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoSchedule, setDemoSchedule] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const schedRes = await api.get('/schedules');
      setSchedules(schedRes.data.data || []);
    } catch (err) {
      console.error('Error fetching schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncTimetables = async () => {
    setIsSyncing(true);
    try {
      await api.post('/admin/timetable-imports/sync-schedules');
      await fetchData();
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
      fetchData();
      setTimeout(() => setIsGenerateModalOpen(false), 1500);
    } catch (err: any) {
      setMsg(err.response?.data?.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'lectureDate',
      header: 'Date',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {new Date(row.original.lectureDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: ({ row }) => <span className="font-medium">{row.original.template?.subject?.name || 'Lecture'}</span>,
    },
    {
      id: 'sectionRoom',
      header: 'Section & Room',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          Section {row.original.template?.section?.name || '—'} ({row.original.template?.room?.code || '—'})
        </span>
      ),
    },
    {
      id: 'faculty',
      header: 'Faculty',
      cell: ({ row }) => <span>{row.original.template?.faculty?.firstName || '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant={
              status === 'COMPLETED'
                ? 'default'
                : status === 'CANCELLED'
                ? 'destructive'
                : status === 'RESCHEDULED'
                ? 'outline'
                : 'secondary'
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Attendance Demo',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30 font-medium flex items-center gap-1.5"
          onClick={() => {
            setDemoSchedule(row.original);
            setIsDemoModalOpen(true);
          }}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Test Attendance
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Timetables & Schedules</h1>
          <p className="text-xs text-muted-foreground">Academic configuration timetable management and daily lecture schedule generator</p>
        </div>

        {!isSuperAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              onClick={() => {
                setDemoSchedule(null);
                setIsDemoModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              Demo: Test Student Attendance
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncTimetables}
              disabled={isSyncing}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
              Sync Daily Sessions
            </Button>
            <Button size="sm" onClick={() => setIsGenerateModalOpen(true)}>
              <Play className="w-4 h-4 mr-2" />
              Generate Semester Schedule
            </Button>
          </div>
        )}
      </div>

      {/* Main Timetable Management System (AttendEase Style) */}
      <section>
        <TimetableViewer />
      </section>

      {/* Generated Daily Schedules List */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Generated Daily Lecture Sessions
          </CardTitle>
          <CardDescription className="text-xs">View upcoming daily sessions generated from weekly timetable templates.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={schedules.slice(0, 50)} isLoading={isLoading} />
        </CardContent>
      </Card>

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
        onSuccess={() => fetchData()}
      />
    </div>
  );
};
