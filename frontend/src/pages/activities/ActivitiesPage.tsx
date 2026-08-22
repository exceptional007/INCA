import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import api from '../../api/axios';

export const ActivitiesPage: React.FC = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [actRes, typeRes] = await Promise.all([
        api.get('/activities'),
        api.get('/activities/types'),
      ]);
      setActivities(actRes.data.data || []);
      setTypes(typeRes.data.data || []);
    } catch (err) {
      console.error('Error fetching activities', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Academic & Co-Curricular Activities</h1>
        <p className="text-sm text-slate-400">Workshops, Seminars, Guest Lectures, Placement Drives, and Events</p>
      </div>

      {/* Activity Types Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="text-xs text-slate-400 font-medium mr-1">Categories:</span>
        {types.map((t) => (
          <Badge key={t.id} variant="indigo" dot={false}>
            {t.name}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading activities..." />
      ) : activities.length === 0 ? (
        <Card className="p-12 text-center text-slate-400 text-sm">
          No activities created yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activities.map((a) => (
            <Card key={a.id} hoverable className="space-y-3 border-l-4 border-l-indigo-500">
              <div className="flex items-center justify-between">
                <Badge variant="indigo">{a.activityType?.name || 'Event'}</Badge>
                <Badge variant={a.attendanceRequired ? 'danger' : 'neutral'}>
                  {a.attendanceRequired ? 'Attendance Mandatory' : 'Optional'}
                </Badge>
              </div>

              <div>
                <h3 className="font-bold text-base text-white">{a.title}</h3>
                {a.description && <p className="text-xs text-slate-400 mt-1">{a.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{new Date(a.startTime).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>{new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>{a.room?.name || 'Main Auditorium'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{a.faculty?.firstName || 'Coordinator'}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
