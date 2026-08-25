import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AcademicPage } from './pages/academic/AcademicPage';
import { SchedulingPage } from './pages/scheduling/SchedulingPage';
import { ActivitiesPage } from './pages/activities/ActivitiesPage';
import { MarkAttendancePage } from './pages/attendance/MarkAttendancePage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { TimetableImportPage } from './pages/academic/import/TimetableImportPage';
import { FeatureHub } from './pages/dashboard/FeatureHub';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/hub" element={<FeatureHub />} />

              {/* ASSAM Module routes inside AppLayout */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/schedules" element={<SchedulingPage />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/attendance/mark" element={<MarkAttendancePage />} />
                <Route path="/reports" element={<ReportsPage />} />

                {/* Role Protected Master Data Route */}
                <Route
                  element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'HOD']} />
                  }
                >
                  <Route path="/academic" element={<AcademicPage />} />
                  <Route path="/academic/timetable-imports" element={<TimetableImportPage />} />
                </Route>
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/hub" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
