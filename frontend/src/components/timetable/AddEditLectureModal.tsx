import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, UserCheck, BookOpen, Search, RefreshCw } from 'lucide-react';
import api from '@/api/axios';
import type { LectureData } from './LectureCard';
import type { DayOfWeek } from './DayTabs';

interface AddEditLectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<LectureData>) => Promise<void>;
  lecture?: LectureData | null;
  defaultDay: DayOfWeek;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AddEditLectureModal: React.FC<AddEditLectureModalProps> = ({
  isOpen,
  onClose,
  onSave,
  lecture,
  defaultDay,
}) => {
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(defaultDay);
  const [lectureNumber, setLectureNumber] = useState<number>(1);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [startTime, setStartTime] = useState('09:10 AM');
  const [endTime, setEndTime] = useState('10:05 AM');
  const [isLab, setIsLab] = useState(false);
  const [sectionCode, setSectionCode] = useState('C');
  const [subBatch, setSubBatch] = useState('');
  const [applyToSimilar, setApplyToSimilar] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Mapped entities
  const [matchedSubjectId, setMatchedSubjectId] = useState<string | null>(null);
  const [matchedFacultyId, setMatchedFacultyId] = useState<string | null>(null);

  // Database lookups
  const [registeredSubjects, setRegisteredSubjects] = useState<any[]>([]);
  const [registeredFaculty, setRegisteredFaculty] = useState<any[]>([]);

  // Fetch registered subjects & faculty when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchLookups = async () => {
      try {
        const [subRes, facRes] = await Promise.all([
          api.get('/academic/departments/subjects').catch(() => ({ data: { data: [] } })),
          api.get('/faculty').catch(() => ({ data: { data: [] } })),
        ]);
        setRegisteredSubjects(subRes.data.data || []);
        setRegisteredFaculty(facRes.data.data || []);
      } catch (err) {
        console.error('Failed to load subjects or faculty lookups', err);
      }
    };

    fetchLookups();
  }, [isOpen]);

  useEffect(() => {
    if (lecture) {
      setDayOfWeek((lecture.dayOfWeek as DayOfWeek) || defaultDay);
      setLectureNumber(lecture.lectureNumber || 1);
      setSubjectName(lecture.subjectName || '');
      setSubjectCode(lecture.subjectCode || '');
      setFacultyName(lecture.facultyName || '');
      setRoomNumber(lecture.roomNumber || '');
      setStartTime(lecture.startTime || '09:10 AM');
      setEndTime(lecture.endTime || '10:05 AM');
      setIsLab(!!lecture.isLab);
      setMatchedSubjectId(lecture.matchedSubjectId || null);
      setMatchedFacultyId(lecture.matchedFacultyId || null);

      const tag = lecture.batchSection || 'C';
      if (/^[A-Z]\d+/.test(tag)) {
        setSectionCode(tag.charAt(0));
        setSubBatch(tag);
      } else {
        setSectionCode(tag.length === 1 ? tag : 'C');
        setSubBatch(tag !== 'All' && !tag.startsWith('Combined') ? tag : '');
      }
    } else {
      setDayOfWeek(defaultDay);
      setLectureNumber(1);
      setSubjectName('');
      setSubjectCode('');
      setFacultyName('');
      setRoomNumber('');
      setStartTime('09:10 AM');
      setEndTime('10:05 AM');
      setIsLab(false);
      setSectionCode('C');
      setSubBatch('');
      setMatchedSubjectId(null);
      setMatchedFacultyId(null);
    }
  }, [lecture, defaultDay]);

  // Attempt auto-matching against registered subjects if not linked
  useEffect(() => {
    if (registeredSubjects.length > 0 && !matchedSubjectId) {
      const codeClean = (subjectCode || '').trim().toUpperCase().replace(/[\s-]/g, '');
      const nameClean = (subjectName || '').trim().toLowerCase();

      const found = registeredSubjects.find((s) => {
        const sCode = (s.code || '').trim().toUpperCase().replace(/[\s-]/g, '');
        const sName = (s.name || '').trim().toLowerCase();
        if (codeClean && sCode === codeClean) return true;
        if (nameClean && (sName === nameClean || sName.includes(nameClean))) return true;
        return false;
      });

      if (found) {
        setMatchedSubjectId(found.id);
        if (!subjectCode) setSubjectCode(found.code);
        if (!subjectName) setSubjectName(found.name);
      }
    }
  }, [registeredSubjects, subjectCode, subjectName, matchedSubjectId]);

  // Attempt auto-matching against registered faculty if not linked
  useEffect(() => {
    if (registeredFaculty.length > 0 && !matchedFacultyId && facultyName) {
      const targetClean = facultyName
        .toLowerCase()
        .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '')
        .trim();

      const found = registeredFaculty.find((f) => {
        const full = `${f.firstName} ${f.lastName || ''}`.toLowerCase().trim();
        if (full === targetClean || full.includes(targetClean) || targetClean.includes(full)) {
          return true;
        }
        return false;
      });

      if (found) {
        setMatchedFacultyId(found.id);
        setFacultyName(`${found.firstName} ${found.lastName || ''}`.trim());
      }
    }
  }, [registeredFaculty, facultyName, matchedFacultyId]);

  const handleSelectSubject = (sub: any) => {
    setMatchedSubjectId(sub.id);
    setSubjectCode(sub.code);
    setSubjectName(sub.name);
  };

  const handleSelectFaculty = (fac: any) => {
    setMatchedFacultyId(fac.id);
    setFacultyName(`${fac.firstName} ${fac.lastName || ''}`.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const cleanSection = sectionCode.trim().toUpperCase() || 'C';
      const cleanSubBatch = subBatch.trim();
      const finalBatchTag = cleanSubBatch ? cleanSubBatch : `Combined ${cleanSection}`;

      await onSave({
        dayOfWeek,
        lectureNumber,
        subjectName,
        subjectCode,
        facultyName,
        roomNumber,
        startTime,
        endTime,
        isLab,
        batchSection: finalBatchTag,
        matchedSubjectId,
        matchedFacultyId,
        applyToSimilar,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save lecture', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isTeacherUnassigned = !facultyName.trim() || facultyName.toLowerCase().includes('unassigned') || !matchedFacultyId;
  const isSubjectUnassigned = !subjectName.trim() || subjectName.toLowerCase().includes('unassigned') || !matchedSubjectId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {lecture ? 'Edit Lecture Session' : 'Add New Lecture Session'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure lecture subject, faculty assignment, room, section, and lab groups.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Day & Lecture Slot */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Day of Week</Label>
              <Select value={dayOfWeek} onValueChange={(val) => setDayOfWeek(val as DayOfWeek)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day} className="text-xs">
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Lecture Slot (L#)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={lectureNumber}
                onChange={(e) => setLectureNumber(parseInt(e.target.value, 10) || 1)}
                className="h-9 text-xs"
                required
              />
            </div>
          </div>

          {/* Subject Assignment Section with Auto-Match */}
          <div className="border border-border/80 rounded-lg p-3 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary" /> Subject Assignment
              </Label>
              {matchedSubjectId ? (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Matched to Database
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Unmatched
                </span>
              )}
            </div>

            {/* Quick Pick Registered Subject */}
            {registeredSubjects.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Search className="w-3 h-3" /> Quick-Select Registered Subject:
                </div>
                <Select
                  value={matchedSubjectId || ''}
                  onValueChange={(val) => {
                    const sub = registeredSubjects.find((s) => s.id === val);
                    if (sub) handleSelectSubject(sub);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Choose a registered subject to link..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {registeredSubjects.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id} className="text-xs">
                        <span className="font-mono font-semibold text-primary mr-1.5">[{sub.code}]</span>
                        <span>{sub.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1 col-span-1">
                <Label className="text-[11px] text-muted-foreground font-medium">Subject Code</Label>
                <Input
                  placeholder="e.g. BAI 701"
                  value={subjectCode}
                  onChange={(e) => {
                    setSubjectCode(e.target.value);
                    setMatchedSubjectId(null);
                  }}
                  className="h-8 text-xs uppercase font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-[11px] text-muted-foreground font-medium">Subject Name</Label>
                <Input
                  placeholder="e.g. Deep Learning"
                  value={subjectName}
                  onChange={(e) => {
                    setSubjectName(e.target.value);
                    setMatchedSubjectId(null);
                  }}
                  className="h-8 text-xs"
                  required
                />
              </div>
            </div>

            {isSubjectUnassigned && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-700 dark:text-rose-400 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Alert:</strong> No registered subject matched. Select a subject from the list above, or a new subject will be auto-created on approval.
                </span>
              </div>
            )}
          </div>

          {/* Teacher Assignment Section with Auto-Match */}
          <div className="border border-border/80 rounded-lg p-3 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-primary" /> Teacher Assignment
              </Label>
              {matchedFacultyId ? (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Teacher Assigned
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Teacher Unassigned
                </span>
              )}
            </div>

            {/* Quick Pick Registered Faculty */}
            {registeredFaculty.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Search className="w-3 h-3" /> Quick-Select Registered Teacher:
                </div>
                <Select
                  value={matchedFacultyId || ''}
                  onValueChange={(val) => {
                    const fac = registeredFaculty.find((f) => f.id === val);
                    if (fac) handleSelectFaculty(fac);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Choose a teacher to assign attendance..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {registeredFaculty.map((fac) => (
                      <SelectItem key={fac.id} value={fac.id} className="text-xs">
                        <span className="font-semibold text-foreground">
                          {fac.firstName} {fac.lastName || ''}
                        </span>
                        {fac.employeeCode && (
                          <span className="text-muted-foreground font-mono text-[10px] ml-1.5">
                            ({fac.employeeCode})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">Faculty Name</Label>
                <Input
                  placeholder="e.g. Mr. Ranjeet Singh"
                  value={facultyName}
                  onChange={(e) => {
                    setFacultyName(e.target.value);
                    setMatchedFacultyId(null);
                  }}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">Room / Lab Code</Label>
                <Input
                  placeholder="e.g. L-306"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="h-8 text-xs uppercase"
                  required
                />
              </div>
            </div>

            {isTeacherUnassigned && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Teacher Alert:</strong> No teacher selected or matched. Please select a registered teacher from the dropdown so they can manage attendance.
                </span>
              </div>
            )}
          </div>

          {/* Timings */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start Time</Label>
              <Input
                placeholder="09:10 AM"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-9 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">End Time</Label>
              <Input
                placeholder="10:05 AM"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-9 text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Section & Sub-Batch Section Mapping */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Section</Label>
              <Input
                placeholder="e.g. A, B, C, D"
                value={sectionCode}
                onChange={(e) => setSectionCode(e.target.value)}
                className="h-9 text-xs font-semibold uppercase"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sub-Batch (Lab Group)</Label>
              <Input
                placeholder="e.g. C1, C2 (Leave blank for Combined)"
                value={subBatch}
                onChange={(e) => setSubBatch(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isLab"
                checked={isLab}
                onChange={(e) => setIsLab(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="isLab" className="text-xs font-medium cursor-pointer">
                Practical / Lab Session
              </Label>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-md border border-border/60">
            <strong>Attendance Mapping:</strong> Attendance for this lecture will map to{' '}
            <span className="font-semibold text-foreground underline">
              {subBatch.trim() ? subBatch.trim() : `Combined Section ${sectionCode.trim().toUpperCase() || 'C'}`}
            </span>
            .
          </p>

          {/* Apply to all similar lectures across timetable */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="applyToSimilar"
              checked={applyToSimilar}
              onChange={(e) => setApplyToSimilar(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
            <div className="space-y-0.5">
              <Label htmlFor="applyToSimilar" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-primary shrink-0" />
                Apply changes to all matching "{subjectName || subjectCode || 'similar'}" lectures
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Automatically syncs teacher, subject, and room mappings to all matching sessions across the entire weekly timetable.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : lecture ? 'Save Changes' : 'Add Lecture'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
