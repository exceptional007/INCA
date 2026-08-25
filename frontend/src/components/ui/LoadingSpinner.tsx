import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
  className = 'py-12',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-slate-400 ${className}`}>
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      {label && <p className="text-sm font-medium tracking-wide">{label}</p>}
    </div>
  );
};
