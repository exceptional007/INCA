import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { campusDay, readPacks, writePack } from './attendance-store';
import type { AttendancePack } from './attendance-store';
import { prepareToday, syncPending } from './attendance-sync';

const OfflineContext = createContext<{ packs: AttendancePack[]; busy: boolean; error: string; refresh: () => Promise<void>; prepare: () => Promise<void>; sync: () => Promise<void> }>({ packs: [], busy: false, error: '', refresh: async () => {}, prepare: async () => {}, sync: async () => {} });
export const useOfflineAttendance = () => useContext(OfflineContext);
export function AttendanceOfflineProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [owned, setOwned] = useState<{ owner: string; packs: AttendancePack[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owner = user?.id;
  const lastPrepared = useRef(0);
  const refresh = useCallback(async () => {
    if (!owner) return;
    try { setOwned({ owner, packs: await readPacks(owner) }); }
    catch (e: any) { setError(e.message); }
  }, [owner]);
  const sync = useCallback(async () => {
    if (!owner) return;
    setBusy(true); setError('');
    try { await syncPending(owner); }
    catch (e: any) { setError(e.message); }
    finally { await refresh(); setBusy(false); }
  }, [owner, refresh]);
  const prepare = useCallback(async () => {
    if (!owner) return;
    setBusy(true); setError('');
    try { await prepareToday(owner); lastPrepared.current = Date.now(); }
    catch (e: any) { setError(e.response?.data?.message || (e.isAxiosError ? 'Could not refresh all classes. Existing prepared classes remain available; reconnect and retry.' : e.message)); }
    finally { await refresh(); setBusy(false); }
  }, [owner, refresh]);
  useEffect(() => {
    if (!owner || isLoading) return;
    let alive = true;
    const onChanged = () => { if (alive) void refresh(); };
    const resume = async () => {
      if (!navigator.onLine || document.visibilityState === 'hidden') return;
      await sync();
      if (user.role.code === 'FACULTY' && !user.mustChangePassword && Date.now() - lastPrepared.current > 5 * 60_000) await prepare();
    };
    void refresh();
    // Prepare today's server-authorized rosters on faculty login, including from the hub.
    if (navigator.onLine && user.role.code === 'FACULTY' && !user.mustChangePassword) void sync().then(async () => { if (alive) await prepare(); });
    const timer = window.setInterval(() => { void resume(); }, 60_000);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('inca-attendance-changed', onChanged);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); window.removeEventListener('inca-attendance-changed', onChanged); };
  }, [owner, isLoading, user?.role.code, user?.mustChangePassword, refresh, prepare, sync]);
  return <OfflineContext.Provider value={{ packs: owned && owned.owner === owner ? owned.packs : [], busy, error, refresh, prepare, sync }}>{children}</OfflineContext.Provider>;
}

export function OfflineAttendanceStatus() {
  const { packs, busy, error, sync, prepare } = useOfflineAttendance();
  const [online, setOnline] = useState(navigator.onLine);
  const [shellReady, setShellReady] = useState(false);
  useEffect(() => {
    let alive = true;
    if ('serviceWorker' in navigator) void navigator.serviceWorker.ready.then(() => { if (alive) setShellReady(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const pending = packs.filter(p => p.state === 'pending').length;
  const conflicts = packs.filter(p => p.state === 'conflict').length;
  const today = packs.filter(p => p.day === campusDay());
  const exportCopy = (pack: AttendancePack) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ date: pack.day, class: pack.schedule, students: pack.students.map(s => ({ ...s, status: pack.marks[s.id] })), syncState: pack.state, error: pack.error }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `inca-attendance-${pack.day}-${pack.schedule.id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section aria-label="Offline attendance status" className="rounded-xl border bg-card p-4 space-y-2 text-sm">
    <div className="flex flex-wrap gap-2 items-center justify-between">
      <strong>{online ? 'Attendance on this device' : 'Offline attendance'}</strong>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!online || busy} onClick={() => void prepare()} className="rounded-lg border px-3 py-2 disabled:opacity-50">Prepare today’s classes</button>
        <button type="button" disabled={!online || busy || !pending} onClick={() => void sync()} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 disabled:opacity-50">{busy ? 'Working…' : 'Sync now'}</button>
      </div>
    </div>
    <p role="status">{today.length} class(es) prepared for today. {pending ? `${pending} class(es) saved on this device, waiting for cloud upload.` : 'No attendance waiting for upload.'} {conflicts > 0 && `${conflicts} class(es) need review.`}</p>
    <p className="text-xs text-muted-foreground">Prepare while connected before entering a low-connectivity area. Submitted attendance syncs automatically when this app is open and connected. Keep unsynced data on this device and sign in to the same account.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">{shellReady ? 'App files ready for offline use.' : 'Keep connected until app files are ready for offline use.'}</p>
    {packs.filter(p => p.state === 'pending' || p.state === 'conflict').map(pack => <details key={pack.key} className="rounded-lg border p-3">
      <summary className="cursor-pointer break-words font-medium">{pack.day} · {pack.schedule.template?.subject?.name || 'Lecture'} · {pack.state === 'conflict' ? 'Needs review' : 'Waiting for upload'}</summary>
      {pack.error && <p role="alert" className="my-2 text-destructive">{pack.error}</p>}
      {pack.error?.includes('grace period') && <p className="my-2 text-sm"><a className="text-primary underline" href={`/attendance/late-approvals?scheduleId=${encodeURIComponent(pack.schedule.id)}`}>Request late attendance approval</a>. After approval, return and choose Recheck cloud. Your local marks are retained.</p>}
      <ul className="my-3 max-h-48 overflow-y-auto text-xs space-y-2">{pack.students.map(student => <li key={student.id} className="break-words">{student.rollNumber} · {student.firstName} {student.lastName} · {pack.marks[student.id]}</li>)}</ul>
      <div className="flex flex-wrap gap-2"><button type="button" className="rounded border px-3 py-2" onClick={() => exportCopy(pack)}>Download local copy</button>
        {pack.state === 'conflict' && <button type="button" disabled={!online || busy} className="rounded border px-3 py-2 disabled:opacity-50" onClick={() => void writePack({ ...pack, state: 'pending', error: undefined }, pack.revision).then(() => sync()).catch(e => alert(e.message))}>Recheck cloud</button>}
      </div>
    </details>)}
  </section>;
}
