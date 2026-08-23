import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { CoordinatorDashboard } from './components/CoordinatorDashboard';
import { FacultyDashboard } from './components/FacultyDashboard';
import { StudentDashboard } from './components/StudentDashboard';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role?.code;

  switch (role) {
    case 'SUPER_ADMIN':
      return <SuperAdminDashboard />;
    case 'ADMIN':
    case 'HOD':
      return <AdminDashboard />;
    case 'COORDINATOR':
      return <CoordinatorDashboard />;
    case 'FACULTY':
      return <FacultyDashboard />;
    case 'STUDENT':
      return <StudentDashboard />;
    default:
      // Fallback for unknown role
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome to INCA</h2>
          <p className="text-muted-foreground">Your account doesn't have an assigned dashboard layout yet.</p>
        </div>
      );
  }
};
