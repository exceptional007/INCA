import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, LayoutGrid } from 'lucide-react';
import api from '../../api/axios';
import { Skeleton } from '@/components/ui/skeleton';

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic & Co-Curricular Activities</h1>
          <p className="text-sm text-muted-foreground">Workshops, Seminars, Guest Lectures, Placement Drives, and Events</p>
        </div>
      </div>

      {/* Activity Types Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mr-2">
          <LayoutGrid className="w-4 h-4" /> Categories:
        </span>
        {types.length === 0 && !isLoading && (
          <span className="text-sm text-muted-foreground">No categories</span>
        )}
        {types.map((t) => (
          <Badge key={t.id} variant="secondary" className="whitespace-nowrap">
            {t.name}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col h-full">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-1/3 mb-2" />
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent className="flex-1">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground bg-muted/50 flex flex-col items-center">
          <Calendar className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg text-foreground">No activities scheduled</h3>
          <p className="text-sm mt-1">There are currently no upcoming activities or events.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map((a) => (
            <Card key={a.id} className="flex flex-col h-full border-l-4 border-l-primary hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{a.activityType?.name || 'Event'}</Badge>
                  <Badge variant={a.attendanceRequired ? 'destructive' : 'secondary'} className="text-[10px]">
                    {a.attendanceRequired ? 'Mandatory' : 'Optional'}
                  </Badge>
                </div>
                <CardTitle className="text-lg leading-tight">{a.title}</CardTitle>
                {a.description && <CardDescription className="line-clamp-2">{a.description}</CardDescription>}
              </CardHeader>
              
              <CardContent className="flex-1" />
              
              <CardFooter className="pt-4 border-t bg-muted/20">
                <div className="grid grid-cols-2 gap-y-3 w-full text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(a.startTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{a.room?.name || 'Main Auditorium'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{a.faculty?.firstName || 'Coordinator'}</span>
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
