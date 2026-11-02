import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ArrowUpRight, BarChart3, Bell, BookOpen, CalendarDays, Check, Fingerprint, GraduationCap, Search, ShoppingBag, UserRound, Vote } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import dimensions from './screen-dimensions.json';

const features = [
  { id: 'attendance', label: 'Attendance', icon: Fingerprint, title: 'A swipe. A saved record. A simpler class.', description: 'Use the same swipe-card interface demonstrated below, or switch to the roster. Prepare a class online, mark it offline, then confirm its cloud upload.', points: ['Present, absent, late and excused', 'Offline drafts and upload queue', 'Audited attendance corrections'], route: '/attendance/mark', image: 'attendance', roles: ['FACULTY', 'HOD', 'COORDINATOR', 'ADMIN'] },
  { id: 'scheduling', label: 'Timetables', icon: CalendarDays, title: 'From semester timetable to today’s lecture.', description: 'Import timetable PDFs, map faculty and subjects, resolve conflicts, and open scheduled lectures from the existing scheduling workspace.', points: ['Academic program and section selection', 'Lecture editing and import review', 'Faculty and student timetable views'], route: '/schedules', image: 'scheduling' },
  { id: 'notices', label: 'Notices', icon: Bell, title: 'The right announcement, for the right people.', description: 'Department and campus notices include targeting, attachments, acknowledgement, scheduled publication, and the approval workflow.', points: ['Faculty/HOD approval requests', 'Read and acknowledgement tracking', 'AI summaries and extracted actions'], route: '/notices', image: 'notices' },
  { id: 'notes', label: 'Notes & AI', icon: BookOpen, title: 'Study from the material your faculty shared.', description: 'Browse course notes, preview documents, ask the document-grounded tutor, and generate practice quizzes inside the actual notes workspace.', points: ['Course-scoped files and Drive links', 'Tutor conversations with citations', 'Practice quizzes and attempt history'], route: '/notes', image: 'notes' },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, title: 'Campus exchange, with a clear handover.', description: 'Browse listings, negotiate in chat, and arrange a campus handover through the existing marketplace.', points: ['Listing photos and filters', 'Structured offers and chat', 'OTP handover and reviews'], route: '/marketplace', image: 'marketplace' },
  { id: 'lost-found', label: 'Lost & found', icon: Search, title: 'A clearer path from found to returned.', description: 'Report an item, review potential matches, submit an ownership claim, and verify the handover.', points: ['Lost/found reports with photos', 'AI match review', 'Ownership approval and OTP verification'], route: '/lost-found', image: 'lost-found' },
  { id: 'polls', label: 'Polls', icon: Vote, title: 'Campus decisions, one ballot at a time.', description: 'Create targeted polls with anonymous or identified voting, controlled result visibility, and voter reports.', points: ['Single or multiple choices', 'Audience and closing-time controls', 'Results and participation reports'], route: '/polls', image: 'polls' },
  { id: 'reports', label: 'Reports', icon: BarChart3, title: 'See attendance in context.', description: 'Move from institutional turnout to student, subject, section, or faculty reports using the implemented analytics workspace.', points: ['Shortfall and eligibility breakdowns', 'Date and department filters', 'Drilldowns and CSV exports'], route: '/reports', image: 'reports', roles: ['SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY'] },
  { id: 'academic', label: 'Academics', icon: GraduationCap, title: 'One connected academic foundation.', description: 'Manage the departments, programs, subjects, rooms, faculty, and students that power the other modules.', points: ['Role-scoped academic master data', 'Create and edit forms', 'Active and inactive record management'], route: '/academic', image: 'academic', roles: ['SUPER_ADMIN', 'ADMIN', 'HOD'] },
  { id: 'profile', label: 'Profile', icon: UserRound, title: 'Your campus identity, kept up to date.', description: 'See your approved profile immediately after login. Request detail or photo changes and manage account sessions in one place.', points: ['Approved name and profile photo', 'HOD/admin-reviewed change requests', 'Password and session controls'], route: '/profile', image: 'profile' },
];

