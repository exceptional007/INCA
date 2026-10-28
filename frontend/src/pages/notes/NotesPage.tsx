import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FacultyNotesView } from './components/FacultyNotesView';
import { StudentNotesView } from './components/StudentNotesView';
import { Sparkles, Users, GraduationCap } from 'lucide-react';

export const NotesPage: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role?.code;

  const isStaff = ['SUPER_ADMIN', 'ADMIN', 'HOD', 'COORDINATOR', 'FACULTY'].includes(role || '');
  const [viewMode, setViewMode] = useState<'FACULTY' | 'STUDENT'>(() => (isStaff ? 'FACULTY' : 'STUDENT'));

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Bar with Title and Role Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
              <Sparkles className="size-4.5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              AI Notes & Tutor
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Subject-oriented learning space with verified course materials, interactive AI tutoring, and quizzes
          </p>
        </div>

        {/* View Switcher for Faculty & Admin users */}
        {isStaff && (
          <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/60 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('FACULTY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'FACULTY'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="size-3.5" />
              Faculty Workspace
            </button>
            <button
              type="button"
              onClick={() => setViewMode('STUDENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'STUDENT'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GraduationCap className="size-3.5" />
              Student Library View
            </button>
          </div>
        )}
      </div>

      {/* Render View */}
      {viewMode === 'FACULTY' && isStaff ? <FacultyNotesView /> : <StudentNotesView />}
    </div>
  );
};

export default NotesPage;
