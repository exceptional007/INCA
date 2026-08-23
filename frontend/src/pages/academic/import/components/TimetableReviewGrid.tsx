import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Check, AlertTriangle, User, Home } from 'lucide-react';

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
}

interface TimetableReviewGridProps {
  batchId: string;
  slots: SlotDraft[];
  pages: Array<{ pageNumber: number; imageR2Key: string; rawText: string }>;
  onUpdateSlot: (slotId: string, data: Partial<SlotDraft>) => Promise<void>;
  onAddSlot: (data: Omit<SlotDraft, 'id'>) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
  onApprove: () => Promise<void>;
  isApproving: boolean;
  conflicts: any[];
}

const DAYS = ['MON', 'TUES', 'WED', 'THU', 'FRI', 'SAT'];

const COLUMNS = [
  { label: '9:10-10:05 AM', start: '9:10 AM', end: '10:05 AM' },
  { label: '10:05-11:00 AM', start: '10:05 AM', end: '11:00 AM' },
  { label: 'BREAK', isBreak: true },
  { label: '11:15-12:10 PM', start: '11:15 AM', end: '12:10 PM' },
  { label: '12:10-01:05 PM', start: '12:10 PM', end: '01:05 PM' },
  { label: 'LUNCH', isBreak: true },
  { label: '01:45-02:40 PM', start: '01:45 PM', end: '02:40 PM' },
  { label: '2:40-3:35 PM', start: '2:40 PM', end: '3:35 PM' },
  { label: '3:35-4:30 PM', start: '3:35 PM', end: '4:30 PM' },
];