export function ProductExperience({ active, onChange: setActive }: { active: string; onChange: (feature: string) => void }) {
  const { user } = useAuth();
  const panel = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const feature = features.find(item => item.id === active) || features[0];
  const allowed = user && (!feature.roles || feature.roles.includes(user.role.code));
  const [imageWidth, imageHeight] = dimensions[feature.image as keyof typeof dimensions];
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(panel.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .38, ease: 'power3.out', clearProps: 'transform,opacity' });
    });
    return () => media.revert();
  }, [active]);
  return <section id="showcase" className="scroll-mt-24 border-y border-border/70 bg-secondary/30 py-16 sm:py-24">
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div data-reveal className="max-w-3xl mb-8 sm:mb-10"><p className="landing-eyebrow">Product experience</p><h2 className="landing-heading mt-3">Designed for faculty,<br className="hidden sm:block" /> administrators, and students.</h2><p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">Explore the interfaces already built into INCA. Every feature has a place here, including on your phone.</p></div>
      <div ref={tabs} role="tablist" aria-label="Explore INCA features" className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
        {features.map((item, index) => <button key={item.id} type="button" role="tab" id={`feature-tab-${item.id}`} aria-selected={active === item.id} aria-controls="feature-preview" tabIndex={active === item.id ? 0 : -1} onClick={() => setActive(item.id)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % features.length : event.key === 'ArrowLeft' ? (index - 1 + features.length) % features.length : event.key === 'Home' ? 0 : event.key === 'End' ? features.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); setActive(features[next].id); (tabs.current?.querySelectorAll('button')[next] as HTMLButtonElement)?.focus(); }
        }} className={`min-w-0 min-h-14 rounded-xl border px-3 py-3 flex items-center gap-2 text-left text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active === item.id ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}><item.icon className="size-4 shrink-0" /><span className="break-words">{item.label}</span></button>)}
      </div>
      <div id="feature-preview" role="tabpanel" aria-labelledby={`feature-tab-${active}`} ref={panel} className="grid min-w-0 gap-8 rounded-3xl border bg-card p-4 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,390px)] lg:p-10">
        <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary"><feature.icon className="size-4" />{feature.label}</div>
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight text-foreground">{feature.title}</h3>
          <p className="mt-4 leading-relaxed text-muted-foreground">{feature.description}</p>
          <ul className="my-7 space-y-3 text-sm">{feature.points.map(point => <li className="flex gap-2.5" key={point}><Check className="size-4 mt-0.5 shrink-0 text-emerald-600" /><span>{point}</span></li>)}</ul>
          <Link data-hover-lift to={allowed ? feature.route : user ? '/hub' : '/login'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{allowed ? `Open ${feature.label.toLowerCase()}` : user ? 'Open my workspace' : 'Sign in to use this feature'}<ArrowUpRight className="size-4" /></Link>
          {active === 'attendance' && <a href="#swipe-attendance" className="mt-4 flex w-fit items-center gap-2 text-sm font-semibold text-primary">Try the swipe interface ↓</a>}
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">Captured from the implemented application using sample data. This is a screen preview; use the workspace link for live actions. Private campus records stay behind sign-in.</p>
        </div>
        <figure className="min-w-0 mx-auto w-full max-w-[390px] self-start">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>Actual INCA interface</span><span className="rounded-full border px-2 py-1">Sample data</span></div>
          <img key={feature.image} src={`/product-screens/${feature.image}-mobile.jpg`} alt={`${feature.label}: screenshot of INCA’s implemented mobile interface with sample data`} width={imageWidth} height={imageHeight} loading="lazy" decoding="async" className="block h-auto w-full rounded-2xl border bg-background shadow-sm" />
          <figcaption className="mt-3 text-xs text-muted-foreground">{feature.label} workspace · mobile view</figcaption>
        </figure>
      </div>
    </div>
  </section>;
}
