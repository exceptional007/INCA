import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, AlertTriangle } from 'lucide-react';
import { DayTabs } from '@/components/timetable/DayTabs';
import type { DayOfWeek } from '@/components/timetable/DayTabs';
import { LectureCard } from '@/components/timetable/LectureCard';
import type { LectureData } from '@/components/timetable/LectureCard';
import { AddEditLectureModal } from '@/components/timetable/AddEditLectureModal';
import { DeleteLectureDialog } from '@/components/timetable/DeleteLectureDialog';

interface SlotDraft {
  id: string;
  gridId: string;
  day: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  isMergedSlot: boolean;
  mergedTimeSlotEnd: string | null;
  sectionCodes: string[];
  subjectRaw: string;
  facultyRaw: string;
  room: string;
  category: string;
  matchedSubjectId: string | null;
  matchedFacultyId: string | null;
  matchedRoomId: string | null;
  matchedSectionId: string | null;
  matchConfidence: number;
  rawCellText: string;
  applyToSimilar?: boolean;
}

interface TimetableReviewGridProps {
  batchId: string;
  slots: SlotDraft[];
  pages?: Array<{ pageNumber: number; imageR2Key: string; rawText: string }>;
  onUpdateSlot: (slotId: string, data: Partial<SlotDraft>) => Promise<void>;
  onAddSlot: (data: Omit<SlotDraft, 'id'>) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
  onApprove: () => Promise<void>;
  isApproving: boolean;
  conflicts: any[];
}

