import React from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'indigo';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className,
  dot = true,
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    neutral: 'bg-slate-700/30 text-slate-300 border-slate-700/50',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };

  const dotStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    neutral: 'bg-slate-400',
    indigo: 'bg-indigo-400',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border backdrop-blur-sm transition-all duration-200',
        variantStyles[variant],
        className
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full animate-pulse', dotStyles[variant])} />}
      {children}
    </span>
  );
};
