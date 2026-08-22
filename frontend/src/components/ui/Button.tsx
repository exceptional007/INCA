import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm cursor-pointer';

  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white focus:ring-indigo-500 shadow-indigo-500/25 shadow-md',
    secondary:
      'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 focus:ring-slate-500',
    danger:
      'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white focus:ring-rose-500 shadow-rose-500/25 shadow-md',
    success:
      'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white focus:ring-emerald-500 shadow-emerald-500/25 shadow-md',
    ghost:
      'bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-100 focus:ring-slate-500 shadow-none',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  return (
    <button
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon ? <span>{icon}</span> : null}
      {children}
    </button>
  );
};
