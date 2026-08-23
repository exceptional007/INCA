import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Calendar, CheckCircle2, Clock, MapPin, Play, AlertCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Today's Overview</h2>
          <p className="text-sm text-muted-foreground">Welcome back! Here's your schedule for today.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Classes Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Scheduled lectures</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Sessions Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">Attendance submitted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Corrections</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Requires review</p>
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary-foreground">Up Next</CardTitle>
            <Clock className="h-4 w-4 text-primary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">11:00 AM</div>
            <p className="text-xs text-primary-foreground/80">Data Structures - Room 204</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>Your upcoming lectures and sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex border rounded-lg overflow-hidden">
                <div className="w-2 bg-success" />
                <div className="p-4 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-lg">09:00 AM - 10:30 AM</span>
                      <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium border border-success/20">Completed</span>
                    </div>
                    <p className="font-medium">Database Management Systems</p>
                    <div className="flex items-center text-sm text-muted-foreground mt-1 gap-4">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> CS Batch 2024 A</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Room 101</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled>Submitted</Button>
                </div>
              </div>

              <div className="flex border rounded-lg overflow-hidden ring-1 ring-ring">
                <div className="w-2 bg-primary" />
                <div className="p-4 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-lg">11:00 AM - 12:30 PM</span>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">Up Next</span>
                    </div>
                    <p className="font-medium">Data Structures</p>
                    <div className="flex items-center text-sm text-muted-foreground mt-1 gap-4">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> CS Batch 2024 B</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Room 204</span>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/attendance/mark')} className="gap-2">
                    <Play className="w-4 h-4" /> Start Session
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Correction Requests</CardTitle>
            <CardDescription>Student appeals for attendance correction.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded-md p-3">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium">John Doe (1042)</span>
                  <span className="text-xs text-muted-foreground">Yesterday</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  "I was marked absent in DBMS but I was present in the back row."
                </p>
                <div className="flex gap-2">
                  <Button variant="default" size="sm" className="w-full">Approve</Button>
                  <Button variant="outline" size="sm" className="w-full">Reject</Button>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" className="w-full text-sm">View All Requests</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
