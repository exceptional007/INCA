import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldCheck, LayoutDashboard, Clock, Users, ChevronRight, BookOpen, Settings2, BarChart3 } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans select-none overflow-x-hidden">
      {/* 1. Global Navigation Bar (Apple Style: Pinned, Thin, Black) */}
      <header className="h-[44px] w-full bg-surface-black text-white flex items-center justify-between px-6 z-50 sticky top-0">
        <div className="flex items-center gap-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 mr-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')}>
            <ShieldCheck className="h-4.5 w-4.5 text-white" />
            <span className="text-[14px] font-semibold tracking-tight">INCA</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6 text-[12px] text-[#cccccc] font-normal tracking-tight">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="text-[12px] text-[#cccccc] hover:text-white transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="text-[12px] bg-white text-black font-medium px-3 py-1 rounded-full hover:bg-[#e0e0e0] active:scale-95 transition-all cursor-pointer"
            >
              Access
            </button>
          </div>
        </div>
      </header>

      {/* 2. Sub-Navigation Bar (Apple Style: Sticky, Frosted Glass, Parchment) */}
      <div className="h-[52px] w-full bg-canvas-parchment/80 backdrop-blur-md border-b border-[#e0e0e0] flex items-center sticky top-[44px] z-40">
        <div className="flex items-center justify-between px-6 max-w-7xl mx-auto w-full">
          <span className="text-[20px] font-semibold tracking-tight text-ink">INCA Assistant</span>
          <div className="flex items-center gap-4">
            <a href="#overview" className="text-xs text-ink-muted-80 hover:text-action-blue transition-colors">Overview</a>
            <a href="#capabilities" className="text-xs text-ink-muted-80 hover:text-action-blue transition-colors">Specs</a>
            <Button size="sm" onClick={() => navigate('/login')} className="bg-action-blue hover:opacity-95 text-white">
              Get Started
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1">
        {/* 3. Hero Product Tile (White Canvas, Typography-First) */}
        <section id="overview" className="w-full pt-16 pb-24 bg-background flex flex-col items-center border-b border-[#e0e0e0]">
          <div className="max-w-4xl px-6 text-center flex flex-col items-center">
            <span className="text-xs uppercase text-action-blue tracking-widest font-semibold mb-3">INCA Platform</span>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-ink leading-[1.07] mb-6">
              Intelligent Campus <br />
              <span className="text-[#86868b]">Automation</span>
            </h1>
            
            <p className="max-w-[640px] text-lg sm:text-xl text-[#86868b] font-normal leading-relaxed mb-8">
              Streamline academic scheduling, automate attendance tracking, and unify campus operations with our enterprise-grade SaaS platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Button size="lg" className="bg-action-blue text-white group" onClick={() => navigate('/login')}>
                Access Platform
                <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" className="border-action-blue text-action-blue hover:bg-action-blue/5">
                View Documentation
              </Button>
            </div>
          </div>

          {/* Interactive CSS Dashboard Preview Container with the ONE Drop Shadow */}
          <div className="w-full max-w-5xl px-6">
            <div className="w-full aspect-[16/10] bg-canvas-parchment rounded-[18px] border border-[#e0e0e0] shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-4 md:p-6 overflow-hidden flex flex-col">
              {/* Fake Dashboard Top Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-[#e0e0e0] mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                  <span className="text-xs font-semibold text-ink-muted-80 ml-2">INCA Dashboard</span>
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-20 rounded-full bg-white border border-[#e0e0e0]" />
                  <div className="h-6 w-12 rounded-full bg-action-blue" />
                </div>
              </div>

              {/* Fake Dashboard Content Layout */}
              <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
                {/* Sidebar mock */}
                <div className="col-span-1 border-r border-[#e0e0e0] pr-4 hidden md:flex flex-col gap-3">
                  <div className="h-8 w-full rounded-md bg-white border border-[#e0e0e0] flex items-center px-2 text-[11px] font-semibold text-action-blue">
                    <LayoutDashboard className="h-3 w-3 mr-1.5 text-action-blue" /> Overview
                  </div>
                  <div className="h-8 w-full rounded-md bg-transparent flex items-center px-2 text-[11px] font-medium text-ink-muted-80">
                    <Clock className="h-3 w-3 mr-1.5 text-ink-muted-80" /> Classes
                  </div>
                  <div className="h-8 w-full rounded-md bg-transparent flex items-center px-2 text-[11px] font-medium text-ink-muted-80">
                    <Users className="h-3 w-3 mr-1.5 text-ink-muted-80" /> Attendance
                  </div>
                  <div className="h-8 w-full rounded-md bg-transparent flex items-center px-2 text-[11px] font-medium text-ink-muted-80">
                    <BarChart3 className="h-3 w-3 mr-1.5 text-ink-muted-80" /> Analytics
                  </div>
                </div>

                {/* Dashboard Main mock */}
                <div className="col-span-4 md:col-span-3 flex flex-col gap-4 overflow-y-auto pr-1">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-[#e0e0e0] p-3 rounded-xl flex flex-col">
                      <span className="text-[10px] text-[#86868b] font-medium uppercase">Active Classes</span>
                      <span className="text-xl font-bold text-ink mt-1">12</span>
                      <span className="text-[9px] text-[#34c759] mt-1 font-semibold">100% Conflict Free</span>
                    </div>
                    <div className="bg-white border border-[#e0e0e0] p-3 rounded-xl flex flex-col">
                      <span className="text-[10px] text-[#86868b] font-medium uppercase">Attendance rate</span>
                      <span className="text-xl font-bold text-ink mt-1">94.8%</span>
                      <span className="text-[9px] text-action-blue mt-1 font-semibold">Healthy Ratio</span>
                    </div>
                    <div className="bg-white border border-[#e0e0e0] p-3 rounded-xl flex flex-col">
                      <span className="text-[10px] text-[#86868b] font-medium uppercase">Faculty Load</span>
                      <span className="text-xl font-bold text-ink mt-1">18h / wk</span>
                      <span className="text-[9px] text-action-blue mt-1 font-semibold">Balanced</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#e0e0e0] p-4 rounded-xl flex-1 flex flex-col min-h-[160px]">
                    <span className="text-[11px] font-bold text-ink mb-2">Weekly Class Distribution</span>
                    <div className="flex-1 flex items-end gap-2 pt-4">
                      <div className="w-full bg-action-blue/10 rounded-t h-[40%] flex justify-center text-[8px] text-action-blue font-semibold">Mon</div>
                      <div className="w-full bg-action-blue/20 rounded-t h-[65%] flex justify-center text-[8px] text-action-blue font-semibold">Tue</div>
                      <div className="w-full bg-action-blue rounded-t h-[90%] flex justify-center text-[8px] text-white font-semibold">Wed</div>
                      <div className="w-full bg-action-blue/50 rounded-t h-[75%] flex justify-center text-[8px] text-white font-semibold">Thu</div>
                      <div className="w-full bg-action-blue/15 rounded-t h-[30%] flex justify-center text-[8px] text-action-blue font-semibold">Fri</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Capabilities Section (Apple Dark Tile Canvas: Near-Black) */}
        <section id="features" className="w-full py-24 bg-surface-tile-1 text-white flex flex-col items-center">
          <div className="max-w-6xl px-6 w-full flex flex-col items-center">
            <span className="text-xs uppercase text-sky-blue tracking-widest font-semibold mb-3">Architected for Scale</span>
            
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-center mb-4 max-w-2xl">
              Platform Capabilities
            </h2>
            
            <p className="text-base text-[#cccccc] font-normal leading-relaxed text-center mb-16 max-w-md">
              Built for speed, security, and simplicity. Discover how INCA transforms institutional workflows.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              {/* Card 1 */}
              <div className="bg-surface-tile-2 border border-[#333333] p-6 rounded-[18px] flex flex-col justify-between hover:border-[#444446] transition-all group">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-sky-blue/10 flex items-center justify-center mb-6">
                    <LayoutDashboard className="h-5 w-5 text-sky-blue" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight mb-2 text-white">Unified Dashboard</h3>
                  <p className="text-xs text-[#cccccc] leading-relaxed mb-6">
                    Role-based interfaces tailored for Super Admins, Faculty, Coordinators, and Students.
                  </p>
                </div>
                <a href="/login" className="text-xs text-sky-blue font-medium flex items-center group-hover:underline cursor-pointer">
                  Learn more <ChevronRight className="h-3 w-3 ml-0.5" />
                </a>
              </div>

              {/* Card 2 */}
              <div className="bg-surface-tile-2 border border-[#333333] p-6 rounded-[18px] flex flex-col justify-between hover:border-[#444446] transition-all group">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-sky-blue/10 flex items-center justify-center mb-6">
                    <Clock className="h-5 w-5 text-sky-blue" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight mb-2 text-white">Smart Scheduling</h3>
                  <p className="text-xs text-[#cccccc] leading-relaxed mb-6">
                    Conflict-free timetable generation and dynamic schedule adjustments.
                  </p>
                </div>
                <a href="/login" className="text-xs text-sky-blue font-medium flex items-center group-hover:underline cursor-pointer">
                  Learn more <ChevronRight className="h-3 w-3 ml-0.5" />
                </a>
              </div>

              {/* Card 3 */}
              <div className="bg-surface-tile-2 border border-[#333333] p-6 rounded-[18px] flex flex-col justify-between hover:border-[#444446] transition-all group">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-sky-blue/10 flex items-center justify-center mb-6">
                    <Users className="h-5 w-5 text-sky-blue" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight mb-2 text-white">Attendance Tracking</h3>
                  <p className="text-xs text-[#cccccc] leading-relaxed mb-6">
                    Seamless session attendance with robust audit trails and automated alerts.
                  </p>
                </div>
                <a href="/login" className="text-xs text-sky-blue font-medium flex items-center group-hover:underline cursor-pointer">
                  Learn more <ChevronRight className="h-3 w-3 ml-0.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Additional Capabilities (Apple Parchment Tile Canvas: Off-White) */}
        <section id="solutions" className="w-full py-24 bg-canvas-parchment flex flex-col items-center">
          <div className="max-w-6xl px-6 w-full flex flex-col items-center">
            <span className="text-xs uppercase text-action-blue tracking-widest font-semibold mb-3">Enterprise Ready</span>
            
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-ink text-center mb-16 max-w-xl">
              Solutions for every level of administration.
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
              <div className="bg-white border border-[#e0e0e0] p-8 rounded-[18px] flex gap-4">
                <div className="w-10 h-10 rounded-full bg-action-blue/10 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-action-blue" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink mb-1.5">Academic Master Controls</h3>
                  <p className="text-xs text-[#86868b] leading-relaxed">
                    Set up complex curricula, courses, departments, sections, and classroom capacities with hierarchical validations.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-[#e0e0e0] p-8 rounded-[18px] flex gap-4">
                <div className="w-10 h-10 rounded-full bg-action-blue/10 flex items-center justify-center shrink-0">
                  <Settings2 className="h-5 w-5 text-action-blue" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink mb-1.5">Configuration Engine</h3>
                  <p className="text-xs text-[#86868b] leading-relaxed">
                    Define active academic periods, configure 24-hour edit thresholds for attendance, and set custom policy restrictions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 6. Footer (Apple Style: Parchment Canvas, Muted Ink, 2.41 Line Height Links) */}
      <footer id="about" className="bg-canvas-parchment border-t border-[#e0e0e0] pt-16 pb-12 text-[#7a7a7a]">
        <div className="max-w-6xl px-6 mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-center gap-2 text-ink">
              <ShieldCheck className="h-5 w-5 text-ink" />
              <span className="font-bold">INCA</span>
            </div>
            <p className="text-xs text-[#86868b] leading-relaxed">
              Intelligent Campus Automation & Assistant Platform. Optimized for performance and design clarity.
            </p>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-ink mb-3 tracking-wider uppercase">Product</h3>
            <ul className="text-xs leading-[2.41] font-normal">
              <li><a href="#" className="hover:text-ink transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-ink mb-3 tracking-wider uppercase">Company</h3>
            <ul className="text-xs leading-[2.41] font-normal">
              <li><a href="#" className="hover:text-ink transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-ink mb-3 tracking-wider uppercase">Resources</h3>
            <ul className="text-xs leading-[2.41] font-normal">
              <li><a href="#" className="hover:text-ink transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Status</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl px-6 mx-auto mt-16 pt-8 border-t border-[#e0e0e0] flex flex-col md:flex-row justify-between items-center text-[10px] tracking-tight">
          <span>&copy; {new Date().getFullYear()} INCA Platform. All rights reserved.</span>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="hover:underline">Privacy Policy</a>
            <span>|</span>
            <a href="#" className="hover:underline">Terms of Use</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
