import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  ChevronRight, 
  MessageSquare, 
  Search as SearchIcon, 
  BarChart3, 
  Award, 
  PieChart, 
  Map, 
  Leaf,
  Sparkles
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
            <a href="#features" className="hover:text-white transition-colors">Flagship Features</a>
            <a href="#utility-grid" className="hover:text-white transition-colors">Core Modules</a>
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
              className="text-[12px] bg-[#1d1d1f] hover:bg-[#333333] border border-[#333333] text-white font-medium px-3.5 py-1 rounded-[8px] active:scale-95 transition-all cursor-pointer"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* 2. Sub-Navigation Bar (Apple Style: Sticky, Frosted Glass, Parchment) */}
      <div className="h-[52px] w-full bg-canvas-parchment/80 backdrop-blur-md border-b border-[#e0e0e0] flex items-center sticky top-[44px] z-40">
        <div className="flex items-center justify-between px-6 max-w-7xl mx-auto w-full">
          <span className="text-[20px] font-semibold tracking-tight text-ink">Intelligent Campus Assistant</span>
          <div className="flex items-center gap-4">
            <a href="#overview" className="text-xs text-ink-muted-80 hover:text-action-blue transition-colors">Overview</a>
            <a href="#features" className="text-xs text-ink-muted-80 hover:text-action-blue transition-colors">Features</a>
            <Button size="sm" onClick={() => navigate('/login')} className="bg-action-blue hover:opacity-95 text-white">
              Access Platform
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1">
        {/* 3. Hero Section (Canvas, Typography-First) */}
        <section id="overview" className="w-full pt-20 pb-28 bg-background flex flex-col items-center border-b border-[#e0e0e0]">
          <div className="max-w-4xl px-6 text-center flex flex-col items-center">
            <span className="text-xs uppercase text-action-blue tracking-widest font-semibold mb-4">Comprehensive Campus Solution</span>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-ink leading-[1.07] mb-6">
              <span className="text-action-blue">Everything You Need</span> <br />
              <span className="text-ink">In One Smart App</span>
            </h1>
            
            <p className="max-w-[680px] text-lg sm:text-xl text-[#86868b] font-normal leading-relaxed mb-8">
              From AI-powered academics to campus life management — discover how our intelligent features transform your university experience.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Button size="lg" className="bg-action-blue text-white group" onClick={() => navigate('/login')}>
                Get Started
                <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" className="border-action-blue text-action-blue hover:bg-action-blue/5">
                View Documentation
              </Button>
            </div>
          </div>

          {/* Platform Mockup resting on surface with shadow */}
          <div className="w-full max-w-5xl px-6">
            <div className="w-full aspect-[16/9] bg-canvas-parchment rounded-[18px] border border-[#e0e0e0] shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-4 md:p-6 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-[#e0e0e0] mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                  <span className="text-xs font-semibold text-ink-muted-80 ml-2">INCA Hub</span>
                </div>
                <div className="h-6 w-24 rounded-full bg-white border border-[#e0e0e0]" />
              </div>
              <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
                <div className="bg-white border border-[#e0e0e0] p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-action-blue font-bold uppercase tracking-wide">ASSAM</span>
                    <h3 className="text-sm font-semibold text-ink mt-1">Smart Attendance</h3>
                    <p className="text-[11px] text-[#86868b] mt-1">Conflict-free timetables & real-time roster marking.</p>
                  </div>
                  <div className="h-6 w-16 bg-action-blue/10 text-action-blue text-[10px] font-semibold flex items-center justify-center rounded-full mt-4">Active</div>
                </div>
                <div className="bg-white border border-[#e0e0e0] p-4 rounded-xl flex flex-col justify-between opacity-80">
                  <div>
                    <span className="text-[10px] text-[#86868b] font-bold uppercase tracking-wide">TUTOR</span>
                    <h3 className="text-sm font-semibold text-ink mt-1">AI Notes & Tutor</h3>
                    <p className="text-[11px] text-[#86868b] mt-1">Automated transcripts, quiz generation & smart search.</p>
                  </div>
                  <div className="h-6 w-24 bg-canvas-parchment text-ink-muted-80 text-[10px] font-semibold flex items-center justify-center rounded-full mt-4">Coming Soon</div>
                </div>
                <div className="bg-white border border-[#e0e0e0] p-4 rounded-xl flex flex-col justify-between opacity-80">
                  <div>
                    <span className="text-[10px] text-[#86868b] font-bold uppercase tracking-wide">STORE</span>
                    <h3 className="text-sm font-semibold text-ink mt-1">Marketplace</h3>
                    <p className="text-[11px] text-[#86868b] mt-1">Peer-to-peer student marketplace for local exchanges.</p>
                  </div>
                  <div className="h-6 w-24 bg-canvas-parchment text-ink-muted-80 text-[10px] font-semibold flex items-center justify-center rounded-full mt-4">Coming Soon</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Flagship Features (Alternating Tiles) */}
        <section id="features" className="w-full flex flex-col">
          {/* Tile 1: Smart Attendance System (Light Tile) */}
          <div className="w-full py-24 bg-white flex flex-col items-center border-b border-[#e0e0e0]">
            <div className="max-w-4xl px-6 w-full text-center flex flex-col items-center">
              <span className="text-xs uppercase text-action-blue tracking-widest font-semibold mb-3">Core Module</span>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink mb-4">Smart Attendance System</h2>
              <p className="text-base text-ink-muted-80 max-w-xl mb-6">
                Say goodbye to manual registers. Generate conflict-free schedules, log classroom check-ins in seconds, and track real-time attendance thresholds.
              </p>
              <Button onClick={() => navigate('/login')} className="bg-action-blue text-white rounded-full mb-12">Learn More</Button>
              
              <div className="w-full max-w-2xl aspect-[16/10] bg-canvas-parchment border border-[#e0e0e0] rounded-xl shadow-[0_15px_35px_rgba(0,0,0,0.08)] p-6 overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-xs font-bold text-ink">Active Session: CS-301 Computer Networks</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">In Progress</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-6 py-4">
                  <div className="text-center">
                    <span className="text-4xl font-extrabold text-action-blue">42</span>
                    <p className="text-[10px] text-[#86868b] font-medium uppercase mt-1">Students Present</p>
                  </div>
                  <div className="h-12 w-px bg-[#e0e0e0]" />
                  <div className="text-center">
                    <span className="text-4xl font-extrabold text-ink">45</span>
                    <p className="text-[10px] text-[#86868b] font-medium uppercase mt-1">Total Enrolled</p>
                  </div>
                </div>
                <div className="flex justify-center gap-2">
                  <div className="h-6 w-20 rounded-full bg-action-blue text-white text-[10px] flex items-center justify-center font-medium">Verify Roster</div>
                  <div className="h-6 w-20 rounded-full bg-white border text-ink text-[10px] flex items-center justify-center font-medium">Export Log</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tile 2: AI Notes & Tutor (Dark Tile) */}
          <div className="w-full py-24 bg-surface-tile-1 text-white flex flex-col items-center border-b border-[#333333]">
            <div className="max-w-4xl px-6 w-full text-center flex flex-col items-center">
              <span className="text-xs uppercase text-sky-blue tracking-widest font-semibold mb-3">AI Engine</span>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">AI Notes & Tutor</h2>
              <p className="text-base text-body-muted max-w-xl mb-6">
                Convert lectures to organized study guides automatically. Ask questions to your classroom AI assistant and generate summary quizzes dynamically.
              </p>
              <Button onClick={() => navigate('/login')} className="bg-[#2997ff] text-white rounded-full mb-12">Learn More</Button>
              
              <div className="w-full max-w-2xl bg-surface-tile-2 border border-[#333333] rounded-xl shadow-[0_15px_35px_rgba(0,0,0,0.22)] p-6 overflow-hidden flex flex-col text-left">
                <div className="flex items-center gap-2 pb-4 border-b border-[#333333] mb-4">
                  <Sparkles className="h-4 w-4 text-sky-blue" />
                  <span className="text-xs font-semibold">Tutor AI Transcript Assistant</span>
                </div>
                <div className="space-y-3 flex-1 text-xs">
                  <p className="text-[#a1a1a6]"><strong className="text-white">AI Summary:</strong> Today's class focused on the TCP/IP handshake protocol...</p>
                  <div className="bg-surface-tile-3 p-3 rounded-lg border border-[#333333] space-y-2">
                    <p className="font-semibold">Practice Question:</p>
                    <p className="text-[#a1a1a6]">What flag sequence marks the initial client handshake?</p>
                    <div className="flex gap-2 pt-1">
                      <span className="px-2.5 py-1 rounded bg-[#333] text-white cursor-pointer hover:bg-[#444]">SYN</span>
                      <span className="px-2.5 py-1 rounded bg-[#333] text-white cursor-pointer hover:bg-[#444]">ACK</span>
                      <span className="px-2.5 py-1 rounded bg-[#333] text-[#777]">SYN-ACK</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tile 3: Smart Timetable & Events (Parchment Tile) */}
          <div className="w-full py-24 bg-canvas-parchment flex flex-col items-center border-b border-[#e0e0e0]">
            <div className="max-w-4xl px-6 w-full text-center flex flex-col items-center">
              <span className="text-xs uppercase text-action-blue tracking-widest font-semibold mb-3">Event Hub</span>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink mb-4">Smart Timetable & Events</h2>
              <p className="text-base text-ink-muted-80 max-w-xl mb-6">
                Receive real-time schedule conflict resolutions, automatic makeup classes listings, and university announcement integrations.
              </p>
              <Button onClick={() => navigate('/login')} className="bg-action-blue text-white rounded-full mb-12">Learn More</Button>
              
              <div className="w-full max-w-2xl bg-white border border-[#e0e0e0] rounded-xl shadow-[0_15px_35px_rgba(0,0,0,0.06)] p-6 overflow-hidden flex flex-col text-left">
                <div className="flex items-center justify-between pb-3 border-b mb-3">
                  <span className="text-xs font-bold text-ink">Today's Conflicts Detected</span>
                  <Badge className="bg-amber-100 text-amber-800 border-none text-[9px]">Resolved</Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-amber-950">Room Clash (Room-302)</p>
                      <p className="text-[10px] text-amber-800">Advanced Networks (Prof. Roy) / Mathematics (Dr. Sen)</p>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Rerouted to Room-304</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tile 4: Campus Marketplace (Dark Tile 2) */}
          <div className="w-full py-24 bg-surface-tile-2 text-white flex flex-col items-center border-b border-[#333333]">
            <div className="max-w-4xl px-6 w-full text-center flex flex-col items-center">
              <span className="text-xs uppercase text-sky-blue tracking-widest font-semibold mb-3">Student Hub</span>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">Campus Marketplace</h2>
              <p className="text-base text-body-muted max-w-xl mb-6">
                Buy, sell, or rent textbooks, lab gear, and dorm essentials directly within your verified student network. Safe, peer-to-peer commerce.
              </p>
              <Button onClick={() => navigate('/login')} className="bg-[#2997ff] text-white rounded-full mb-12">Learn More</Button>
              
              <div className="w-full max-w-2xl bg-surface-tile-3 border border-[#444] rounded-xl shadow-[0_15px_35px_rgba(0,0,0,0.18)] p-6 overflow-hidden grid grid-cols-2 gap-4 text-left text-xs">
                <div className="bg-[#333] p-3 rounded-lg border border-[#444]">
                  <div className="aspect-square bg-surface-tile-1 rounded mb-2 flex items-center justify-center text-body-muted">[Book Mockup]</div>
                  <p className="font-semibold text-white">Networking Basics (8th Ed)</p>
                  <p className="text-[#a1a1a6] mt-0.5">$35.00</p>
                </div>
                <div className="bg-[#333] p-3 rounded-lg border border-[#444]">
                  <div className="aspect-square bg-surface-tile-1 rounded mb-2 flex items-center justify-center text-body-muted">[Calculator Mockup]</div>
                  <p className="font-semibold text-white">Scientific Calculator (CASIO)</p>
                  <p className="text-[#a1a1a6] mt-0.5">$18.00</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Utility Grid (Core Modules / Other Platform Features) */}
        <section id="utility-grid" className="w-full py-24 bg-background flex flex-col items-center border-b border-[#e0e0e0]">
          <div className="max-w-6xl px-6 w-full flex flex-col items-center">
            <span className="text-xs uppercase text-action-blue tracking-widest font-semibold mb-3">Core Modules</span>
            <h2 className="text-3xl font-semibold tracking-tight text-ink text-center mb-16">Platform Expansion Suite</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
              {/* Card 1: Notice Board */}
              <div className="border border-[#e0e0e0] bg-white p-6 rounded-[18px] flex flex-col justify-between shadow-none hover:border-[#b9b9bc] transition-all">
                <div>
                  <div className="w-9 h-9 rounded-full bg-action-blue/10 flex items-center justify-center mb-6">
                    <MessageSquare className="h-4.5 w-4.5 text-action-blue" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-1.5">Digital Notice Board</h3>
                  <p className="text-xs text-ink-muted-80 leading-relaxed mb-6">
                    Departmental announcements, scheduling shifts, and official academic notices in a single digital grid.
                  </p>
                </div>
                <span className="text-xs text-action-blue font-semibold uppercase tracking-wide">Communication</span>
              </div>

              {/* Card 2: Lost & Found */}
              <div className="border border-[#e0e0e0] bg-white p-6 rounded-[18px] flex flex-col justify-between shadow-none hover:border-[#b9b9bc] transition-all">
                <div>
                  <div className="w-9 h-9 rounded-full bg-action-blue/10 flex items-center justify-center mb-6">
                    <SearchIcon className="h-4.5 w-4.5 text-action-blue" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-1.5">AI-Powered Lost & Found</h3>
                  <p className="text-xs text-ink-muted-80 leading-relaxed mb-6">
                    Snap a photo of found items. Our smart search matches listings to reports, keeping dorms organized.
                  </p>
                </div>
                <span className="text-xs text-action-blue font-semibold uppercase tracking-wide">Utility</span>
              </div>

              {/* Card 3: Performance Insights */}
              <div className="border border-[#e0e0e0] bg-white p-6 rounded-[18px] flex flex-col justify-between shadow-none hover:border-[#b9b9bc] transition-all">
                <div>
                  <div className="w-9 h-9 rounded-full bg-action-blue/10 flex items-center justify-center mb-6">
                    <BarChart3 className="h-4.5 w-4.5 text-action-blue" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-1.5">Performance Insights</h3>
                  <p className="text-xs text-ink-muted-80 leading-relaxed mb-6">
                    Role-specific analytics mapping course attendance patterns to academic marks performance.
                  </p>
                </div>
                <span className="text-xs text-action-blue font-semibold uppercase tracking-wide">Analytics</span>
              </div>

              {/* Card 4: Gamification */}
              <div className="border border-[#e0e0e0] bg-white p-6 rounded-[18px] flex flex-col justify-between shadow-none hover:border-[#b9b9bc] transition-all">
                <div>
                  <div className="w-9 h-9 rounded-full bg-action-blue/10 flex items-center justify-center mb-6">
                    <Award className="h-4.5 w-4.5 text-action-blue" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-1.5">Gamification & Badges</h3>
                  <p className="text-xs text-ink-muted-80 leading-relaxed mb-6">
                    Incentivize on-time attendance and academic milestones with student badges and profile unlocks.
                  </p>
                </div>
                <span className="text-xs text-action-blue font-semibold uppercase tracking-wide">Engagement</span>
              </div>

              {/* Card 5: Polls */}
              <div className="border border-[#e0e0e0] bg-white p-6 rounded-[18px] flex flex-col justify-between shadow-none hover:border-[#b9b9bc] transition-all">
                <div>
                  <div className="w-9 h-9 rounded-full bg-action-blue/10 flex items-center justify-center mb-6">
                    <PieChart className="h-4.5 w-4.5 text-action-blue" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-1.5">Community Polls</h3>
                  <p className="text-xs text-ink-muted-80 leading-relaxed mb-6">
                    Instantly create campus opinion surveys, student votes, and coordinator feedback boards.
                  </p>
                </div>
                <span className="text-xs text-action-blue font-semibold uppercase tracking-wide">Community</span>
              </div>

              {/* Card 6: AR Navigation */}
              <div className="border border-[#e0e0e0] bg-white p-6 rounded-[18px] flex flex-col justify-between shadow-none hover:border-[#b9b9bc] transition-all opacity-80">
                <div>
                  <div className="w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center mb-6">
                    <Map className="h-4.5 w-4.5 text-ink-muted-80" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-ink mb-1.5">AR Campus Navigation</h3>
                    <span className="text-[9px] bg-canvas-parchment border text-ink font-semibold px-2 py-0.5 rounded-full">Coming Soon</span>
                  </div>
                  <p className="text-xs text-ink-muted-80 leading-relaxed mb-6">
                    Augmented reality routes showing conflict-free walking directions directly to assigned class sections.
                  </p>
                </div>
                <span className="text-xs text-ink-muted-80 font-semibold uppercase tracking-wide">Navigation</span>
              </div>

              {/* Card 7: Green Credits */}
              <div className="border border-[#e0e0e0] bg-white p-6 rounded-[18px] flex flex-col justify-between shadow-none hover:border-[#b9b9bc] transition-all">
                <div>
                  <div className="w-9 h-9 rounded-full bg-action-blue/10 flex items-center justify-center mb-6">
                    <Leaf className="h-4.5 w-4.5 text-action-blue" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-1.5">Green Credits System</h3>
                  <p className="text-xs text-ink-muted-80 leading-relaxed mb-6">
                    Earn credits for eco-friendly campus habits, transit pooling, and sustainability task participations.
                  </p>
                </div>
                <span className="text-xs text-action-blue font-semibold uppercase tracking-wide">Sustainability</span>
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
              Intelligent Campus Assistant Platform. Designed for university administration, lecture scheduling, and student coordination.
            </p>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-ink mb-3 tracking-wider uppercase">Product</h3>
            <ul className="text-xs leading-[2.41] font-normal">
              <li><a href="#" className="hover:text-ink transition-colors">Smart Attendance (ASSAM)</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">AI Notes & Tutor</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Marketplace</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-ink mb-3 tracking-wider uppercase">Company</h3>
            <ul className="text-xs leading-[2.41] font-normal">
              <li><a href="#" className="hover:text-ink transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Contact Support</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-ink mb-3 tracking-wider uppercase">Legal</h3>
            <ul className="text-xs leading-[2.41] font-normal">
              <li><a href="#" className="hover:text-ink transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-ink transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl px-6 mx-auto mt-16 pt-8 border-t border-[#e0e0e0] flex flex-col md:flex-row justify-between items-center text-[10px] tracking-tight">
          <span>&copy; {new Date().getFullYear()} INCA. Intelligent Campus Assistant. All rights reserved.</span>
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
