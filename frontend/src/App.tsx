import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AcademicPage = lazy(() => import('./pages/academic/AcademicPage').then((m) => ({ default: m.AcademicPage })));
const SchedulingPage = lazy(() => import('./pages/scheduling/SchedulingPage').then((m) => ({ default: m.SchedulingPage })));
const ActivitiesPage = lazy(() => import('./pages/activities/ActivitiesPage').then((m) => ({ default: m.ActivitiesPage })));
const MarkAttendancePage = lazy(() => import('./pages/attendance/MarkAttendancePage').then((m) => ({ default: m.MarkAttendancePage })));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const TimetableImportPage = lazy(() => import('./pages/academic/import/TimetableImportPage').then((m) => ({ default: m.TimetableImportPage })));
const FeatureHub = lazy(() => import('./pages/dashboard/FeatureHub').then((m) => ({ default: m.FeatureHub })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes default staleTime for metadata
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
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
                  <Route path="/reports" element={<ReportsPage />} />

                  {/* Take Attendance - FACULTY, HOD, COORDINATOR, ADMIN only (SUPER_ADMIN blocked) */}
                  <Route
                    element={
                      <ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'COORDINATOR', 'ADMIN']} />
                    }
                  >
                    <Route path="/attendance/mark" element={<MarkAttendancePage />} />
                  </Route>

                  {/* Role Protected Master Data Route */}
                  <Route
                    element={
                      <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'HOD']} />
                    }
                  >
                    <Route path="/academic" element={<AcademicPage />} />
                  </Route>

                  {/* Timetable PDF Import - ADMIN and HOD only (SUPER_ADMIN blocked) */}
                  <Route
                    element={
                      <ProtectedRoute allowedRoles={['ADMIN', 'HOD']} />
                    }
                  >
                    <Route path="/academic/timetable-imports" element={<TimetableImportPage />} />
                  </Route>
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/hub" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
