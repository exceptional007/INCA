import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  History,
  Sparkles,
} from 'lucide-react';
import api from '../../api/axios';

export const MarkAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);

  const [studentList, setStudentList] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Audit Edit modal state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('PRESENT');
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    fetchTodaySchedules();
  }, []);

  const fetchTodaySchedules = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/schedules/today');
      const data = res.data.data || [];
      setSchedules(data);
      if (data.length > 0) {
        setSelectedSchedule(data[0]);
      }
    } catch (err) {
      console.error('Failed to load today schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Open session & fetch students for selected schedule
  const handleOpenSession = async (schedule: any) => {
    setSelectedSchedule(schedule);
    setIsLoading(true);
    setStatusMsg(null);

    try {
      // 1. Create or get session
      const sessionRes = await api.post('/attendance/sessions', {
        scheduleId: schedule.id,
        takenById: user?.faculty?.id || schedule.template?.facultyId || 'demo-faculty-id',
        attendanceDate: new Date().toISOString().split('T')[0],
      });

      const session = sessionRes.data.data;
      setActiveSession(session);

      // 2. Load students (fallback demo list if empty database)
      const demoStudents = [
        { id: 'stu-1', firstName: 'Rahul', lastName: 'Sharma', rollNumber: '2026-CSE-001' },
        { id: 'stu-2', firstName: 'Ananya', lastName: 'Verma', rollNumber: '2026-CSE-002' },
        { id: 'stu-3', firstName: 'Vikram', lastName: 'Singh', rollNumber: '2026-CSE-003' },
        { id: 'stu-4', firstName: 'Priya', lastName: 'Gupta', rollNumber: '2026-CSE-004' },
        { id: 'stu-5', firstName: 'Amit', lastName: 'Kumar', rollNumber: '2026-CSE-005' },
      ];

      setStudentList(demoStudents);

      // Initialize all to PRESENT by default for quick workflow
      const initialMap: Record<string, any> = {};
      demoStudents.forEach((st) => (initialMap[st.id] = 'PRESENT'));
      setAttendanceMap(initialMap);
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Session already exists — fetch existing session
        fetchExistingSession(schedule.id);
      } else {
        setStatusMsg(err.response?.data?.message || 'Error initializing session');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExistingSession = async (scheduleId: string) => {
    try {
      const res = await api.get('/attendance/sessions');
      const found = res.data.data?.find((s: any) => s.scheduleId === scheduleId);
      if (found) {
        setActiveSession(found);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const setStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const bulkMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    const updated: Record<string, any> = {};
    studentList.forEach((s) => (updated[s.id] = status));
    setAttendanceMap(updated);
  };

  const handleSubmitAttendance = async () => {
    if (!activeSession) return;
    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      // 1. Submit records
      await api.post(`/attendance/sessions/${activeSession.id}/records`, { records });

      // 2. Lock session
      await api.patch(`/attendance/sessions/${activeSession.id}/submit`);

      setStatusMsg('✅ Attendance submitted and locked successfully!');
      setActiveSession((prev: any) => ({ ...prev, status: 'SUBMITTED' }));
    } catch (err: any) {
      setStatusMsg(err.response?.data?.message || 'Failed to submit attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmittedRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !user) return;
    setIsSubmitting(true);

    try {
      await api.patch(`/attendance/records/${editingRecord.id}/edit`, {
        newStatus: editStatus,
        editedById: user.id,
        reason: editReason,
      });

      setStatusMsg(`✅ Record updated to ${editStatus} with audit entry!`);
      setAuditModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Edit window expired or unauthorized.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Smart Attendance Marking</h1>
        <p className="text-sm text-slate-400">Mobile-optimised automatic lecture detection & attendance marking</p>
      </div>

      {/* Today's Detected Lectures */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Today's Scheduled Lectures
        </h2>
        {isLoading && !activeSession ? (
          <LoadingSpinner />
        ) : schedules.length === 0 ? (
          <Card className="p-6 text-center text-slate-400 text-sm">
            No classes scheduled for today. You can also generate test schedules in Timetables page.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schedules.map((sch) => (
              <Card
                key={sch.id}
                hoverable
                className={`space-y-3 cursor-pointer ${
                  selectedSchedule?.id === sch.id ? 'border-indigo-500 bg-indigo-500/10' : ''
                }`}
                onClick={() => handleOpenSession(sch)}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="indigo">
                    {sch.template?.subject?.code || 'CLASS'}
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">
                    {sch.template?.startTime || '09:00'} - {sch.template?.endTime || '10:00'}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base">
                  {sch.template?.subject?.name || 'Lecture'}
                </h3>
                <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-2">
                  <span>Section {sch.template?.section?.name || 'A'} • Room {sch.template?.room?.code || '101'}</span>
                  <Button size="sm" variant="primary" icon={<Sparkles className="w-3.5 h-3.5" />}>
                    Open Session
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active Session & Student Attendance Card */}
      {selectedSchedule && (
        <Card className="p-6 space-y-6 border-indigo-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={activeSession?.status === 'SUBMITTED' ? 'danger' : 'success'}>
                  {activeSession?.status === 'SUBMITTED' ? 'Locked (Submitted)' : 'Open Session'}
                </Badge>
                <span className="text-xs text-slate-400">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {selectedSchedule.template?.subject?.name || 'Selected Lecture'}
              </h2>
            </div>

            {/* Quick Bulk Action Buttons */}
            {activeSession?.status !== 'SUBMITTED' && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="success" onClick={() => bulkMarkAll('PRESENT')}>
                  Mark All Present
                </Button>
                <Button size="sm" variant="danger" onClick={() => bulkMarkAll('ABSENT')}>
                  Mark All Absent
                </Button>
              </div>
            )}
          </div>

          {statusMsg && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              {statusMsg}
            </div>
          )}

          {/* Student List */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Student List ({studentList.length})
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              {studentList.map((student) => {
                const currentStatus = attendanceMap[student.id] || 'PRESENT';
                return (
                  <div
                    key={student.id}
                    className="p-3.5 rounded-xl glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-sm">
                        {student.firstName[0]}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-100 text-sm">
                          {student.firstName} {student.lastName}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono">
                          Roll: {student.rollNumber}
                        </p>
                      </div>
                    </div>

                    {/* Quick Status Buttons */}
                    {activeSession?.status !== 'SUBMITTED' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStudentStatus(student.id, 'PRESENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === 'PRESENT'
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Present
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentStatus(student.id, 'ABSENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === 'ABSENT'
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Absent
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentStatus(student.id, 'LATE')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === 'LATE'
                              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" /> Late
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            currentStatus === 'PRESENT'
                              ? 'success'
                              : currentStatus === 'ABSENT'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {currentStatus}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingRecord({ id: `rec-${student.id}`, student });
                            setAuditModalOpen(true);
                          }}
                          icon={<History className="w-3.5 h-3.5" />}
                        >
                          Edit (24h)
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Attendance Button */}
          {activeSession?.status !== 'SUBMITTED' && (
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <Button
                variant="primary"
                size="lg"
                onClick={handleSubmitAttendance}
                isLoading={isSubmitting}
                icon={<Send className="w-4 h-4" />}
              >
                Submit & Lock Attendance
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* 24-Hour Audit Edit Modal */}
      <Modal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        title="Edit Submitted Attendance (24-Hour Audit Window)"
      >
        <form onSubmit={handleEditSubmittedRecord} className="space-y-4">
          <p className="text-xs text-slate-400">
            Modifying attendance for{' '}
            <span className="text-indigo-300 font-semibold">
              {editingRecord?.student?.firstName} {editingRecord?.student?.lastName}
            </span>
            . All changes are immutably logged with your User ID and reason.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">New Status</label>
            <div className="grid grid-cols-4 gap-2">
              {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEditStatus(st)}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    editStatus === st
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Reason for Correction</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Student arrived late due to bus delay..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="w-full glass-input rounded-xl p-3 text-sm focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAuditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save & Log Audit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
