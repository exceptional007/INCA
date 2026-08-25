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
import { Calendar, Play, Clock, Sparkles } from 'lucide-react';
import api from '../../api/axios';
import { type ColumnDef } from '@tanstack/react-table';

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
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timetables & Schedules</h1>
          <p className="text-sm text-muted-foreground">Weekly recurring templates and auto-generated daily lectures</p>
        </div>

        <Button onClick={() => setIsGenerateModalOpen(true)}>
          <Play className="w-4 h-4 mr-2" />
          Generate Semester Schedule
        </Button>
      </div>

      {/* Templates Summary Grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Weekly Templates ({templates.length})
        </h2>
        
        {templates.length === 0 && !isLoading ? (
          <Card className="p-6 text-center text-muted-foreground text-sm bg-muted/50">
            No weekly templates created yet.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-semibold">{getDayName(t.dayOfWeek)}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" /> {t.startTime} - {t.endTime}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div>
                    <h3 className="font-semibold">{t.subject?.name || 'Subject'}</h3>
                    <p className="text-xs text-muted-foreground">Section: {t.section?.name || 'A'}</p>
                  </div>
                  <div className="pt-3 mt-3 border-t text-xs text-muted-foreground flex justify-between">
                    <span>Room: {t.room?.code || '101'}</span>
                    <span>Faculty: {t.faculty?.firstName || 'Faculty'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Generated Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Generated Daily Schedules
          </CardTitle>
          <CardDescription>View upcoming generated sessions.</CardDescription>
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
              Select a date range to automatically generate lecture schedule rows from active weekly templates.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleGenerate} className="space-y-4 pt-4">
            {msg && (
              <div className="p-3 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">
                {msg}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsGenerateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? "Generating..." : "Run Generator"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
