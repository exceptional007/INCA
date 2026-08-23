import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, CheckCircle2, Calendar, AlertTriangle, MapPin, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const StudentDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Dashboard</h2>
          <p className="text-sm text-muted-foreground">Track your attendance and daily schedule.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary-foreground">Overall Attendance</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">85.4%</div>
            <p className="text-xs text-primary-foreground/80">Above required 75% threshold</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Classes Attended</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">41 / 48</div>
            <p className="text-xs text-muted-foreground">Current Semester</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Today's Lectures</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Scheduled for today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Shortfall Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">All subjects above 75%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>My Schedule Today</CardTitle>
            <CardDescription>Your upcoming classes and timings.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex relative pl-6 border-l-2 border-muted-foreground pb-6 last:pb-0">
                <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-success" />
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">09:00 AM</span>
                      <Badge variant="outline" className="text-success border-success/30 bg-success/10">Attended</Badge>
                    </div>
                    <p className="font-medium">Database Management Systems</p>
                    <div className="flex items-center text-sm text-muted-foreground mt-1 gap-4">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Room 101</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex relative pl-6 border-l-2 border-primary pb-6 last:pb-0">
                <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-primary ring-4 ring-background" />
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">11:00 AM</span>
                      <Badge variant="default">Up Next</Badge>
                    </div>
                    <p className="font-medium">Data Structures</p>
                    <div className="flex items-center text-sm text-muted-foreground mt-1 gap-4">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Room 204</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex relative pl-6 border-l-2 border-transparent pb-0">
                <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full border-2 border-muted-foreground bg-background" />
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-muted-foreground">02:00 PM</span>
                    </div>
                    <p className="font-medium text-muted-foreground">Operating Systems</p>
                    <div className="flex items-center text-sm text-muted-foreground mt-1 gap-4">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Lab 3</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Notices</CardTitle>
            <CardDescription>Important updates for your batch.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="mt-0.5">
                  <Info className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Extra Class Scheduled</p>
                  <p className="text-xs text-muted-foreground">An extra class for Data Structures is scheduled for this Saturday at 10 AM.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">2 hours ago</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium">Room Change: OS Lab</p>
                  <p className="text-xs text-muted-foreground">Today's Operating Systems Lab is moved to Lab 4.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">5 hours ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
