import api from '@/api/axios';
import { campusDay, readPacks, writePack, recordSignature, prunePacks } from './attendance-store';
import type { AttendancePack, AttendanceStatus } from './attendance-store';
import { reconcileAttendance } from './attendance-protocol';

const currentOwner = () => {
  try { return JSON.parse(localStorage.getItem('inca_user') || 'null')?.id; } catch { return null; }
};
function assertOwner(owner: string) {
  if (currentOwner() !== owner || !localStorage.getItem('inca_token')) throw new Error('Sign in to the same account to sync attendance.');
}
const options = { timeout: 20_000 };
async function prepareAttendanceUnlocked(owner: string, schedule: any): Promise<AttendancePack> {
  assertOwner(owner);
  const day = campusDay();
  const key = `${owner}:${day}:${schedule.id}`;
  const previous = (await readPacks(owner)).find(p => p.key === key);
  if (previous && ['pending', 'conflict', 'draft'].includes(previous.state)) return previous;
  const session = (await api.post('/attendance/sessions', { scheduleId: schedule.id, attendanceDate: day }, options)).data.data;
  const students = (await api.get(`/attendance/sessions/${session.id}/roster`, options)).data.data;
  if (!Array.isArray(students)) throw new Error('Invalid roster response.');
  assertOwner(owner);
  const saved = new Map((session.records || []).map((r: any) => [r.studentId, r.status]));
  const marks = Object.fromEntries(students.map((s: any) => [s.id, saved.get(s.id) || 'PRESENT'])) as Record<string, AttendanceStatus>;
  return writePack({ key, owner, day, schedule, session, students, marks, baseline: recordSignature(session.records || []), revision: '',
    state: session.status === 'SUBMITTED' ? 'synced' : 'ready', savedAt: '' }, previous?.revision);
}

const preparing = new Map<string, Promise<AttendancePack>>();
export function prepareAttendance(owner: string, schedule: any): Promise<AttendancePack> {
  const key = `${owner}:${campusDay()}:${schedule.id}`;
  if (preparing.has(key)) return preparing.get(key)!;
  const run = () => prepareAttendanceUnlocked(owner, schedule);
  const pending = (navigator.locks ? navigator.locks.request(`inca-prepare:${key}`, run) : run()).finally(() => preparing.delete(key));
  preparing.set(key, pending);
  return pending;
}

let preparation: Promise<void> | undefined;
export function prepareToday(owner: string) {
  if (preparation) return preparation;
  preparation = (async () => {
    assertOwner(owner);
    const schedules = (await api.get('/schedules/today', options)).data.data;
    if (!Array.isArray(schedules)) throw new Error('Invalid schedule response.');
    // Sequential requests avoid flooding a waking demo server.
    let failed = 0;
    for (const schedule of schedules) {
      assertOwner(owner);
      try { await prepareAttendance(owner, schedule); }
      catch { assertOwner(owner); failed++; }
    }
    await prunePacks(owner);
    if (failed) throw new Error(`${failed} class(es) could not be prepared. Existing prepared classes remain available. Reconnect and retry.`);
  })().finally(() => { preparation = undefined; });
  return preparation;
}

export async function syncOne(pack: AttendancePack) {
  const checked = async <T>(operation: () => Promise<T>) => { assertOwner(pack.owner); const result = await operation(); assertOwner(pack.owner); return result; };
  const confirmed = await reconcileAttendance(pack, {
    session: () => checked(async () => (await api.get(`/attendance/sessions/${pack.session.id}`, options)).data.data),
    roster: () => checked(async () => (await api.get(`/attendance/sessions/${pack.session.id}/roster`, options)).data.data),
    save: records => checked(async () => { await api.post(`/attendance/sessions/${pack.session.id}/records`, { records }, options); }),
    submit: () => checked(async () => { await api.patch(`/attendance/sessions/${pack.session.id}/submit`, {}, options); }),
    atomic: (records, baseline) => checked(async () => { await api.post(`/attendance/sessions/${pack.session.id}/sync`, { records, baseline }, options); }),
  });
  return writePack({ ...pack, session: confirmed, state: 'synced', error: undefined }, pack.revision);
}
let syncing: Promise<void> | undefined;
export function syncPending(owner: string) {
  if (syncing) return syncing;
  const run = async () => {
    for (const pack of await readPacks(owner)) {
      if (pack.state !== 'pending') continue;
      assertOwner(owner);
      try { await syncOne(pack); }
      catch (error: any) {
        // Auth/network failures retain the queue. Business conflicts need review.
        const unavailableSync = error.response?.status === 404 && error.config?.url?.endsWith('/sync');
        const retryable = (!error.response && error.isAxiosError) || [401, 408, 429].includes(error.response?.status) || error.response?.status >= 500 || unavailableSync;
        if (currentOwner() !== owner) return;
        await writePack({ ...pack, state: retryable ? 'pending' : 'conflict', error: unavailableSync ? 'Server sync is not available yet. Attendance remains saved on this device; retry later.' : error.response?.data?.message || error.message || 'Sync failed. Retry when connected.' }, pack.revision).catch(() => {});
        if (retryable) break;
      }
    }
  };
  syncing = (navigator.locks ? navigator.locks.request(`inca-attendance-sync:${owner}`, run) : run()).finally(() => { syncing = undefined; });
  return syncing;
}
