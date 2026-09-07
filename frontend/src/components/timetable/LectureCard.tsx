import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, User, Pencil, Trash2, FlaskConical, Tag, AlertTriangle, UserCheck } from 'lucide-react';

export interface LectureData {
  id: string;
  lectureNumber: number;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  roomNumber: string;
  startTime: string;
  endTime: string;
  isLab?: boolean;
  batchSection?: string;
  category?: string;
  dayOfWeek?: string;
  matchedFacultyId?: string | null;
  matchedSubjectId?: string | null;
  applyToSimilar?: boolean;
}

interface LectureCardProps {
  lecture: LectureData;
  index: number;
  onEdit?: (lecture: LectureData) => void;
  onDelete?: (lecture: LectureData) => void;
  onTestAttendance?: (lecture: LectureData) => void;
  readOnly?: boolean;
}

export const LectureCard: React.FC<LectureCardProps> = ({
  lecture,
  index,
  onEdit,
  onDelete,
  onTestAttendance,
  readOnly = false,
}) => {
  const isTeacherMissing = !lecture.facultyName || 
    lecture.facultyName.trim() === '' || 
    lecture.facultyName.toLowerCase().includes('unassigned') ||
    lecture.matchedFacultyId === null;

  const isSubjectMissing = !lecture.subjectName || 
    lecture.subjectName.trim() === '' || 
    lecture.subjectName.toLowerCase().includes('unassigned') ||
    lecture.matchedSubjectId === null;

  const getCategoryBorder = (cat?: string) => {
    if (isTeacherMissing || isSubjectMissing) {
      return 'border-l-4 border-l-amber-500 bg-amber-500/5';
    }
    switch (cat?.toLowerCase()) {
      case 'skill_development':
        return 'border-l-4 border-l-emerald-500';
      case 'placement':
        return 'border-l-4 border-l-rose-500';
      case 'self_learning':
        return 'border-l-4 border-l-sky-500';
      default:
        return 'border-l-4 border-l-primary/70';
    }
  };

  return (
    <Card className={`bg-card border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/40 ${getCategoryBorder(lecture.category)}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header row: L1 badge, Subject code, Action buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="font-bold text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
              L{lecture.lectureNumber || index + 1}
            </Badge>

            {lecture.subjectCode && (
              <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5 border-border bg-muted/40">
                {lecture.subjectCode}
              </Badge>
            )}

            {isTeacherMissing && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px] font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" /> No Teacher
              </Badge>
            )}

            {isSubjectMissing && (
              <Badge variant="outline" className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40 text-[10px] font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" /> No Subject
              </Badge>
            )}

            {lecture.isLab && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[11px] font-medium flex items-center gap-1">
                <FlaskConical className="w-3 h-3" /> Lab
              </Badge>
            )}

            {lecture.batchSection && lecture.batchSection !== 'All' && (
              <Badge variant="secondary" className="text-[11px] font-medium flex items-center gap-1 bg-muted">
                <Tag className="w-3 h-3" /> {lecture.batchSection}
              </Badge>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1">
              {onTestAttendance && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-md"
                  onClick={() => onTestAttendance?.(lecture)}
                  title="Test Attendance Demo"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                onClick={() => onEdit?.(lecture)}
                title="Edit Lecture"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                onClick={() => onDelete?.(lecture)}
                title="Delete Lecture"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Subject Name */}
        <div>
          <h4 className={`text-base font-bold tracking-tight line-clamp-2 ${isSubjectMissing ? 'text-rose-600 dark:text-rose-400 flex items-center gap-1.5' : 'text-foreground'}`}>
            {isSubjectMissing && <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />}
            {lecture.subjectName || 'Select Subject (Unassigned)'}
          </h4>
        </div>

        <div className="border-t border-border/60 pt-2.5 mt-2 space-y-1.5 text-xs text-muted-foreground">
          {/* Time & Room Row */}
          <div className="flex items-center justify-between font-mono">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {lecture.startTime} - {lecture.endTime}
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              {lecture.roomNumber || 'LH-302'}
            </span>
          </div>

          {/* Faculty Row */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <User className={`w-3.5 h-3.5 shrink-0 ${isTeacherMissing ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <span className={`truncate font-medium ${isTeacherMissing ? 'text-amber-600 dark:text-amber-400 flex items-center gap-1' : 'text-foreground'}`}>
              {isTeacherMissing ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                  Select Teacher (Unassigned)
                </>
              ) : (
                lecture.facultyName
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
