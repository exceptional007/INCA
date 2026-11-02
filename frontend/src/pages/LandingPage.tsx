import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays, Check, Fingerprint, GraduationCap, Menu, Search, ShieldCheck, ShoppingBag, Vote, X } from 'lucide-react';
import { InstallAppButton } from '@/components/InstallAppButton';
import { ProductExperience } from '@/components/landing/ProductExperience';
import { SwipeExperience } from '@/components/landing/SwipeExperience';
import { useLandingMotion } from '@/components/landing/useLandingMotion';
import { useAuth } from '@/context/AuthContext';

const modules = [
  { icon: CalendarDays, title: 'Timetables that connect', copy: 'Import semester timetables, map lectures, and keep faculty and student schedules together.', route: '/schedules' },
  { icon: Fingerprint, title: 'Attendance with less friction', copy: 'Swipe, review, and submit. Keep working through weak connectivity with prepared offline rosters.', route: '/attendance/mark' },
  { icon: Bell, title: 'Notices with a clear audience', copy: 'Publish targeted announcements with approvals, attachments, acknowledgements, and scheduled release.', route: '/notices' },
  { icon: BookOpen, title: 'A course-grounded study space', copy: 'Read shared notes, ask the tutor with source citations, and practise with quizzes.', route: '/notes' },
  { icon: ShoppingBag, title: 'A campus marketplace', copy: 'Find books and equipment, negotiate with peers, and verify the handover.', route: '/marketplace' },
  { icon: Search, title: 'Lost, found, and returned', copy: 'Connect item reports with potential matches, ownership review, and a verified return.', route: '/lost-found' },
  { icon: Vote, title: 'A voice in campus decisions', copy: 'Run targeted polls with anonymous or identified ballots and controlled results.', route: '/polls' },
  { icon: GraduationCap, title: 'One academic foundation', copy: 'Keep programs, sections, subjects, faculty, students, and reports connected.', route: '/academic' },
  { icon: ShieldCheck, title: 'Your identity, your controls', copy: 'See your profile, request approved updates, and manage password and account sessions.', route: '/profile' },
];
const workflow = [
  ['Prepare', 'Start with the timetable. Load the day’s authorised classes and student rosters while connected.'],
  ['Take attendance', 'Swipe cards or use the list. Changes stay on the device, even when connectivity drops.'],
  ['Confirm upload', 'Submit locally, then let INCA sync when the app is connected. See when the cloud confirms it.'],
  ['Follow through', 'Review reports, make audited corrections, and share the right notice with the right group.'],
];

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState('attendance');
  const { user } = useAuth();
  useLandingMotion(root);
  const closeMenu = () => setMenuOpen(false);
  return <div ref={root} className="landing-page bg-background text-foreground" onKeyDown={event => { if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); } }}>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-white">Skip to content</a>
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="INCA home"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></span><span className="text-lg">INCA<span className="ml-2 hidden text-xs font-normal tracking-normal text-muted-foreground sm:inline">Campus assistant</span></span></Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm text-muted-foreground md:flex"><a href="#showcase" data-hover-lift>Product</a><a href="#swipe-attendance" data-hover-lift>Swipe attendance</a><a href="#capabilities" data-hover-lift>Features</a><a href="#workflows" data-hover-lift>How it works</a></nav>
        <div className="flex items-center gap-2"><Link to={user ? '/hub' : '/login'} className="rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground sm:text-sm">{user ? 'Open workspace' : 'Sign in'}<ArrowUpRight className="ml-1.5 inline size-3.5" /></Link><button ref={menuButton} type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-landing-nav" onClick={() => setMenuOpen(!menuOpen)} className="grid size-10 place-items-center rounded-lg border md:hidden">{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button></div>
      </div>
      {menuOpen && <nav id="mobile-landing-nav" aria-label="Mobile navigation" className="grid gap-1 border-t px-4 py-3 text-sm md:hidden">{[['Product', '#showcase'], ['Swipe attendance', '#swipe-attendance'], ['All features', '#capabilities'], ['How it works', '#workflows']].map(([label, href]) => <a key={href} href={href} onClick={closeMenu} className="rounded-xl px-3 py-3 hover:bg-secondary">{label}</a>)}</nav>}
    </header>
    <main id="main-content">
      <section id="overview" className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-8 lg:py-24">
        <div data-reveal className="min-w-0"><p className="landing-eyebrow flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-500" />A calmer way to run your campus</p><h1 className="mt-5 max-w-3xl text-[clamp(2.6rem,7vw,5.3rem)] leading-[1.06] font-semibold tracking-[-.05em]">Your campus.<br /><span className="text-primary">More connected.</span><br />Less complicated.</h1><p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">From the first lecture to the last notice. Bring attendance, schedules, learning, and campus life into one familiar place.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><Link data-hover-lift to={user ? '/hub' : '/login'} className="inline-flex items-center gap-3 rounded-xl bg-primary px-5 py-3.5 font-semibold text-sm text-primary-foreground">Open INCA<ArrowRight className="size-4" /></Link><a href="#showcase" data-hover-lift className="inline-flex items-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-medium">Explore the product<ArrowDown className="size-4" /></a></div>
          <div className="mt-5"><InstallAppButton /></div><p className="mt-3 text-xs text-muted-foreground">Use it on the web. Install it on your phone or desktop.</p>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs text-muted-foreground">{['Faculty', 'Students', 'Administrators'].map(role => <span key={role} className="flex items-center gap-1.5"><Check className="size-3.5 text-primary" />{role}</span>)}</div>
        </div>
        <div data-reveal className="min-w-0 rounded-[2rem] border bg-secondary/40 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3"><div><p className="landing-eyebrow">The everyday, simplified</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Start with a swipe.</h2></div><Fingerprint className="size-8 shrink-0 text-primary" /></div>
          <a href="#swipe-attendance" className="mt-5 block rounded-2xl border bg-card p-4 sm:p-5 focus-visible:ring-2 focus-visible:ring-primary" data-hover-lift><div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Fingerprint className="size-6" /></span><div className="min-w-0"><h3 className="font-semibold text-sm">Swipe attendance</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Recognise. Swipe. Next student.</p></div><ArrowUpRight className="ml-auto size-5 shrink-0 text-primary" /></div><div className="mt-5 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">← Absent</span><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">Present →</span><span className="rounded-full bg-secondary px-3 py-1.5 text-muted-foreground">Offline ready</span></div></a>
          <div className="mt-3 grid grid-cols-2 gap-3">{[{ label: 'One organised day', text: 'Timetables & lectures', icon: CalendarDays, href: '#showcase' }, { label: 'One learning space', text: 'Notes, tutor & quizzes', icon: BookOpen, href: '#showcase' }].map(item => <a href={item.href} onClick={() => setActiveFeature(item.label === 'One organised day' ? 'scheduling' : 'notes')} data-hover-lift key={item.label} className="min-w-0 rounded-2xl border bg-card p-4"><item.icon className="size-5 text-primary mb-4" /><h3 className="text-sm font-semibold">{item.label}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p></a>)}</div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Less switching between tools. More time for the people on campus.</p>
        </div>
      </section>
      <ProductExperience active={activeFeature} onChange={setActiveFeature} />
      <SwipeExperience />
      <section id="capabilities" className="scroll-mt-24 border-y bg-secondary/30 py-16 sm:py-24"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div data-reveal className="mb-9 max-w-2xl"><p className="landing-eyebrow">A connected toolkit</p><h2 className="landing-heading mt-3">Built around your campus day.</h2><p className="mt-4 leading-relaxed text-muted-foreground">Useful on their own. Better when they work together.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.map(item => <a key={item.title} href="#showcase" onClick={() => setActiveFeature(item.route === '/schedules' ? 'scheduling' : item.route.split('/')[1])} data-reveal data-hover-lift className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6"><item.icon className="size-6 text-primary" /><h3 className="mt-5 text-base font-semibold tracking-tight">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.copy}</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-primary">Explore feature<ArrowUpRight className="size-3.5" /></span></a>)}</div></div></section>
      <section id="workflows" className="scroll-mt-24 py-16 sm:py-24"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div data-reveal className="max-w-2xl mb-10"><p className="landing-eyebrow">How it works</p><h2 className="landing-heading mt-3">One day. One continuous flow.</h2></div><ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{workflow.map(([title, copy], index) => <li key={title} data-reveal className="min-w-0 border-t-2 border-primary/20 pt-5"><span className="text-xs font-mono text-primary">0{index + 1}</span><h3 className="mt-4 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p></li>)}</ol></div></section>
      <section className="mx-auto mb-16 max-w-6xl px-4 sm:px-6 lg:px-8"><div data-reveal className="rounded-3xl border bg-primary/5 px-5 py-10 sm:px-10 sm:py-14"><p className="landing-eyebrow">Your campus, within reach</p><h2 className="landing-heading mt-3 max-w-2xl">A familiar workspace.<br />Wherever the day takes you.</h2><p className="mt-4 max-w-xl text-muted-foreground leading-relaxed">Sign in with your institutional account, or install INCA for a quicker way back.</p><div className="mt-7 flex flex-wrap items-center gap-3"><Link data-hover-lift to={user ? '/hub' : '/login'} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{user ? 'Open my workspace' : 'Sign in to INCA'}<ArrowRight className="ml-2 inline size-4" /></Link><InstallAppButton /></div></div></section>
    </main>
    <footer className="border-t bg-secondary/20"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-9 text-sm sm:flex-row sm:items-center sm:px-6 lg:px-8"><div><Link to="/" className="font-semibold tracking-tight">INCA</Link><p className="mt-1 text-xs text-muted-foreground">Intelligent Campus Assistant</p></div><nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground"><a href="#showcase">Product</a><a href="#swipe-attendance">Swipe attendance</a><a href="#capabilities">Features</a><Link to={user ? '/profile' : '/login'}>My account</Link></nav><p className="text-xs text-muted-foreground">© {new Date().getFullYear()} INCA</p></div></footer>
  </div>;
}
