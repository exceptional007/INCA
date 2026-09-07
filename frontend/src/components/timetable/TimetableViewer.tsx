import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Upload, Calendar, RefreshCw, Layers, Sparkles } from 'lucide-react';
import { AcademicConfigSelector } from './AcademicConfigSelector';
import { DayTabs } from './DayTabs';
import type { DayOfWeek } from './DayTabs';
import { LectureCard } from './LectureCard';
import type { LectureData } from './LectureCard';
import { AddEditLectureModal } from './AddEditLectureModal';
import { DeleteLectureDialog } from './DeleteLectureDialog';
import { TimetableUploadModal } from './TimetableUploadModal';
import { DemoAttendanceModal } from './DemoAttendanceModal';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';

export const TimetableViewer: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.code === 'SUPER_ADMIN';

  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [sectionDetails, setSectionDetails] = useState<any | null>(null);
  const [timetableStatus, setTimetableStatus] = useState<{ exists: boolean; versionId?: string; details?: any }>({ exists: false });

  const [activeDay, setActiveDay] = useState<DayOfWeek>('Monday');
  const [weeklySchedule, setWeeklySchedule] = useState<Record<DayOfWeek, LectureData[]>>({
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
  });

  const [isLoading, setIsLoading] = useState(false);

  // Modal states
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingLecture, setEditingLecture] = useState<LectureData | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingLecture, setDeletingLecture] = useState<LectureData | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Demo Attendance Modal states
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [demoSlotId, setDemoSlotId] = useState<string | undefined>(undefined);
  const [demoLectureDetails, setDemoLectureDetails] = useState<any | null>(null);

  useEffect(() => {
    if (selectedSectionId && timetableStatus.exists) {
      fetchActiveTimetable(selectedSectionId);
    } else {
      setWeeklySchedule({
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
      });
    }
  }, [selectedSectionId, timetableStatus.exists]);

  const fetchActiveTimetable = async (secId: string) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/admin/timetable-imports/active-section/${secId}`);
      const data = res.data.data;
      if (data && data.weeklySchedule) {
        setWeeklySchedule(data.weeklySchedule);
      }
    } catch (err) {
      console.error('Error fetching active timetable:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const parseTimeToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const str = timeStr.trim().toUpperCase();
    const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return 0;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3];

    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  };

  const handleSaveLecture = async (data: Partial<LectureData>) => {
    try {
      if (editingLecture && editingLecture.id) {
        const realId = editingLecture.id.replace(/-part2$|-p2$/, '');
        await api.patch(`/admin/timetable-imports/active-slots/${realId}`, data);
      } else if (timetableStatus.versionId) {
        await api.post(`/admin/timetable-imports/active-versions/${timetableStatus.versionId}/slots`, data);
      }
      if (selectedSectionId) {
        await fetchActiveTimetable(selectedSectionId);
      }
    } catch (err) {
      console.error('Failed to save lecture slot:', err);
    }
  };

  const handleDeleteLecture = async () => {
    if (!deletingLecture) return;
    try {
      const realId = deletingLecture.id.replace(/-part2$|-p2$/, '');
      await api.delete(`/admin/timetable-imports/active-slots/${realId}`);
      if (selectedSectionId) {
        await fetchActiveTimetable(selectedSectionId);
      }
    } catch (err) {
      console.error('Failed to delete lecture slot:', err);
    }
  };

  // Compute lecture counts per day
  const lectureCounts: Record<DayOfWeek, number> = {
    Monday: weeklySchedule.Monday?.length || 0,
    Tuesday: weeklySchedule.Tuesday?.length || 0,
    Wednesday: weeklySchedule.Wednesday?.length || 0,
    Thursday: weeklySchedule.Thursday?.length || 0,
    Friday: weeklySchedule.Friday?.length || 0,
    Saturday: weeklySchedule.Saturday?.length || 0,
  };

  const activeLectures = [...(weeklySchedule[activeDay] || [])].filter(Boolean);
  activeLectures.sort((a, b) => parseTimeToMinutes(a?.startTime) - parseTimeToMinutes(b?.startTime));
  activeLectures.forEach((lec, idx) => {
    lec.lectureNumber = idx + 1;
  });

  return (
    <div className="space-y-6">
      {/* 1. Academic Configuration Selector */}
      <AcademicConfigSelector
        onSectionSelect={(secId: string, details?: any) => {
          setSelectedSectionId(secId);
          setSectionDetails(details);
        }}
        onStatusChange={(st) => setTimetableStatus({ exists: !!st?.exists, details: st?.details, versionId: st?.details?.versionId })}
      />

      {/* Main Content Area */}
      {!selectedSectionId ? (
        <Card className="p-8 text-center bg-muted/30 border-dashed">
          <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
            <Layers className="w-10 h-10 stroke-1 text-primary/60" />
            <h4 className="font-semibold text-foreground text-sm">No Academic Section Selected</h4>
            <p className="text-xs max-w-sm">
              Please select a Department, Program, Semester, and Section above to view or configure its timetable.
            </p>
          </div>
        </Card>
      ) : !timetableStatus.exists ? (
        /* No Timetable Template Found State */
        <Card className="p-8 text-center bg-card border-border shadow-sm">
          <div className="flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">No Timetable Template Found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                No active timetable template has been saved for this academic configuration. Upload a PDF timetable to extract it via AI.
              </p>
            </div>

            {!isSuperAdmin && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button size="sm" onClick={() => setIsUploadOpen(true)} className="bg-primary text-primary-foreground">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Timetable PDF
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        /* Timetable View with Day Tabs & Lecture Cards */
        <div className="space-y-4">
          {/* Day Tabs Navigation */}
          <DayTabs
            activeDay={activeDay}
            onDayChange={setActiveDay}
            lectureCounts={lectureCounts}
          />

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {activeDay} Sessions ({activeLectures.length})
            </span>

            {!isSuperAdmin && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30 font-medium"
                  onClick={() => {
                    const firstLec = activeLectures[0];
                    setDemoSlotId(firstLec?.id);
                    setDemoLectureDetails(firstLec);
                    setIsDemoOpen(true);
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Test Attendance Demo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setIsUploadOpen(true)}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Replace Timetable
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setEditingLecture(null);
                    setIsAddEditOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Lecture
                </Button>
              </div>
            )}
          </div>

          {/* Lecture Cards Grid (Responsive 2-column or 1-column stack) */}
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              Loading section timetable from database...
            </div>
          ) : activeLectures.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-xs bg-muted/20 border-dashed">
              No lectures scheduled for {activeDay}.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeLectures.map((lecture, idx) => (
                <LectureCard
                  key={lecture.id || idx}
                  lecture={lecture}
                  index={idx}
                  readOnly={isSuperAdmin}
                  onEdit={(lec) => {
                    setEditingLecture(lec);
                    setIsAddEditOpen(true);
                  }}
                  onDelete={(lec) => {
                    setDeletingLecture(lec);
                    setIsDeleteOpen(true);
                  }}
                  onTestAttendance={(lec) => {
                    setDemoSlotId(lec.id);
                    setDemoLectureDetails(lec);
                    setIsDemoOpen(true);
                  }}
                />
              ))}

              {/* Add Lecture Card at bottom of grid */}
              {!isSuperAdmin && (
                <button
                  onClick={() => {
                    setEditingLecture(null);
                    setIsAddEditOpen(true);
                  }}
                  className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center bg-muted/10 hover:bg-primary/5 transition-all duration-200 flex flex-col items-center justify-center min-h-[140px] text-muted-foreground hover:text-primary group"
                >
                  <div className="w-9 h-9 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center mb-2 transition-colors">
                    <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <span className="text-xs font-bold text-foreground group-hover:text-primary">Add Lecture</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">Add an extra class or elective for {activeDay}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AddEditLectureModal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        onSave={handleSaveLecture}
        lecture={editingLecture}
        defaultDay={activeDay}
      />

      <DeleteLectureDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteLecture}
        lecture={deletingLecture}
      />

      <TimetableUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        sectionId={selectedSectionId}
        sectionDetails={sectionDetails}
        onSuccess={() => {
          if (selectedSectionId) {
            // Re-check timetable status
            setTimetableStatus({ exists: true });
          }
        }}
      />

      {/* Demo Attendance Modal */}
      <DemoAttendanceModal
        open={isDemoOpen}
        onOpenChange={setIsDemoOpen}
        slotId={demoSlotId}
        sectionId={selectedSectionId}
        lectureDetails={demoLectureDetails}
      />
    </div>
  );
};
