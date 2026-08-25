import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/badge';
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
    <header className="sticky top-0 z-30 w-full bg-canvas-parchment/80 backdrop-blur-md border-b border-[#e0e0e0] px-6 py-3.5 flex items-center justify-between font-sans">
      {/* Brand logo (Apple style: Minimal, flat, no shadows or heavy gradients) */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-action-blue flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight text-ink flex items-center gap-2">
            INCA 
            <span className="text-[10px] font-bold text-action-blue px-2 py-0.5 rounded-full bg-action-blue/10 border border-action-blue/10">
              ASSAM
            </span>
          </h1>
          <p className="text-[10px] text-ink-muted-48 hidden sm:block mt-0.5">Campus Automation & Attendance</p>
        </div>
      </div>

      {/* User Actions (Apple style: clean pill layout, minimal borders) */}
      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white border border-[#e0e0e0]">
            <div className="w-6 h-6 rounded-full bg-action-blue/10 flex items-center justify-center text-action-blue">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-ink max-w-[140px] truncate leading-none">
                {user.email}
              </span>
              <div className="mt-1">
                 <Badge variant={getRoleVariant(user.role?.code) as any} className="text-[9px] px-1.5 py-0">
                  {user.role?.name || user.role?.code}
                </Badge>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Logout"
            className="p-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100/50 hover:border-rose-200 transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};
