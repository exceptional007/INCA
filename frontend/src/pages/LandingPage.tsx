import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Clock,
  Calendar,
  Bell,
  Sparkles,
  ShoppingBag,
  Search,
  CheckCircle2,
  FileText,
  Menu,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'attendance' | 'scheduling' | 'notices' | 'notes'>('attendance');

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans overflow-x-hidden text-foreground">
      {/* 1. Unified Navigation Bar */}
      <header className="sticky top-0 z-50 w-full bg-background/90 backdrop-blur-md border-b border-border transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none group" 
            onClick={() => navigate('/')}
          >
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs transition-transform group-hover:scale-102">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-foreground flex items-center gap-1.5 leading-none">
                INCA
                <span className="text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                  Campus SaaS
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline-block mt-0.5 font-medium">
                Intelligent Campus Assistant
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <button 
              onClick={() => scrollToSection('overview')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Overview
            </button>
            <button 
              onClick={() => scrollToSection('showcase')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Live Interface
            </button>
            <button 
              onClick={() => scrollToSection('capabilities')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Capabilities
            </button>
            <button 
              onClick={() => scrollToSection('workflows')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              How It Connects
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-foreground hover:text-primary px-3 py-1.5 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <Button
              onClick={() => navigate('/login')}
              className="bg-primary hover:bg-primary/95 text-primary-foreground font-medium px-4 py-2 rounded-xl text-sm shadow-xs transition-all cursor-pointer"
            >
              Access Platform
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>

          {/* Mobile Menu Hamburger Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate('/login')}
              className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              Sign In
            </Button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-background px-4 pt-2 pb-6 space-y-3 animate-fadeIn">
            <button
              onClick={() => scrollToSection('overview')}
              className="block w-full text-left py-2 text-sm font-medium text-foreground hover:text-primary"
            >
              Overview
            </button>
            <button
              onClick={() => scrollToSection('showcase')}
              className="block w-full text-left py-2 text-sm font-medium text-foreground hover:text-primary"
            >
              Live Interface
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="block w-full text-left py-2 text-sm font-medium text-foreground hover:text-primary"
            >
              Capabilities
            </button>
            <button
              onClick={() => scrollToSection('workflows')}
              className="block w-full text-left py-2 text-sm font-medium text-foreground hover:text-primary"
            >
              How It Connects
            </button>
            <div className="pt-2 border-t border-border flex flex-col gap-2">
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-primary text-primary-foreground justify-center py-2.5 rounded-xl font-medium"
              >
                Access Platform
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section id="overview" className="relative pt-12 pb-20 md:pt-20 md:pb-28 border-b border-border/80 bg-background overflow-hidden">
          {/* Subtle Institutional Geometric Accents */}
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Centered on mobile, balanced on desktop */}
            <div className="text-center flex flex-col items-center">
              {/* Category pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-xs font-medium text-muted-foreground mb-6 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Integrated Campus Operations Platform</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.12] mb-6 max-w-4xl text-balance">
                One campus. <br className="hidden sm:inline" />
                <span className="text-primary">One connected system.</span>
              </h1>

              {/* Supporting Subhead */}
              <p className="max-w-2xl text-base sm:text-lg text-muted-foreground font-normal leading-relaxed mb-8 text-balance">
                Unify academic scheduling, real-time attendance tracking, institutional notices, course notes, and peer campus services into a single, cohesive operating system.
              </p>

              {/* Primary Calls to Action */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto mb-14">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-primary-foreground font-medium px-6 py-2.5 rounded-xl text-base shadow-xs group cursor-pointer"
                  onClick={() => navigate('/login')}
                >
                  Access Platform
                  <ChevronRight className="ml-1.5 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto border-border text-foreground hover:bg-secondary font-medium px-6 py-2.5 rounded-xl text-base cursor-pointer"
                  onClick={() => scrollToSection('showcase')}
                >
                  Explore Interface
                </Button>
              </div>

              {/* Operational Verification Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-border/80 w-full max-w-3xl text-left">
                <div className="p-3 rounded-lg bg-card border border-border/60">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timetables</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">Automated PDF Sync</div>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border/60">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">Swipe & Roster Audit</div>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border/60">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Circulars</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">Targeted Audience</div>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border/60">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Security</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">Multi-Role RBAC</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Product Showcase (Authentic Live Interface Views) */}
        <section id="showcase" className="py-20 md:py-28 bg-secondary/50 border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Product Experience
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground mt-2 mb-4">
                Designed for faculty, administrators, and students.
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Explore the genuine interfaces powering everyday operations across university departments.
              </p>
            </div>

            {/* Showcase Tab Switcher */}
            <div className="flex items-center justify-center mb-8 overflow-x-auto pb-2 scrollbar-none">
              <div className="inline-flex p-1 rounded-xl bg-card border border-border shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveShowcaseTab('attendance')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeShowcaseTab === 'attendance'
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Smart Attendance
                </button>
                <button
                  type="button"
                  onClick={() => setActiveShowcaseTab('scheduling')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeShowcaseTab === 'scheduling'
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Timetable & Scheduling
                </button>
                <button
                  type="button"
                  onClick={() => setActiveShowcaseTab('notices')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeShowcaseTab === 'notices'
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  Notice Board
                </button>
                <button
                  type="button"
                  onClick={() => setActiveShowcaseTab('notes')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeShowcaseTab === 'notes'
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  AI Notes & Tutor
                </button>
              </div>
            </div>

            {/* Showcase Display Container */}
            <div className="w-full bg-card rounded-2xl border border-border shadow-md overflow-hidden">
              {/* Browser / Application Top Frame */}
              <div className="bg-muted/60 border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-border" />
                  <div className="w-3 h-3 rounded-full bg-border" />
                  <div className="w-3 h-3 rounded-full bg-border" />
                  <span className="text-xs font-mono text-muted-foreground ml-2 hidden sm:inline-block">
                    app.inca.campus/{activeShowcaseTab}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] font-medium bg-background text-muted-foreground border-border">
                    Production Role: Faculty / Administrator
                  </Badge>
                </div>
              </div>

              {/* Screen Content View */}
              <div className="p-4 sm:p-6 md:p-8 min-h-[420px] flex flex-col justify-center">
                {activeShowcaseTab === 'attendance' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-wide">CS-302</span>
                          <span className="text-xs text-muted-foreground">• Section A (Semester 6)</span>
                        </div>
                        <h3 className="text-lg font-bold text-foreground mt-0.5">Database Management Systems Lab</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-800 border-none text-xs font-medium">
                          Session In Progress
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">10:00 AM - 11:40 AM</span>
                      </div>
                    </div>

                    {/* Authentic Attendance Session Roster View */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-muted/40 border border-border">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Attendance Rate</span>
                        <div className="text-2xl font-bold text-foreground mt-1">88.9%</div>
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Above 75% institutional threshold
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-muted/40 border border-border">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Headcount Verified</span>
                        <div className="text-2xl font-bold text-foreground mt-1">40 / 45</div>
                        <p className="text-xs text-muted-foreground mt-1">5 absentees flagged for audit log</p>
                      </div>

                      <div className="p-4 rounded-xl bg-muted/40 border border-border">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mode</span>
                        <div className="text-2xl font-bold text-foreground mt-1">Swipe Card</div>
                        <p className="text-xs text-muted-foreground mt-1">Instant photo identification enabled</p>
                      </div>
                    </div>

                    {/* Mock Student Table Segment */}
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <div className="bg-muted/50 px-4 py-2.5 font-semibold text-muted-foreground grid grid-cols-12 gap-2">
                        <div className="col-span-5 sm:col-span-4">Student Name & Roll No</div>
                        <div className="col-span-4 sm:col-span-5">Program & Batch</div>
                        <div className="col-span-3 text-right">Status</div>
                      </div>
                      <div className="divide-y divide-border/60 bg-card">
                        <div className="px-4 py-2.5 grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5 sm:col-span-4 font-medium text-foreground">
                            Aarav Sharma <span className="text-muted-foreground font-mono text-[10px] block sm:inline sm:ml-1">(2023-CS-041)</span>
                          </div>
                          <div className="col-span-4 sm:col-span-5 text-muted-foreground">B.Tech CSE-DS (2023-27)</div>
                          <div className="col-span-3 text-right">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[10px]">PRESENT</span>
                          </div>
                        </div>
                        <div className="px-4 py-2.5 grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5 sm:col-span-4 font-medium text-foreground">
                            Diya Patel <span className="text-muted-foreground font-mono text-[10px] block sm:inline sm:ml-1">(2023-CS-084)</span>
                          </div>
                          <div className="col-span-4 sm:col-span-5 text-muted-foreground">B.Tech CSE-DS (2023-27)</div>
                          <div className="col-span-3 text-right">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[10px]">PRESENT</span>
                          </div>
                        </div>
                        <div className="px-4 py-2.5 grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5 sm:col-span-4 font-medium text-foreground">
                            Rohan Verma <span className="text-muted-foreground font-mono text-[10px] block sm:inline sm:ml-1">(2023-CS-112)</span>
                          </div>
                          <div className="col-span-4 sm:col-span-5 text-muted-foreground">B.Tech CSE-DS (2023-27)</div>
                          <div className="col-span-3 text-right">
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-semibold text-[10px]">ABSENT</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'scheduling' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
                      <div>
                        <span className="text-xs font-bold text-primary uppercase tracking-wide">Weekly Master Grid</span>
                        <h3 className="text-lg font-bold text-foreground mt-0.5">Department of Computer Science & Engineering</h3>
                      </div>
                      <Badge variant="outline" className="border-border text-foreground text-xs self-start sm:self-center">
                        Semester 6 • Room 304
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl border border-border bg-card">
                        <div className="flex justify-between items-center text-[11px] text-muted-foreground mb-1">
                          <span>09:10 - 10:00 AM</span>
                          <span className="font-mono text-primary font-semibold">LEC-1</span>
                        </div>
                        <div className="font-semibold text-sm text-foreground">Machine Learning</div>
                        <div className="text-xs text-muted-foreground mt-1">Dr. S. K. Roy • LH-201</div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5">
                        <div className="flex justify-between items-center text-[11px] text-primary mb-1">
                          <span>10:00 - 10:50 AM</span>
                          <span className="font-mono font-semibold">LEC-2</span>
                        </div>
                        <div className="font-semibold text-sm text-foreground">Compiler Design</div>
                        <div className="text-xs text-muted-foreground mt-1">Prof. A. Sengupta • LH-201</div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border bg-card">
                        <div className="flex justify-between items-center text-[11px] text-muted-foreground mb-1">
                          <span>11:00 - 12:40 PM</span>
                          <span className="font-mono text-amber-700 font-semibold">LAB (2 Slots)</span>
                        </div>
                        <div className="font-semibold text-sm text-foreground">Cloud Computing Lab</div>
                        <div className="text-xs text-muted-foreground mt-1">Lab Group B • Server Lab</div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border bg-card">
                        <div className="flex justify-between items-center text-[11px] text-muted-foreground mb-1">
                          <span>01:30 - 02:20 PM</span>
                          <span className="font-mono text-primary font-semibold">LEC-3</span>
                        </div>
                        <div className="font-semibold text-sm text-foreground">Network Security</div>
                        <div className="text-xs text-muted-foreground mt-1">Dr. M. Bannerjee • LH-201</div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/80 border border-border flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-primary" />
                        <span className="font-medium text-foreground">
                          PDF Import Pipeline: Automatic extraction, faculty conflict resolution, and schedule synchronization.
                        </span>
                      </div>
                      <Badge className="bg-primary text-primary-foreground text-[10px]">Verified</Badge>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'notices' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
                      <div>
                        <span className="text-xs font-bold text-primary uppercase tracking-wide">Official Circulars</span>
                        <h3 className="text-lg font-bold text-foreground mt-0.5">Smart Targeted Notice Board</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-rose-100 text-rose-800 border-none text-xs">Urgent Priority</Badge>
                        <Badge variant="outline" className="border-border text-xs">Target: CSE 3rd Year</Badge>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl border border-rose-200/80 bg-rose-50/30">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white uppercase tracking-wider">
                              CRITICAL ALERT
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">Published by Dean Academics</span>
                          </div>
                          <h4 className="text-base font-bold text-foreground">
                            Mid-Semester Examination Schedule & Room Allocations - Spring 2027
                          </h4>
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            Official guidelines for the upcoming mid-semester examinations. All students are required to verify their seating assignments and carry their institutional smart cards.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-rose-200/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium">
                            <FileText className="w-3.5 h-3.5 text-primary" /> exam-schedule-spring2027.pdf (1.2 MB)
                          </span>
                          <span>•</span>
                          <span>Acknowledged by 384 students</span>
                        </div>
                        <span className="text-primary font-semibold hover:underline cursor-pointer">
                          View Attachment & Rules →
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'notes' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
                      <div>
                        <span className="text-xs font-bold text-primary uppercase tracking-wide">Academic Workspace</span>
                        <h3 className="text-lg font-bold text-foreground mt-0.5">Course-Grounded AI Study Space</h3>
                      </div>
                      <Badge variant="outline" className="border-border text-foreground text-xs">
                        Subject: Data Structures & Algorithms
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Note Card */}
                      <div className="p-4 rounded-xl border border-border bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            UNIT 3: BALANCED TREES
                          </span>
                          <span className="text-[10px] text-muted-foreground">PDF • 4.8 MB</span>
                        </div>
                        <h4 className="text-sm font-bold text-foreground">AVL Trees & Red-Black Balancing Principles</h4>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Rotations, height balance invariants, insertion algorithms, and asymptotic complexity proofs.
                        </p>
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                          <span>Prof. V. Sharma</span>
                          <span className="text-primary font-semibold">Tutor Index Ready</span>
                        </div>
                      </div>

                      {/* AI Tutor Panel */}
                      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-primary text-xs font-semibold mb-2">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Grounded Tutor Query</span>
                          </div>
                          <p className="text-xs text-foreground font-medium bg-background/80 p-2.5 rounded-lg border border-border">
                            "When is a Left-Right (LR) double rotation required in an AVL tree?"
                          </p>
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            <strong className="text-foreground">Tutor:</strong> An LR rotation occurs when a node is inserted into the right subtree of the left child, causing a balance factor of +2 with child balance factor of -1.
                          </p>
                        </div>
                        <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-primary font-medium">
                          <span>Source: Unit-3-Lecture-Notes.pdf (Page 14)</span>
                          <span className="underline cursor-pointer">Generate Practice Quiz</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Verified Capabilities Grid (Showcase ONLY Category A Features) */}
        <section id="capabilities" className="py-20 md:py-28 bg-background border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Platform Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground mt-2 mb-4">
                Built specifically for higher-education operations.
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Every feature below is implemented and active in INCA today. No speculative roadmaps, no placeholder modules.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Capability 1: Academic Scheduling & Timetables */}
              <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Timetable PDF Import & Scheduling</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
                    Import institutional timetable PDFs with automatic slot extraction, professor mapping, classroom conflict checks, and direct synchronization into live daily lectures.
                  </p>
                </div>
                <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-primary font-semibold">
                  <span>Academic Operations</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>

              {/* Capability 2: Smart Attendance & Auditing */}
              <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Smart Attendance & Auditing</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
                    Multi-mode attendance logging with card swipe and list views. Real-time 75% threshold tracking, automated absence flags, and complete audit history for faculty edits.
                  </p>
                </div>
                <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-primary font-semibold">
                  <span>Faculty & HOD Tools</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>

              {/* Capability 3: Digital Notice Board */}
              <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                    <Bell className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Targeted Notice Board</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
                    Publish official circulars with granular targeting by department, degree program, semester, and batch. Supports critical priorities, PDF attachments, and read tracking.
                  </p>
                </div>
                <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-primary font-semibold">
                  <span>Campus Communication</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>

              {/* Capability 4: Course Notes & AI Tutor */}
              <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">AI Notes & Interactive Tutor</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
                    Course-scoped learning library where faculty upload lecture materials. Students query an AI study assistant grounded exclusively in official course notes with practice quizzes.
                  </p>
                </div>
                <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-primary font-semibold">
                  <span>Academic Learning</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>

              {/* Capability 5: Campus Marketplace */}
              <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Verified Campus Marketplace</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
                    Restricted peer-to-peer exchange for textbooks, electronics, dorm essentials, and lab gear. Includes real-time buyer-seller chat, negotiation, and admin moderation.
                  </p>
                </div>
                <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-primary font-semibold">
                  <span>Student Commerce</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>

              {/* Capability 6: AI-Powered Lost & Found */}
              <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                    <Search className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">AI Lost & Found with OTP Handover</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
                    Report misplaced items with photo uploads. Multi-stage semantic matching connects lost and found reports, while secure 6-digit OTP verification ensures safe physical handovers.
                  </p>
                </div>
                <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-primary font-semibold">
                  <span>Campus Utilities</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. How It Fits Together (Unified Operational Flow) */}
        <section id="workflows" className="py-20 md:py-28 bg-secondary/50 border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Connected Workflows
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground mt-2 mb-4">
                How academic data flows seamlessly across INCA.
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Eliminate isolated data silos. See how master timetables power daily operations from classroom to dean's reports.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-card border border-border relative">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mb-3">
                  01
                </div>
                <h4 className="text-base font-bold text-foreground mb-1.5">Master Schedule</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Administrator uploads semester timetable PDF. System resolves faculty workloads and commits conflict-free lecture slots.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border relative">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mb-3">
                  02
                </div>
                <h4 className="text-base font-bold text-foreground mb-1.5">Daily Sessions</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Lectures automatically activate in faculty portals. Professors launch swipe-card or roster sessions in seconds.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border relative">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mb-3">
                  03
                </div>
                <h4 className="text-base font-bold text-foreground mb-1.5">Real-time Thresholds</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Attendance records immediately update student analytics. Threshold deficits generate alerts before exam eligibility cutoffs.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border relative">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mb-3">
                  04
                </div>
                <h4 className="text-base font-bold text-foreground mb-1.5">Institutional Insights</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Deans and HODs review program-wide attendance metrics, export compliance audit logs, and issue targeted circulars.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Final Call to Action */}
        <section className="py-20 md:py-24 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
              Ready to streamline your campus operations?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-8 text-balance">
              Sign in with your institutional credentials or contact administration for platform onboarding.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Button
                size="lg"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-primary-foreground font-medium px-8 py-3 rounded-xl text-base shadow-xs cursor-pointer"
              >
                Access Platform
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* 7. Refined Footer */}
      <footer className="bg-secondary/80 border-t border-border pt-16 pb-12 text-muted-foreground text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand info */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-base">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>INCA</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              Intelligent Campus Assistant (INCA) is an institutional SaaS platform uniting timetable scheduling, smart attendance, official circulars, and student services.
            </p>
            <div className="text-[11px] text-muted-foreground">
              Architecture: Multi-tenant RBAC • Cloudflare R2 Storage • NestJS & React
            </div>
          </div>

          {/* Academic modules */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">Academic Suite</h4>
            <ul className="space-y-2">
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">Timetables & Schedules</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">Smart Attendance (ASSAM)</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">Timetable PDF Importer</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">Academic Master Data</button></li>
            </ul>
          </div>

          {/* Campus Services */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">Campus Services</h4>
            <ul className="space-y-2">
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">Digital Notice Board</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">AI Notes & Tutor</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">Campus Marketplace</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">AI Lost & Found</button></li>
            </ul>
          </div>

          {/* Institutional Access */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">Institutional</h4>
            <ul className="space-y-2">
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">Administrator Portal</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">Faculty Workspace</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">Student Dashboard</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors cursor-pointer">System Status</button></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <div>
            &copy; {new Date().getFullYear()} INCA. Intelligent Campus Assistant. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-muted-foreground">
            <span>Enterprise Campus System</span>
            <span>•</span>
            <span>Institutional Data Protection</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
