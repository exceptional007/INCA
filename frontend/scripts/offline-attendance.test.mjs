import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileAttendance } from '../src/offline/attendance-protocol.ts';
import { campusDay, recordSignature } from '../src/offline/attendance-store.ts';

const pack = () => ({ students: [{ id: 'one' }, { id: 'two' }], marks: { one: 'PRESENT', two: 'ABSENT' }, baseline: recordSignature([]) });
function backend(overrides = {}) {
  const state = { id: 'session', status: 'OPEN', records: [], saves: 0, submits: 0 };
  return { state, cloud: {
    session: async () => structuredClone(state), roster: async () => [{ id: 'two' }, { id: 'one' }],
    save: async records => { state.saves++; state.records = records; },
    submit: async () => { state.submits++; state.status = 'SUBMITTED'; }, ...overrides,
  } };
}
test('uses campus day across UTC midnight boundaries', () => {
  assert.equal(campusDay(new Date('2026-11-01T20:00:00Z')), '2026-11-02');
  assert.equal(campusDay(new Date('2026-11-01T00:01:00Z')), '2026-11-01');
});
test('saves the full roster and confirms a submitted cloud session', async () => {
  const b = backend(); const confirmed = await reconcileAttendance(pack(), b.cloud);
  assert.equal(confirmed.status, 'SUBMITTED'); assert.equal(b.state.saves, 1); assert.equal(b.state.submits, 1);
  assert.equal(confirmed.records[1].status, 'ABSENT');
});
test('retry after lost submit response does not upload or submit twice', async () => {
  const b = backend(); await reconcileAttendance(pack(), b.cloud); await reconcileAttendance(pack(), b.cloud);
  assert.equal(b.state.saves, 1); assert.equal(b.state.submits, 1);
});
test('retry after records saved but connection interrupted skips duplicate save', async () => {
  const b = backend(); b.state.records = [{ studentId: 'one', status: 'PRESENT' }, { studentId: 'two', status: 'ABSENT' }];
  await reconcileAttendance(pack(), b.cloud); assert.equal(b.state.saves, 0); assert.equal(b.state.submits, 1);
});
test('different locked cloud attendance is never overwritten', async () => {
  const b = backend(); b.state.status = 'SUBMITTED'; b.state.records = [{ studentId: 'one', status: 'ABSENT' }];
  await assert.rejects(reconcileAttendance(pack(), b.cloud), /submitted with different/); assert.equal(b.state.saves, 0);
});
test('changed roster blocks upload and retains the local copy', async () => {
  const b = backend({ roster: async () => [{ id: 'one' }, { id: 'new-student' }] });
  await assert.rejects(reconcileAttendance(pack(), b.cloud), /student list changed/); assert.equal(b.state.saves, 0);
});
test('another device changing an open session blocks upload', async () => {
  const b = backend(); b.state.records = [{ studentId: 'one', status: 'EXCUSED' }];
  await assert.rejects(reconcileAttendance(pack(), b.cloud), /another device/); assert.equal(b.state.saves, 0);
});
test('connection failure is propagated without pretending to upload', async () => {
  const b = backend({ save: async () => { throw new Error('Network unavailable'); } });
  await assert.rejects(reconcileAttendance(pack(), b.cloud), /Network unavailable/); assert.equal(b.state.submits, 0);
});
test('missing marks block upload', async () => {
  const b = backend(); const p = pack(); delete p.marks.two;
  await assert.rejects(reconcileAttendance(p, b.cloud), /incomplete/); assert.equal(b.state.saves, 0);
});
test('a submit without server confirmation is never marked uploaded', async () => {
  const b = backend({ submit: async () => {} });
  await assert.rejects(reconcileAttendance(pack(), b.cloud), /confirmation is incomplete/);
});
test('uses one atomic server call when available and confirms the result', async () => {
  const b = backend(); let atomicCalls = 0;
  b.cloud.atomic = async (records, baseline) => { assert.equal(baseline, '[]'); atomicCalls++; b.state.records = records; b.state.status = 'SUBMITTED'; };
  await reconcileAttendance(pack(), b.cloud);
  assert.equal(atomicCalls, 1); assert.equal(b.state.saves, 0); assert.equal(b.state.submits, 0);
});
