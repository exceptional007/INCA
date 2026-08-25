import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  ShieldCheck, 
  User as UserIcon, 
  LogOut, 
  Clock, 
  Sparkles, 
  DollarSign, 
  MessageSquare, 
  PieChart, 
  Leaf 
} from 'lucide-react';

export const FeatureHub: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleModuleClick = (active: boolean, url: string) => {
    if (active) {
      navigate(url);
    }
  };

  const modules = [
    {
      id: 'assam',
      name: 'Smart Attendance (ASSAM)',
      description: 'Conflict-free scheduling, automated check-ins, and multi-role workflows.',
      icon: Clock,
      active: true,
      badge: 'Active',
      url: '/dashboard', // Routes to the ASSAM dashboard
    },
    {
      id: 'tutor',
      name: 'AI Notes & Tutor',
      description: 'Automated study transcripts, summary generation, and interactive chat tutoring.',
      icon: Sparkles,
      active: false,
      badge: 'Coming Soon',
      url: '#',
    },
    {
      id: 'marketplace',
      name: 'Campus Marketplace',
      description: 'Exchange books, dorm items, and equipment with verified student peers.',
      icon: DollarSign,
      active: false,
      badge: 'Coming Soon',
      url: '#',
    },
    {
      id: 'noticeboard',
      name: 'Digital Notice Board',
      description: 'Real-time department updates, central announcements, and notices board.',
      icon: MessageSquare,
      active: false,
      badge: 'Coming Soon',
      url: '#',
    },
    {
      id: 'polls',
      name: 'Community Polls',
      description: 'Institutional decision voting, academic surveys, and campus feedback boards.',
      icon: PieChart,
      active: false,
      badge: 'Coming Soon',
      url: '#',
    },
    {
      id: 'sustainability',
      name: 'Green Credits System',
      description: 'Log ecological activities, transit pools, and earn campus credits.',
      icon: Leaf,
      active: false,
      badge: 'Coming Soon',
      url: '#',
    },
  ];

  return (
    <div className="min-h-screen bg-canvas-parchment flex flex-col font-sans select-none">
      {/* Pinned top bar (Apple style: Frosted glass, 52px height) */}
      <header className="h-[52px] bg-white border-b border-[#e0e0e0] flex items-center justify-between px-6 z-30 sticky top-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/hub')}>
            <div className="w-8 h-8 rounded-full bg-action-blue flex items-center justify-center">
              <ShieldCheck className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-[16px] font-semibold tracking-tight text-ink">INCA Assistant</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted-80 font-medium hidden sm:inline-block">
              {user?.email}
            </span>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 rounded-full border border-[#e0e0e0] cursor-pointer hover:opacity-90 active:scale-95 transition-all">
                  <AvatarFallback className="rounded-full bg-canvas-parchment text-ink font-semibold text-xs">
                    {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-[11px] mt-1 shadow-none border border-[#e0e0e0] bg-white font-sans" align="end">
                <DropdownMenuLabel className="p-3 text-left">
                  <p className="text-xs font-semibold text-ink leading-none">{user?.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-ink-muted-48 mt-1.5">{user?.role?.name || user?.role?.code}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#f0f0f0]" />
                <DropdownMenuItem 
                  onClick={logout} 
                  className="p-2.5 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer flex items-center gap-2 rounded-[8px]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Hub Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
        <div className="mb-10 text-left">
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">Post-Login Hub</span>
          <h2 className="text-3xl font-semibold tracking-tight text-ink mt-1.5">Select a Platform Module</h2>
          <p className="text-sm text-ink-muted-80 mt-1">Welcome back. Enter the active scheduling module or preview upcoming modules.</p>
        </div>

        {/* Store Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Card 
                key={mod.id}
                className={`bg-white border border-[#e0e0e0] rounded-[18px] shadow-none flex flex-col justify-between p-6 transition-all ${
                  mod.active 
                    ? 'hover:border-[#b9b9bc] cursor-pointer' 
                    : 'opacity-75 cursor-not-allowed'
                }`}
                onClick={() => handleModuleClick(mod.active, mod.url)}
              >
                <CardHeader className="p-0 mb-6">
                  <div className="flex justify-between items-start">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      mod.active ? 'bg-action-blue/10 text-action-blue' : 'bg-canvas-parchment text-ink-muted-48'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      mod.active 
                        ? 'bg-action-blue/10 text-action-blue border-action-blue/10' 
                        : 'bg-canvas-parchment text-ink-muted-48 border-[#e0e0e0]'
                    }`}>
                      {mod.badge}
                    </span>
                  </div>
                  <CardTitle className="text-[17px] font-semibold text-ink mt-6 leading-tight">
                    {mod.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-muted-80 leading-relaxed mt-2.5">
                    {mod.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-0">
                  {mod.active ? (
                    <Button 
                      className="bg-action-blue text-white rounded-full text-xs font-semibold px-4 h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick(mod.active, mod.url);
                      }}
                    >
                      Enter Module
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="border-[#e0e0e0] text-ink-muted-48 rounded-full text-xs font-medium px-4 h-8 cursor-not-allowed"
                      disabled
                    >
                      Locked
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};
export default FeatureHub;
