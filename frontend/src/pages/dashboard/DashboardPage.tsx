import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role?.code;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="relative glass-card rounded-3xl p-6 sm:p-8 overflow-hidden border border-indigo-500/20">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="indigo">Welcome Back</Badge>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Hello, {user?.email.split('@')[0]} 👋
          </h1>
          <p className="text-sm text-slate-300 max-w-xl">
            {role === 'ADMIN' || role === 'SUPER_ADMIN'
              ? 'Manage departments, programs, schedules, and monitor institutional attendance analytics.'
              : role === 'FACULTY' || role === 'HOD'
              ? 'View today\'s assigned lectures, open attendance sessions, and handle student corrections.'
              : 'Track your overall attendance percentage, view timetable schedules, and check shortfall alerts.'}
          </p>
        </div>
      </div>

      {/* Stats Widgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {role === 'STUDENT' ? (
          <>
            <Card hoverable className="space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Overall Attendance</span>
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-emerald-400">85.4%</div>
              <p className="text-xs text-slate-400">Above required 75% threshold</p>
            </Card>

            <Card hoverable className="space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Classes Attended</span>
                <CheckCircle2 className="w-5 h-5 text-sky-400" />
              </div>
              <div className="text-3xl font-bold text-white">41 / 48</div>
              <p className="text-xs text-slate-400">Current Semester</p>
            </Card>

            <Card hoverable className="space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Today's Lectures</span>
                <Calendar className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-3xl font-bold text-white">3</div>
              <p className="text-xs text-slate-400">Scheduled for today</p>
            </Card>

            <Card hoverable className="space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Shortfall Warning</span>
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-amber-400">0 Subjects</div>
              <p className="text-xs text-slate-400">All subjects above 75%</p>
            </Card>
          </>
        ) : (
          <>
            <Card hoverable className="space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Today's Classes</span>
                <Clock className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-3xl font-bold text-white">4</div>
              <p className="text-xs text-slate-400">Active timetable slots</p>
            </Card>

            <Card hoverable className="space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Completed Sessions</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-emerald-400">2</div>
              <p className="text-xs text-slate-400">Attendance submitted</p>
            </Card>

            <Card hoverable className="space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Faculty</span>
                <Users className="w-5 h-5 text-sky-400" />
              </div>
              <div className="text-3xl font-bold text-white">18</div>
              <p className="text-xs text-slate-400">On campus today</p>
            </Card>

            <Card hoverable className="space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Upcoming Activities</span>
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-amber-400">2</div>
              <p className="text-xs text-slate-400">Workshops & Seminars</p>
            </Card>
          </>
        )}
      </div>

      {/* Quick Action Navigation Bar */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-slate-200 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(role === 'FACULTY' || role === 'HOD' || role === 'ADMIN' || role === 'SUPER_ADMIN') && (
            <Button
              variant="primary"
              size="lg"
              className="justify-between"
              onClick={() => navigate('/attendance/mark')}
              icon={<CheckCircle2 className="w-5 h-5" />}
            >
              <span>Take Attendance</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          <Button
            variant="secondary"
            size="lg"
            className="justify-between"
            onClick={() => navigate('/schedules')}
            icon={<Calendar className="w-5 h-5" />}
          >
            <span>Timetables & Schedules</span>
            <ArrowRight className="w-4 h-4" />
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="justify-between"
            onClick={() => navigate('/reports')}
            icon={<TrendingUp className="w-5 h-5" />}
          >
            <span>Reports & Analytics</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};
