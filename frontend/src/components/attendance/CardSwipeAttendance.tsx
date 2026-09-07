import React, { useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  ChevronLeft,
  ChevronRight,
  Lock,
  Send,
  RefreshCw,
  GraduationCap,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import api from '@/api/axios';

export interface StudentItem {
  id: string;
  firstName: string;
  lastName?: string;
  rollNumber: string;
  collegeId: string;
  photoKey?: string | null;
}

const StudentCardPhoto: React.FC<{ student: StudentItem }> = ({ student }) => {
  const [photoBlobUrl, setPhotoBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!student.photoKey) {
      setPhotoBlobUrl(null);
      return;
    }
    let active = true;
    let urlToRevoke: string | null = null;
    api
      .get(`/students/photo/stream?key=${encodeURIComponent(student.photoKey)}`, { responseType: 'blob' })
      .then((res) => {
        if (active) {
          const url = URL.createObjectURL(res.data);
          urlToRevoke = url;
          setPhotoBlobUrl(url);
        }
      })
      .catch(() => {
        if (active) setPhotoBlobUrl(null);
      });

    return () => {
      active = false;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [student.photoKey]);

  if (photoBlobUrl) {
    return (
      <img
        src={photoBlobUrl}
        alt={`${student.firstName} ${student.lastName || ''}`}
        className="w-full h-full object-cover pointer-events-none"
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-muted text-primary p-4 select-none">
      <span className="text-5xl font-extrabold font-mono tracking-wider">
        {student.firstName[0]}
        {student.lastName ? student.lastName[0] : ''}
      </span>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2 font-medium">
        <GraduationCap className="w-3.5 h-3.5" />
        <span>Student Profile</span>
      </div>
    </div>
  );
};

interface CardSwipeAttendanceProps {
  studentList: StudentItem[];
  attendanceMap: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>;
  onMarkStatus: (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => void;
  isLocked?: boolean;
  onSubmit: () => void;
  isSubmitting?: boolean;
  onReloadStudents?: () => void;
}

export const CardSwipeAttendance: React.FC<CardSwipeAttendanceProps> = ({
  studentList,
  attendanceMap,
  onMarkStatus,
  isLocked = false,
  onSubmit,
  isSubmitting = false,
  onReloadStudents,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Drag physics motion values with improved spring and rotation response
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-14, 14]);
  const presentOpacity = useTransform(x, [35, 95], [0, 1]);
  const absentOpacity = useTransform(x, [-35, -95], [0, 1]);
  const cardScale = useTransform(x, [-260, 0, 260], [0.97, 1, 0.97]);

  // Reactive underneath preview card transforms
  const nextScale = useTransform(x, [-250, 0, 250], [1, 0.94, 1]);
  const nextOpacity = useTransform(x, [-250, 0, 250], [0.95, 0.55, 0.95]);

  const total = studentList.length;

  // Keep currentIndex bounded between 0 and total (where total = summary stage)
  useEffect(() => {
    if (studentList.length > 0 && currentIndex > studentList.length) {
      setCurrentIndex(studentList.length);
    }
  }, [studentList.length, currentIndex]);

  const isAtSummary = currentIndex >= total;
  const currentStudent = !isAtSummary ? studentList[currentIndex] : null;

  const handleNext = useCallback(() => {
    if (currentIndex < studentList.length) {
      setCurrentIndex((prev) => prev + 1);
    }
    x.set(0);
  }, [currentIndex, studentList.length, x]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
    x.set(0);
  }, [currentIndex, x]);

  const handleMark = useCallback((status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED', triggerAnim = true) => {
    if (!currentStudent || isLocked) return;

    onMarkStatus(currentStudent.id, status);

    if (triggerAnim) {
      const exitTarget = status === 'PRESENT' ? 580 : status === 'ABSENT' ? -580 : 0;
      if (exitTarget !== 0) {
        animate(x, exitTarget, {
          type: 'spring',
          stiffness: 380,
          damping: 26,
          onComplete: () => {
            x.set(0);
            handleNext();
          },
        });
      } else {
        handleNext();
      }
    } else {
      handleNext();
    }
  }, [currentStudent, isLocked, onMarkStatus, x, handleNext]);

  // Keyboard shortcut listener for rapid grading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input or modal is focused
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (!isAtSummary) {
        if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'p') {
          e.preventDefault();
          handleMark('PRESENT');
        } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
          e.preventDefault();
          handleMark('ABSENT');
        } else if (e.key.toLowerCase() === 'l') {
          e.preventDefault();
          handleMark('LATE', false);
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          handleMark('EXCUSED', false);
        }
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMark, handlePrev, handleNext, isAtSummary]);

  // Handle Drag End physics with responsive threshold and smooth spring release
  const onDragEnd = (_: any, info: any) => {
    if (isLocked) {
      animate(x, 0, { type: 'spring', stiffness: 350, damping: 25 });
      return;
    }

    const threshold = 85;
    const velocityThreshold = 350;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      // Swiped Right -> PRESENT
      handleMark('PRESENT', true);
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      // Swiped Left -> ABSENT
      handleMark('ABSENT', true);
    } else {
      // Smooth snap back
      animate(x, 0, { type: 'spring', stiffness: 450, damping: 26 });
    }
  };

  if (!studentList || studentList.length === 0) {
    return (
      <Card className="p-8 text-center bg-muted/20 border-dashed space-y-3">
        <div className="text-sm font-medium text-muted-foreground">
          No students loaded for this session.
        </div>
        {onReloadStudents && (
          <Button size="sm" onClick={onReloadStudents} className="gap-2 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Load Enrolled Students
          </Button>
        )}
      </Card>
    );
  }

  // Tally stats
  const presentCount = Object.values(attendanceMap).filter((s) => s === 'PRESENT').length;
  const absentCount = Object.values(attendanceMap).filter((s) => s === 'ABSENT').length;
  const lateCount = Object.values(attendanceMap).filter((s) => s === 'LATE').length;
  const excusedCount = Object.values(attendanceMap).filter((s) => s === 'EXCUSED').length;
  const markedCount = Object.keys(attendanceMap).length;
  const progressPercent = Math.round((markedCount / total) * 100);

  const currentStatus = currentStudent ? attendanceMap[currentStudent.id] : undefined;

  return (
    <div className="space-y-4 max-w-xl mx-auto w-full">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-3 text-xs bg-card p-3 rounded-xl border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">
              {isAtSummary ? 'Attendance Summary' : `Student ${currentIndex + 1} of ${total}`}
            </span>
            <Badge
              variant={isAtSummary ? 'default' : 'outline'}
              className={`text-[10px] px-1.5 py-0 font-mono ${
                isAtSummary ? 'bg-emerald-600 text-white' : ''
              }`}
            >
              {isAtSummary ? 'Completed' : `${progressPercent}% Marked`}
            </Badge>
          </div>
          <div className="w-36 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isAtSummary ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, ((isAtSummary ? total : currentIndex + 1) / total) * 100)}%` }}
            />
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 px-2">
            {presentCount} P
          </Badge>
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 px-2">
            {absentCount} A
          </Badge>
          {lateCount > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 px-2">
              {lateCount} L
            </Badge>
          )}
          {excusedCount > 0 && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 px-2">
              {excusedCount} E
            </Badge>
          )}
        </div>
      </div>

      {/* Main Area: Swipe Card Stage OR Attendance Completed Summary */}
      {isAtSummary ? (
        /* Attendance Completed Summary Screen */
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className="bg-card border-2 border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5"
        >
          {/* Header celebration */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center border border-emerald-500/30 shadow-inner">
              <CheckCheck className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Attendance Completed
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                All {total} Students Marked!
              </h2>
              <p className="text-xs text-muted-foreground max-w-sm">
                You have reached the end of the student list. Review the attendance summary breakdown below before submitting.
              </p>
            </div>
          </div>

          {/* Metric Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block">Present</span>
              <span className="text-2xl font-black text-emerald-600">{presentCount}</span>
              <span className="text-[10px] text-muted-foreground block">{Math.round((presentCount / total) * 100)}%</span>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider block">Absent</span>
              <span className="text-2xl font-black text-rose-600">{absentCount}</span>
              <span className="text-[10px] text-muted-foreground block">{Math.round((absentCount / total) * 100)}%</span>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider block">Late</span>
              <span className="text-2xl font-black text-amber-600">{lateCount}</span>
              <span className="text-[10px] text-muted-foreground block">{Math.round((lateCount / total) * 100)}%</span>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block">Excused</span>
              <span className="text-2xl font-black text-blue-600">{excusedCount}</span>
              <span className="text-[10px] text-muted-foreground block">{Math.round((excusedCount / total) * 100)}%</span>
            </div>
          </div>

          {/* Student Breakdown List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold uppercase tracking-wider px-1">
              <span>Student Roster ({total})</span>
              <span>Marked Status (Click to adjust)</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/30 border border-border rounded-xl p-2 bg-muted/20">
              {studentList.map((st, idx) => {
                const stStatus = attendanceMap[st.id] || 'PRESENT';
                return (
                  <div key={st.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/40 rounded-lg transition-colors text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono text-[11px] w-4">{idx + 1}.</span>
                      <span className="font-semibold text-foreground">{st.firstName} {st.lastName || ''}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">({st.rollNumber})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={isLocked}
                          onClick={() => onMarkStatus(st.id, s)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            stStatus === s
                              ? s === 'PRESENT'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : s === 'ABSENT'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : s === 'LATE'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-blue-600 text-white shadow-xs'
                              : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {s[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentIndex(0)}
              className="w-full sm:w-auto text-xs font-semibold gap-1.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Review Student Cards
            </Button>

            {isLocked ? (
              <Badge variant="destructive" className="py-2 px-4 text-xs font-bold gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Attendance Locked & Submitted
              </Badge>
            ) : (
              <Button
                type="button"
                size="default"
                disabled={isSubmitting}
                onClick={onSubmit}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-md h-9 px-4"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Locking Attendance...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Submit & Lock Attendance
                  </>
                )}
              </Button>
            )}
          </div>
        </motion.div>
      ) : (
        /* Main Swipeable Card Area */
        <div className="relative flex justify-center items-center min-h-[460px] select-none py-2">
          {/* Background Stack Illusion (Next Card Behind with reactive scale/opacity) */}
          {currentIndex < studentList.length - 1 && (
            <motion.div
              style={{ scale: nextScale, opacity: nextOpacity }}
              className="absolute w-[92%] max-w-sm h-[430px] bg-muted/40 border border-border/60 rounded-2xl -bottom-2 transform pointer-events-none transition-transform"
            />
          )}

          {/* Active Card */}
          <motion.div
            key={currentStudent?.id || currentIndex}
            style={{ x, rotate, scale: cardScale }}
            drag={isLocked ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.65}
            onDragEnd={onDragEnd}
            initial={{ scale: 0.95, opacity: 0.8, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`w-full max-w-md bg-card border-2 ${
              currentStatus === 'PRESENT'
                ? 'border-emerald-500/40 shadow-emerald-500/5'
                : currentStatus === 'ABSENT'
                ? 'border-rose-500/40 shadow-rose-500/5'
                : currentStatus === 'LATE'
                ? 'border-amber-500/40 shadow-amber-500/5'
                : currentStatus === 'EXCUSED'
                ? 'border-blue-500/40 shadow-blue-500/5'
                : 'border-border'
            } rounded-2xl shadow-xl overflow-hidden cursor-grab active:cursor-grabbing transition-colors duration-200 relative`}
          >
            {/* Visual Stamp Overlays on Drag */}
            <motion.div
              style={{ opacity: presentOpacity }}
              className="absolute top-6 right-6 z-30 pointer-events-none border-4 border-emerald-500 text-emerald-500 font-extrabold uppercase text-xl px-4 py-1.5 rounded-xl rotate-12 shadow-lg bg-background/80 backdrop-blur-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-6 h-6" /> PRESENT
            </motion.div>

            <motion.div
              style={{ opacity: absentOpacity }}
              className="absolute top-6 left-6 z-30 pointer-events-none border-4 border-rose-500 text-rose-500 font-extrabold uppercase text-xl px-4 py-1.5 rounded-xl -rotate-12 shadow-lg bg-background/80 backdrop-blur-xs flex items-center gap-1.5"
            >
              <XCircle className="w-6 h-6" /> ABSENT
            </motion.div>

            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              {/* Student Photo Container */}
              <div className="relative group">
                <div className="w-52 h-52 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-secondary/50 border-2 border-border shadow-inner flex items-center justify-center relative">
                  {currentStudent && <StudentCardPhoto student={currentStudent} />}
                </div>

                {/* Status Floating Pill Badge */}
                <div className="absolute -bottom-3 inset-x-0 flex justify-center">
                  <Badge
                    className={`text-xs px-3 py-0.5 shadow-md font-bold uppercase tracking-wider ${
                      currentStatus === 'PRESENT'
                        ? 'bg-emerald-600 text-white'
                        : currentStatus === 'ABSENT'
                        ? 'bg-rose-600 text-white'
                        : currentStatus === 'LATE'
                        ? 'bg-amber-600 text-white'
                        : currentStatus === 'EXCUSED'
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {currentStatus ? `Marked: ${currentStatus}` : 'Not Yet Marked'}
                  </Badge>
                </div>
              </div>

              {/* Student Details */}
              <div className="space-y-1 pt-2 w-full">
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono text-xs font-semibold">
                  Roll: {currentStudent?.rollNumber}
                </div>
                <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                  {currentStudent?.firstName} {currentStudent?.lastName || ''}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  College ID: {currentStudent?.collegeId}
                </p>
              </div>

              {/* Large Primary Action Buttons: Absent & Present */}
              <div className="grid grid-cols-2 gap-3 w-full pt-2">
                <Button
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleMark('ABSENT')}
                  variant="outline"
                  className="h-14 border-2 border-rose-500/40 hover:bg-rose-500/10 text-rose-600 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-sm font-bold text-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <XCircle className="w-5 h-5" />
                    <span>Absent</span>
                  </div>
                  <span className="text-[10px] font-normal opacity-80">Swipe Left (←)</span>
                </Button>

                <Button
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleMark('PRESENT')}
                  className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-sm font-bold text-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Present</span>
                  </div>
                  <span className="text-[10px] font-normal opacity-90">Swipe Right (→)</span>
                </Button>
              </div>

              {/* Secondary Parity Actions: Late & Excused */}
              <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                <span className="text-[11px] text-muted-foreground font-medium">Other Statuses:</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLocked}
                    onClick={() => handleMark('LATE')}
                    className={`h-7 px-2.5 text-xs font-medium border-amber-500/40 transition-colors ${
                      currentStatus === 'LATE' ? 'bg-amber-500 text-white' : 'text-amber-600 hover:bg-amber-500/10'
                    }`}
                    title="Mark Late (L)"
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Late (L)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLocked}
                    onClick={() => handleMark('EXCUSED')}
                    className={`h-7 px-2.5 text-xs font-medium border-blue-500/40 transition-colors ${
                      currentStatus === 'EXCUSED' ? 'bg-blue-500 text-white' : 'text-blue-600 hover:bg-blue-500/10'
                    }`}
                    title="Mark Excused (E)"
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    Excused (E)
                  </Button>
                </div>
              </div>
            </CardContent>
          </motion.div>
        </div>
      )}

      {/* Navigation Footer Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        {/* Prev / Next Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="text-xs h-8 px-3"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Previous
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={isAtSummary}
            className="text-xs h-8 px-3"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {/* Student Quick-Jump Dots & Summary Pill */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full py-1">
          {studentList.map((st, idx) => {
            const stStatus = attendanceMap[st.id];
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                  isCurrent ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'opacity-80 hover:opacity-100'
                } ${
                  stStatus === 'PRESENT'
                    ? 'bg-emerald-500 text-white'
                    : stStatus === 'ABSENT'
                    ? 'bg-rose-500 text-white'
                    : stStatus === 'LATE'
                    ? 'bg-amber-500 text-white'
                    : stStatus === 'EXCUSED'
                    ? 'bg-blue-500 text-white'
                    : 'bg-muted border border-border text-muted-foreground'
                }`}
                title={`${st.firstName}: ${stStatus || 'Unmarked'}`}
              >
                {idx + 1}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setCurrentIndex(total)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
              isAtSummary
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-500 ring-offset-1'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title="View Attendance Summary"
          >
            <CheckCheck className="w-3 h-3" />
            <span>Summary</span>
          </button>
        </div>

        {/* Final Submit & Lock Button in Footer */}
        <div className="w-full sm:w-auto flex justify-end">
          {isLocked ? (
            <Badge variant="destructive" className="py-1 px-3 text-xs flex items-center gap-1">
              <Lock className="w-3 h-3" /> Session Locked
            </Badge>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onSubmit}
              disabled={isSubmitting || markedCount === 0}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit & Lock ({markedCount}/{total})
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
