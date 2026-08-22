import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  const getRoleVariant = (code?: string) => {
    switch (code) {
      case 'SUPER_ADMIN':
        return 'danger';
      case 'ADMIN':
        return 'warning';
      case 'HOD':
        return 'indigo';
      case 'FACULTY':
        return 'info';
      case 'STUDENT':
        return 'success';
      default:
        return 'neutral';
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between">
      {/* Brand logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            INCA <span className="text-xs font-semibold text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">ASSAM</span>
          </h1>
          <p className="text-[10px] text-slate-400 hidden sm:block">Campus Automation & Attendance</p>
        </div>
      </div>

      {/* User Actions */}
      {user && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl glass-panel">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-semibold text-xs">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 max-w-[140px] truncate">
                {user.email}
              </span>
              <div className="mt-0.5">
                <Badge variant={getRoleVariant(user.role?.code)} dot={false}>
                  {user.role?.name || user.role?.code}
                </Badge>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Logout"
            className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};