export const TimetableReviewGrid: React.FC<TimetableReviewGridProps> = ({
  slots,
  pages,
  onUpdateSlot,
  onAddSlot,
  onDeleteSlot,
  conflicts,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<SlotDraft | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Form State
  const [formState, setFormState] = useState<Partial<SlotDraft>>({});

  const getColPlacement = (start: string, end: string) => {
    const s = start.toUpperCase().replace(/\s+/g, '');
    const e = end.toUpperCase().replace(/\s+/g, '');

    let startCol = 2;
    if (s.startsWith('9:10') || s.startsWith('09:10')) startCol = 2;
    else if (s.startsWith('10:05')) startCol = 3;
    else if (s.startsWith('11:15')) startCol = 5;
    else if (s.startsWith('12:10')) startCol = 6;
    else if (s.startsWith('1:45') || s.startsWith('01:45')) startCol = 8;
    else if (s.startsWith('2:40') || s.startsWith('02:40')) startCol = 9;
    else if (s.startsWith('3:35') || s.startsWith('03:35')) startCol = 10;

    let endCol = startCol + 1;
    if (e.startsWith('10:05')) endCol = 3;
    else if (e.startsWith('11:00')) endCol = 4;
    else if (e.startsWith('12:10')) endCol = 6;
    else if (e.startsWith('1:05') || e.startsWith('01:05')) endCol = 7;
    else if (e.startsWith('2:40') || e.startsWith('02:40')) endCol = 9;
    else if (e.startsWith('3:35') || e.startsWith('03:35')) endCol = 10;
    else if (e.startsWith('4:30') || e.startsWith('04:30')) endCol = 11;

    return { startCol, endCol };
  };

  const getCategoryClass = (category: string) => {
    switch (category) {
      case 'academic':
        return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-900 dark:text-amber-100 hover:bg-amber-100';
      case 'skill_development':
        return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100';
      case 'placement':
        return 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-900 dark:text-rose-100 hover:bg-rose-100';
      case 'self_learning':
        return 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 text-sky-900 dark:text-sky-100 hover:bg-sky-100';
      default:
        return 'bg-secondary border-muted text-muted-foreground hover:bg-secondary/80';
    }
  };

  const handleOpenEdit = (slot: SlotDraft) => {
    setSelectedSlot(slot);
    setFormState({
      day: slot.day,
      timeSlotStart: slot.timeSlotStart,
      timeSlotEnd: slot.timeSlotEnd,
      isMergedSlot: slot.isMergedSlot,
      mergedTimeSlotEnd: slot.mergedTimeSlotEnd,
      sectionCodes: slot.sectionCodes,
      subjectRaw: slot.subjectRaw,
      facultyRaw: slot.facultyRaw,
      room: slot.room,
      category: slot.category,
      matchedSubjectId: slot.matchedSubjectId || undefined,
      matchedFacultyId: slot.matchedFacultyId || undefined,
      matchedRoomId: slot.matchedRoomId || undefined,
      matchedSectionId: slot.matchedSectionId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenAdd = (day: string, col: typeof COLUMNS[0]) => {
    setFormState({
      gridId: slots[0]?.gridId || 'MAIN',
      day,
      timeSlotStart: col.start || '9:10 AM',
      timeSlotEnd: col.end || '10:05 AM',
      isMergedSlot: false,
      mergedTimeSlotEnd: null,
      sectionCodes: [slots[0]?.sectionCodes[0] || 'C'],
      subjectRaw: '',
      facultyRaw: '',
      room: '',
      category: 'academic',
    });
    setIsAddDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (selectedSlot) {
      await onUpdateSlot(selectedSlot.id, formState);
      setIsEditDialogOpen(false);
    }
  };

  const handleSaveAdd = async () => {
    await onAddSlot(formState as Omit<SlotDraft, 'id'>);
    setIsAddDialogOpen(false);
  };

  // Base API url for images
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

  return (
    <div className="space-y-6">
      {/* Side-by-Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Reconstructed Grid */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="shadow-md">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Reconstructed Timetable Grid</CardTitle>
                <CardDescription>Verify extraction matches, edit slots, and resolve conflict badges.</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="flex items-center gap-1" onClick={() => handleOpenAdd('MON', COLUMNS[0])}>
                <Plus className="w-4 h-4" /> Add Slot
              </Button>
            </CardHeader>

            <CardContent className="p-4 overflow-x-auto">
              <div className="min-w-[800px] grid grid-cols-11 gap-1 bg-muted p-2 rounded-xl text-xs font-medium">
                {/* Header Labels */}
                <div className="p-2 text-center text-muted-foreground font-semibold bg-background rounded-lg border">Day</div>
                {COLUMNS.map((col, idx) => (
                  <div key={idx} className="p-2 text-center text-muted-foreground font-semibold bg-background rounded-lg border flex flex-col justify-center items-center">
                    <span>{col.label}</span>
                  </div>
                ))}

                {/* Day Rows */}
                {DAYS.map((day) => {
                  const daySlots = slots.filter((s) => s.day === day);
                  
                  return (
                    <React.Fragment key={day}>
                      <div className="p-2 bg-background border rounded-lg font-bold flex items-center justify-center uppercase">{day}</div>
                      
                      {/* Grid cells containing absolute aligned slots */}
                      <div className="col-span-10 grid grid-cols-10 gap-1 relative min-h-[80px]">
                        
                        {/* Static Break overlays */}
                        <div className="col-start-3 col-end-4 bg-muted/60 border border-dashed rounded-lg flex items-center justify-center font-bold text-[10px] text-muted-foreground uppercase writing-mode-vertical py-2">
                          Break
                        </div>
                        <div className="col-start-6 col-end-7 bg-muted/60 border border-dashed rounded-lg flex items-center justify-center font-bold text-[10px] text-muted-foreground uppercase writing-mode-vertical py-2">
                          Lunch
                        </div>

                        {daySlots.map((slot) => {
                          const { startCol, endCol } = getColPlacement(slot.timeSlotStart, slot.isMergedSlot && slot.mergedTimeSlotEnd ? slot.mergedTimeSlotEnd : slot.timeSlotEnd);
                          
                          // Adjust for day column (which starts at grid col 1)
                          const startPos = startCol - 1;
                          const endPos = endCol - 1;
                          
                          const hasWarning = !slot.matchedSubjectId || !slot.matchedFacultyId || !slot.matchedRoomId || slot.matchConfidence < 0.85;

                          return (
                            <button
                              key={slot.id}
                              onClick={() => handleOpenEdit(slot)}
                              style={{
                                gridColumnStart: startPos,
                                gridColumnEnd: endPos,
                              }}
                              className={`p-2 border rounded-lg flex flex-col justify-between text-left transition-all ${getCategoryClass(slot.category)} shadow-sm group min-h-[76px] cursor-pointer`}
                            >
                              <div className="space-y-1 w-full">
                                <div className="flex items-center justify-between gap-1 w-full">
                                  <span className="font-bold text-[10px] truncate">{slot.subjectRaw}</span>
                                  {hasWarning && (
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                                  <User className="w-3 h-3 shrink-0" /> <span className="truncate">{slot.facultyRaw}</span>
                                </div>
                                <div className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                                  <Home className="w-3 h-3 shrink-0" /> <span className="truncate">{slot.room}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between mt-1 pt-1 border-t border-black/5 w-full">
                                <Badge variant="outline" className="text-[8px] px-1 py-0 border-black/10">
                                  {slot.sectionCodes.join('+')}
                                </Badge>
                                {slot.matchConfidence >= 0.85 && (
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: PDF Preview */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-md h-full">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Original PDF Layout</CardTitle>
                <CardDescription>Visual comparison panel.</CardDescription>
              </div>
              {pages.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="w-8 h-8" disabled={currentPageIndex === 0} onClick={() => setCurrentPageIndex(p => p - 1)}>
                    &lt;
                  </Button>
                  <span className="text-xs font-bold px-2">{currentPageIndex + 1} / {pages.length}</span>
                  <Button size="icon" variant="outline" className="w-8 h-8" disabled={currentPageIndex === pages.length - 1} onClick={() => setCurrentPageIndex(p => p + 1)}>
                    &gt;
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4 flex items-center justify-center bg-muted/30 h-[500px]">
              {pages[currentPageIndex] ? (
                <div className="w-full h-full overflow-auto border rounded-lg bg-background flex justify-center p-2 shadow-inner">
                  <img
                    src={`${apiBaseUrl}/admin/timetable-imports/files/${pages[currentPageIndex].imageR2Key}`}
                    alt={`Timetable page ${currentPageIndex + 1}`}
                    className="max-w-none w-[150%] sm:w-full object-contain"
                  />
                </div>
              ) : (
                <div className="text-muted-foreground text-xs">No preview image available.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Conflicts & Commit Bar */}
      {conflicts.length > 0 && (
        <Card className="border-destructive bg-destructive/5 text-destructive-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Blocking Conflicts Detected ({conflicts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            {conflicts.map((c, idx) => (
              <p key={idx}>• {c.message}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dialog: Edit Slot */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Draft Slot Details</DialogTitle>
            <DialogDescription>Modify parameters for this parsed timetable slot.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-day">Day</Label>
                <Select value={formState.day} onValueChange={(val) => setFormState(p => ({ ...p, day: val }))}>
                  <SelectTrigger id="edit-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-category">Category</Label>
                <Select value={formState.category} onValueChange={(val) => setFormState(p => ({ ...p, category: val }))}>
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="skill_development">Skill Development</SelectItem>
                    <SelectItem value="placement">Placement</SelectItem>
                    <SelectItem value="self_learning">Self Learning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-start">Start Time</Label>
                <Input id="edit-start" value={formState.timeSlotStart} onChange={(e) => setFormState(p => ({ ...p, timeSlotStart: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-end">End Time</Label>
                <Input id="edit-end" value={formState.timeSlotEnd} onChange={(e) => setFormState(p => ({ ...p, timeSlotEnd: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-subject">Subject</Label>
              <Input id="edit-subject" value={formState.subjectRaw} onChange={(e) => setFormState(p => ({ ...p, subjectRaw: e.target.value }))} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-faculty">Faculty</Label>
              <Input id="edit-faculty" value={formState.facultyRaw} onChange={(e) => setFormState(p => ({ ...p, facultyRaw: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-room">Room</Label>
                <Input id="edit-room" value={formState.room} onChange={(e) => setFormState(p => ({ ...p, room: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-sections">Sections (joined by +)</Label>
                <Input id="edit-sections" value={formState.sectionCodes?.join('+')} onChange={(e) => setFormState(p => ({ ...p, sectionCodes: e.target.value.split('+') }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between w-full">
            <Button variant="destructive" size="icon" onClick={async () => {
              if (selectedSlot) {
                await onDeleteSlot(selectedSlot.id);
                setIsEditDialogOpen(false);
              }
            }}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Slot */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add Manual Timetable Slot</DialogTitle>
            <DialogDescription>Input parameters to create a new slot in the batch.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="add-day">Day</Label>
                <Select value={formState.day} onValueChange={(val) => setFormState(p => ({ ...p, day: val }))}>
                  <SelectTrigger id="add-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="add-category">Category</Label>
                <Select value={formState.category} onValueChange={(val) => setFormState(p => ({ ...p, category: val }))}>
                  <SelectTrigger id="add-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="skill_development">Skill Development</SelectItem>
                    <SelectItem value="placement">Placement</SelectItem>
                    <SelectItem value="self_learning">Self Learning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="add-start">Start Time</Label>
                <Input id="add-start" value={formState.timeSlotStart} onChange={(e) => setFormState(p => ({ ...p, timeSlotStart: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-end">End Time</Label>
                <Input id="add-end" value={formState.timeSlotEnd} onChange={(e) => setFormState(p => ({ ...p, timeSlotEnd: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-subject">Subject</Label>
              <Input id="add-subject" placeholder="e.g. DEEP LEARNING (DL)" value={formState.subjectRaw} onChange={(e) => setFormState(p => ({ ...p, subjectRaw: e.target.value }))} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-faculty">Faculty</Label>
              <Input id="add-faculty" placeholder="e.g. MR RANJEET SINGH" value={formState.facultyRaw} onChange={(e) => setFormState(p => ({ ...p, facultyRaw: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="add-room">Room</Label>
                <Input id="add-room" placeholder="e.g. L-311" value={formState.room} onChange={(e) => setFormState(p => ({ ...p, room: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-sections">Sections (joined by +)</Label>
                <Input id="add-sections" placeholder="e.g. C1+C2" value={formState.sectionCodes?.join('+')} onChange={(e) => setFormState(p => ({ ...p, sectionCodes: e.target.value.split('+') }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAdd}>Add Slot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
