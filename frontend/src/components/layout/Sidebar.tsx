import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  CheckSquare,
  BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
}

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role?.code;

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      label: 'Academic Master',
      path: '/academic',
      icon: <Building2 className="w-4 h-4" />,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HOD'],
    },
    {
      label: 'Timetables & Schedules',
      path: '/schedules',
      icon: <Calendar className="w-4 h-4" />,
      roles: ['SUPER_ADMIN', 'ADMIN', 'HOD', 'FACULTY'],
    },
    {
      label: 'Today\'s Schedule',
      path: '/today-schedule',
      icon: <Clock className="w-4 h-4" />,
      roles: ['FACULTY', 'STUDENT'],
    },
    {
      label: 'Activities',
      path: '/activities',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      label: 'Take Attendance',
      path: '/attendance/mark',
      icon: <CheckSquare className="w-4 h-4" />,
      roles: ['ADMIN', 'HOD', 'FACULTY', 'COORDINATOR'],
    },
    {
      label: 'Reports & Analytics',
      path: '/reports',
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  const filteredItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <aside className="w-64 glass-panel border-r border-white/10 hidden md:flex flex-col py-6 px-3 gap-1 min-h-[calc(100vh-65px)]">
      <div className="px-3 pb-3 mb-2 border-b border-slate-800 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        Navigation Menu
      </div>
      {filteredItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200',
              isActive
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10 font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
            )
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </aside>
  );
};
