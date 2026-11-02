import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ArrowLeft, ArrowRight, Pointer, Pause, RotateCcw, WifiOff } from 'lucide-react';
import { CardSwipeAttendance } from '@/components/attendance/CardSwipeAttendance';
import type { AttendanceStatus } from '@/offline/attendance-store';

const students = [
  { id: 'public-one', firstName: 'Aarav', lastName: 'Sharma', rollNumber: 'SAMPLE-001', collegeId: 'Sample student' },
  { id: 'public-two', firstName: 'Diya', lastName: 'Patel', rollNumber: 'SAMPLE-002', collegeId: 'Sample student' },
  { id: 'public-three', firstName: 'Rohan', lastName: 'Verma', rollNumber: 'SAMPLE-003', collegeId: 'Sample student' },
];
export function SwipeExperience() {
  const stage = useRef<HTMLDivElement>(null);
  const finger = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);
  const [step, setStep] = useState<{ id: number; status: 'PRESENT' | 'ABSENT' }>();
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('Watch a right swipe for present, then a left swipe for absent.');
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { if (preference.matches || document.hidden) setPlaying(false); };
    preference.addEventListener('change', stop); document.addEventListener('visibilitychange', stop);
    return () => { preference.removeEventListener('change', stop); document.removeEventListener('visibilitychange', stop); };
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting);
      if (visible && !started.current) {
        started.current = true;
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true);
        else setMessage('Automatic motion is reduced. Use the status buttons or swipe the card yourself.');
      }
      if (!visible) setPlaying(false);
    }, { threshold: .35 });
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || !finger.current) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const timeline = gsap.timeline({ onComplete: () => { setPlaying(false); setMessage('Your turn. Swipe the next card or use the status buttons.'); } });
      timeline.fromTo(finger.current, { x: -45, opacity: 0, rotation: -12 }, { x: -45, opacity: 1, duration: .35 })
        .to(finger.current, { x: 75, rotation: 8, duration: .85, ease: 'power2.inOut', delay: .3 })
        .call(() => { setMessage('Swipe right → Present'); setStep({ id: round * 2 + 1, status: 'PRESENT' }); })
        .to(finger.current, { opacity: 0, duration: .25 })
        .set(finger.current, { x: 45, rotation: 12 }).to(finger.current, { opacity: 1, duration: .35, delay: 1.1 })
        .to(finger.current, { x: -75, rotation: -8, duration: .85, ease: 'power2.inOut' })
        .call(() => { setMessage('Swipe left ← Absent'); setStep({ id: round * 2 + 2, status: 'ABSENT' }); })
        .to(finger.current, { opacity: 0, duration: .25 }).to({}, { duration: .6 });
    }, stage);
    return () => media.revert();
  }, [playing, round]);
  const replay = () => {
    setPlaying(false); setRound(value => value + 1); setStep(undefined); setMarks({}); setLocked(false);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setMessage('Motion reduced. Try the buttons or swipe manually.');
    else { setMessage('Watch the gesture, then try it yourself.'); setPlaying(true); }
  };
  return <section id="swipe-attendance" className="scroll-mt-24 py-16 sm:py-24 bg-background">
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-2 lg:gap-16 items-start">
      <div data-reveal className="lg:sticky lg:top-28">
        <p className="landing-eyebrow">Meet swipe attendance</p><h2 className="landing-heading mt-3">Take attendance.<br /><span className="text-primary">With a fingertip.</span></h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">Recognise the student. Swipe the card. Move to the next. This is the same component faculty use inside INCA, ready to try right here.</p>
        <div className="my-7 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700"><ArrowLeft className="size-5 mb-2" /><strong className="text-sm">Left for absent</strong></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700"><ArrowRight className="size-5 mb-2" /><strong className="text-sm">Right for present</strong></div></div>
        <div className="flex gap-3 rounded-2xl border bg-secondary/40 p-4"><WifiOff className="size-5 text-primary shrink-0 mt-0.5" /><p className="text-sm text-muted-foreground leading-relaxed"><strong className="text-foreground">Made for patchy connectivity.</strong> Prepare today’s classes online, mark them offline, then reopen or keep INCA connected to confirm the cloud upload.</p></div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Public practice uses three sample students and stays on this page. It does not save or upload campus attendance.</p>
      </div>
      <div className="min-w-0 rounded-3xl border bg-secondary/25 p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-card border px-3 py-1 text-xs font-semibold">Try the real swipe interface</span><div className="flex gap-2"><button type="button" onClick={() => { setPlaying(false); setMessage('Paused. You can swipe the card yourself.'); }} disabled={!playing} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs disabled:opacity-40"><Pause className="size-3" />Pause</button><button type="button" onClick={replay} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs"><RotateCcw className="size-3" />Replay</button></div></div>
        <p role="status" className="mb-3 text-xs min-h-8 text-muted-foreground">{locked ? 'Practice complete. Replay to start again.' : message}</p>
        <div ref={stage} className="relative min-w-0 overflow-x-clip" onPointerDownCapture={() => { if (playing) { setPlaying(false); setMessage('Your turn. Swipe or choose a status.'); } }}>
          <CardSwipeAttendance key={round} studentList={students} attendanceMap={marks} onMarkStatus={(id, status) => setMarks(previous => ({ ...previous, [id]: status }))} onSubmit={() => { setPlaying(false); setLocked(true); }} isLocked={locked} lockedMessage="Practice complete · nothing uploaded" keyboardEnabled={false} demonstrationStep={step} />
          {playing && <div ref={finger} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-64 z-20 -ml-7 flex size-14 items-center justify-center rounded-full border border-primary/20 bg-white/90 text-primary shadow-lg"><Pointer className="size-9" /></div>}
        </div>
      </div>
    </div>
  </section>;
}
