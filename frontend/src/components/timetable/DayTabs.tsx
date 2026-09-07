import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

interface DayTabsProps {
  activeDay: DayOfWeek;
  onDayChange: (day: DayOfWeek) => void;
  lectureCounts: Record<DayOfWeek, number>;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DayTabs: React.FC<DayTabsProps> = ({
  activeDay,
  onDayChange,
  lectureCounts,
}) => {
  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          {activeDay}'s Schedule
        </h2>
        <Badge variant="secondary" className="font-medium text-xs px-2.5 py-1">
          {lectureCounts[activeDay] || 0} scheduled lectures configured
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-muted/60 rounded-xl border border-border">
        {DAYS.map((day) => {
          const isActive = day === activeDay;
          const count = lectureCounts[day] || 0;
          return (
            <button
              key={day}
              onClick={() => onDayChange(day)}
              className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <span>{day}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