export const TimetableReviewGrid: React.FC<TimetableReviewGridProps> = ({
  slots,
  onUpdateSlot,
  onAddSlot,
  onDeleteSlot,
}) => {
  const [activeDay, setActiveDay] = useState<DayOfWeek>('Monday');

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingLecture, setEditingLecture] = useState<LectureData | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingLecture, setDeletingLecture] = useState<LectureData | null>(null);

  const dayCodeMap: Record<string, DayOfWeek> = {
    MON: 'Monday', MONDAY: 'Monday',
    TUES: 'Tuesday', TUESDAY: 'Tuesday',
    WED: 'Wednesday', WEDNESDAY: 'Wednesday',
    THU: 'Thursday', THURS: 'Thursday', THURSDAY: 'Thursday',
    FRI: 'Friday', FRIDAY: 'Friday',
    SAT: 'Saturday', SATURDAY: 'Saturday',
  };

  const reverseDayMap: Record<DayOfWeek, string> = {
    Monday: 'MON',
    Tuesday: 'TUES',
    Wednesday: 'WED',
    Thursday: 'THU',
    Friday: 'FRI',
    Saturday: 'SAT',
  };

  const expandMergedSlots = (rawSlots: SlotDraft[]): SlotDraft[] => {
    const expanded: SlotDraft[] = [];

    const periodMap: Record<string, { start: string; end: string; nextStart: string; nextEnd: string; twoPeriodEnd: string }> = {
      '09:10 AM': { start: '09:10 AM', end: '10:05 AM', nextStart: '10:05 AM', nextEnd: '11:00 AM', twoPeriodEnd: '11:00 AM' },
      '9:10 AM': { start: '09:10 AM', end: '10:05 AM', nextStart: '10:05 AM', nextEnd: '11:00 AM', twoPeriodEnd: '11:00 AM' },
      '11:15 AM': { start: '11:15 AM', end: '12:10 PM', nextStart: '12:10 PM', nextEnd: '01:05 PM', twoPeriodEnd: '01:05 PM' },
      '01:45 PM': { start: '01:45 PM', end: '02:40 PM', nextStart: '02:40 PM', nextEnd: '03:35 PM', twoPeriodEnd: '03:35 PM' },
      '1:45 PM': { start: '01:45 PM', end: '02:40 PM', nextStart: '02:40 PM', nextEnd: '03:35 PM', twoPeriodEnd: '03:35 PM' },
      '02:40 PM': { start: '02:40 PM', end: '03:35 PM', nextStart: '03:35 PM', nextEnd: '04:30 PM', twoPeriodEnd: '04:30 PM' },
      '2:40 PM': { start: '02:40 PM', end: '03:35 PM', nextStart: '03:35 PM', nextEnd: '04:30 PM', twoPeriodEnd: '04:30 PM' },
    };

    for (const slot of rawSlots) {
      const sStart = (slot.timeSlotStart || '').trim();
      const sEnd = (slot.timeSlotEnd || slot.mergedTimeSlotEnd || '').trim();
      const pInfo = periodMap[sStart];

      const isMultiPeriodSpan = pInfo && (
        sEnd.includes(pInfo.twoPeriodEnd) ||
        (slot.mergedTimeSlotEnd && slot.mergedTimeSlotEnd.includes(pInfo.twoPeriodEnd))
      );

      if (isMultiPeriodSpan && pInfo) {
        expanded.push({
          ...slot,
          timeSlotStart: pInfo.start,
          timeSlotEnd: pInfo.end,
          isMergedSlot: true,
        });

        expanded.push({
          ...slot,
          id: `${slot.id}-p2`,
          timeSlotStart: pInfo.nextStart,
          timeSlotEnd: pInfo.nextEnd,
          isMergedSlot: true,
        });
      } else {
        expanded.push(slot);
      }
    }

    const uniqueSlots: SlotDraft[] = [];
    const seenKeys = new Set<string>();

    for (const slot of expanded) {
      const dayStr = (slot.day || '').toUpperCase().trim();
      const startStr = (slot.timeSlotStart || '').trim();
      const endStr = (slot.timeSlotEnd || '').trim();
      const subStr = (slot.subjectRaw || '').toUpperCase().trim();
      const key = `${dayStr}_${startStr}_${endStr}_${subStr}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueSlots.push(slot);
      }
    }

    return uniqueSlots;
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

  // Group slots by day after expanding merged sessions
  const weeklySchedule: Record<DayOfWeek, LectureData[]> = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
  };

  const parseSubjectRaw = (raw: string) => {
    const clean = (raw || '').trim();
    if (!clean) return { code: 'SUB', name: '' };

    const dashMatch = clean.match(/^([A-Z0-9\s]{2,12})\s*[-:]\s*(.+)$/i);
    if (dashMatch && dashMatch[1].trim().length >= 2) {
      return {
        code: dashMatch[1].trim().toUpperCase(),
        name: dashMatch[2].trim(),
      };
    }

    const codeMatch = clean.match(/\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b/i);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      const name = clean.replace(codeMatch[0], '').replace(/^[-:\s]+|[-:\s]+$/g, '').trim();
      return {
        code,
        name: name || clean,
      };
    }

    const parts = clean.split(/\s+/);
    const firstWord = parts[0].toUpperCase();
    return {
      code: firstWord.substring(0, 10),
      name: parts.slice(1).join(' ') || clean,
    };
  };

  const processedSlots = expandMergedSlots(slots);

  processedSlots.forEach((slot) => {
    const fullDay = dayCodeMap[slot.day?.toUpperCase()] || 'Monday';
    const { code: subjectCode, name: subjectName } = parseSubjectRaw(slot.subjectRaw);

    const lectureItem: LectureData = {
      id: slot.id,
      lectureNumber: 1,
      subjectCode,
      subjectName,
      facultyName: slot.facultyRaw || '',
      roomNumber: slot.room || '',
      startTime: slot.timeSlotStart || '',
      endTime: slot.timeSlotEnd || '',
      isLab: slot.isMergedSlot,
      batchSection: slot.sectionCodes && slot.sectionCodes.length > 0 ? slot.sectionCodes.join('+') : 'All',
      category: slot.category || 'academic',
      dayOfWeek: fullDay,
      matchedSubjectId: slot.matchedSubjectId,
      matchedFacultyId: slot.matchedFacultyId,
    };

    weeklySchedule[fullDay].push(lectureItem);
  });

  // Sort each day's lectures chronologically by start time
  (Object.keys(weeklySchedule) as DayOfWeek[]).forEach((day) => {
    weeklySchedule[day] = (weeklySchedule[day] || []).filter(Boolean);
    weeklySchedule[day].sort((a, b) => parseTimeToMinutes(a?.startTime) - parseTimeToMinutes(b?.startTime));
    weeklySchedule[day].forEach((lec, idx) => {
      lec.lectureNumber = idx + 1;
    });
  });

  const lectureCounts: Record<DayOfWeek, number> = {
    Monday: weeklySchedule.Monday.length,
    Tuesday: weeklySchedule.Tuesday.length,
    Wednesday: weeklySchedule.Wednesday.length,
    Thursday: weeklySchedule.Thursday.length,
    Friday: weeklySchedule.Friday.length,
    Saturday: weeklySchedule.Saturday.length,
  };

  const activeLectures = weeklySchedule[activeDay] || [];

  const unassignedTeacherCount = slots.filter(
    (s) => !s.facultyRaw || s.facultyRaw.trim() === '' || s.facultyRaw.toLowerCase().includes('unassigned') || !s.matchedFacultyId,
  ).length;

  const unassignedSubjectCount = slots.filter(
    (s) => !s.subjectRaw || s.subjectRaw.trim() === '' || s.subjectRaw.toLowerCase().includes('unassigned') || !s.matchedSubjectId,
  ).length;

  const handleSaveLecture = async (data: Partial<LectureData>) => {
    const dayCode = reverseDayMap[data.dayOfWeek as DayOfWeek || activeDay] || 'MON';

    const subCode = (data.subjectCode || '').trim().toUpperCase();
    const subName = (data.subjectName || '').trim();

    let formattedSubjectRaw = subName;
    if (subCode && subName && !subName.toUpperCase().startsWith(subCode)) {
      formattedSubjectRaw = `${subCode} - ${subName}`;
    } else if (subCode && !subName) {
      formattedSubjectRaw = subCode;
    } else if (subName) {
      formattedSubjectRaw = subName;
    }

    if (editingLecture && editingLecture.id) {
      const realId = editingLecture.id.replace(/-part2$|-p2$/, '');
      await onUpdateSlot(realId, {
        day: dayCode,
        subjectRaw: formattedSubjectRaw,
        facultyRaw: data.facultyName || '',
        room: data.roomNumber || '',
        timeSlotStart: data.startTime || '',
        timeSlotEnd: data.endTime || '',
        isMergedSlot: !!data.isLab,
        category: data.category || 'academic',
        sectionCodes: data.batchSection ? [data.batchSection] : ['C'],
        matchedSubjectId: data.matchedSubjectId !== undefined ? data.matchedSubjectId : undefined,
        matchedFacultyId: data.matchedFacultyId !== undefined ? data.matchedFacultyId : undefined,
        applyToSimilar: data.applyToSimilar,
      });
    } else {
      await onAddSlot({
        gridId: slots[0]?.gridId || 'MAIN',
        day: dayCode,
        timeSlotStart: data.startTime || '09:10 AM',
        timeSlotEnd: data.endTime || '10:05 AM',
        isMergedSlot: !!data.isLab,
        mergedTimeSlotEnd: null,
        sectionCodes: data.batchSection ? [data.batchSection] : ['C'],
        subjectRaw: formattedSubjectRaw,
        facultyRaw: data.facultyName || '',
        room: data.roomNumber || '',
        category: data.category || 'academic',
        matchedSubjectId: data.matchedSubjectId || null,
        matchedFacultyId: data.matchedFacultyId || null,
        matchedRoomId: null,
        matchedSectionId: null,
        matchConfidence: 1.0,
        rawCellText: `${formattedSubjectRaw} (${data.facultyName})`,
      });
    }
  };

  const handleDeleteLecture = async () => {
    if (!deletingLecture) return;
    const realId = deletingLecture.id.replace(/-part2$|-p2$/, '');
    await onDeleteSlot(realId);
  };

  return (
    <div className="space-y-6">
      {/* Warning banner if slots have unassigned teachers or subjects */}
      {(unassignedTeacherCount > 0 || unassignedSubjectCount > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5 flex items-start gap-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-sm text-foreground">
              Attention: Unassigned Teachers or Subjects Detected
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
              {unassignedTeacherCount > 0 && (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  • {unassignedTeacherCount} lecture(s) without an assigned teacher
                </span>
              )}
              {unassignedSubjectCount > 0 && (
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  • {unassignedSubjectCount} lecture(s) without a matched subject
                </span>
              )}
            </div>
            <p className="text-muted-foreground pt-1">
              Click the <span className="font-semibold text-foreground">Pencil icon</span> on any card to assign registered teachers or subjects before approval.
            </p>
          </div>
        </div>
      )}

      {/* Full Width Modern AttendEase-Style Day-Wise Layout */}
      <Card className="shadow-md">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Extracted Timetable Preview</CardTitle>
            <CardDescription>Review extracted lecture cards, edit details, or add missing sessions.</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingLecture(null);
              setIsAddEditOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Lecture
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Day Tabs */}
          <DayTabs
            activeDay={activeDay}
            onDayChange={setActiveDay}
            lectureCounts={lectureCounts}
          />

          {/* Lecture Cards Grid */}
          {activeLectures.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-xs bg-muted/20 border-dashed">
              No lectures extracted for {activeDay}. Click "+ Add Lecture" to add a session manually.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeLectures.map((lecture, idx) => (
                <LectureCard
                  key={lecture.id || idx}
                  lecture={lecture}
                  index={idx}
                  onEdit={(lec) => {
                    setEditingLecture(lec);
                    setIsAddEditOpen(true);
                  }}
                  onDelete={(lec) => {
                    setDeletingLecture(lec);
                    setIsDeleteOpen(true);
                  }}
                />
              ))}

              {/* Add Lecture Card Button */}
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
                <span className="text-[11px] text-muted-foreground mt-0.5">Add an extra class for {activeDay}</span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
};
