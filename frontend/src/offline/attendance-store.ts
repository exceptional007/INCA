export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export interface AttendancePack {
  key: string; owner: string; day: string; schedule: any; session: any; students: any[];
  marks: Record<string, AttendanceStatus>; baseline: string; revision: string;
  state: 'ready' | 'draft' | 'pending' | 'synced' | 'conflict'; savedAt: string; error?: string;
}
export function campusDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function recordSignature(records: any[]) {
  return JSON.stringify(records.map(r => [r.studentId, r.status]).sort((a, b) => a[0].localeCompare(b[0])));
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('inca-attendance-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('packs', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Device storage unavailable. Attendance has not been saved locally.')); };
  });
  return database;
}
export async function readPacks(owner: string): Promise<AttendancePack[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('packs').objectStore('packs').getAll();
    request.onsuccess = () => resolve(request.result.filter((p: AttendancePack) => p.owner === owner));
    request.onerror = () => reject(request.error);
  });
}
export async function writePack(pack: AttendancePack, expectedRevision?: string): Promise<AttendancePack> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('packs', 'readwrite');
    const store = tx.objectStore('packs');
    let next: AttendancePack;
    const get = store.get(pack.key);
    get.onsuccess = () => {
      const previous = get.result as AttendancePack | undefined;
      if ((expectedRevision !== undefined && previous?.revision !== expectedRevision) || (expectedRevision === undefined && previous)) { tx.abort(); return; }
      next = { ...pack, revision: crypto.randomUUID(), savedAt: new Date().toISOString() };
      store.put(next);
    };
    tx.oncomplete = () => { window.dispatchEvent(new Event('inca-attendance-changed')); resolve(next); };
    tx.onabort = tx.onerror = () => reject(new Error('Could not save attendance. Storage is full or this class changed in another tab. Reopen the class and retry.'));
  });
}

// Old prepared/synced rosters expire; unsent attendance is retained until reconciled.
export async function prunePacks(owner: string) {
  const cutoff = Date.now() - 7 * 86400_000;
  const packs = await readPacks(owner);
  const database = await db();
  const tx = database.transaction('packs', 'readwrite');
  for (const pack of packs) if (['ready', 'synced'].includes(pack.state) && Date.parse(pack.savedAt) < cutoff) tx.objectStore('packs').delete(pack.key);
}
