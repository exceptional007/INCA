import { recordSignature } from './attendance-store.ts';
import type { AttendancePack } from './attendance-store.ts';

export interface AttendanceCloud {
  session: () => Promise<any>;
  roster: () => Promise<any[]>;
  save: (records: { studentId: string; status: string }[]) => Promise<void>;
  submit: () => Promise<void>;
  atomic?: (records: { studentId: string; status: string }[], baseline: string) => Promise<void>;
}

// Keep retries and cloud confirmation independent of UI and storage.
export async function reconcileAttendance(pack: AttendancePack, cloud: AttendanceCloud) {
  const current = await cloud.session();
  const desired = pack.students.map(s => ({ studentId: s.id, status: pack.marks[s.id] }));
  if (!desired.length || desired.some(r => !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(r.status))) throw new Error('Attendance is incomplete. Review the local copy.');
  const desiredSignature = recordSignature(desired);
  if (current.status === 'SUBMITTED') {
    if (recordSignature(current.records || []) !== desiredSignature) throw new Error('This class was submitted with different attendance. Your local copy is retained for review.');
  } else {
    const roster = await cloud.roster();
    if (!Array.isArray(roster) || JSON.stringify(roster.map(s => s.id).sort()) !== JSON.stringify(pack.students.map(s => s.id).sort()))
      throw new Error('The enrolled student list changed. Your local attendance is retained; review this class while online.');
    const cloudSignature = recordSignature(current.records || []);
    if (cloudSignature !== pack.baseline && cloudSignature !== desiredSignature)
      throw new Error('Attendance changed on another device. Your local copy is retained for review.');
    if (cloud.atomic) await cloud.atomic(desired, pack.baseline);
    else {
      if (cloudSignature !== desiredSignature) await cloud.save(desired);
      await cloud.submit();
    }
  }
  const confirmed = await cloud.session();
  if (confirmed.status !== 'SUBMITTED' || recordSignature(confirmed.records || []) !== desiredSignature)
    throw new Error('Cloud confirmation is incomplete. Your local attendance is retained.');
  return confirmed;
}
