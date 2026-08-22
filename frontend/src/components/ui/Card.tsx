import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'glass-card rounded-2xl p-5 transition-all duration-300',
        hoverable && 'hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-indigo-500/10 hover:shadow-xl cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
