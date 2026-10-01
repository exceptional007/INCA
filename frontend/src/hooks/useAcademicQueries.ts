import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

// Department queries
export const useDepartments = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['academic', 'departments'],
    queryFn: async () => {
      const res = await api.get('/academic/departments');
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
    enabled,
  });
};

// Programs queries
export const usePrograms = (departmentId?: string, includeInactive: boolean = false) => {
  return useQuery({
    queryKey: ['academic', 'programs', { departmentId, includeInactive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeInactive) params.append('includeInactive', 'true');
      if (departmentId && departmentId !== 'ALL') params.append('departmentId', departmentId);
      const query = params.toString();
      const res = await api.get(`/academic/departments/programs${query ? '?' + query : ''}`);
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Semesters queries
export const useSemesters = (programId?: string) => {
  return useQuery({
    queryKey: ['academic', 'semesters', { programId }],
    queryFn: async () => {
      const query = programId ? `?programId=${programId}` : '';
      const res = await api.get(`/academic/departments/semesters${query}`);
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Subjects queries
export const useSubjects = (includeInactive: boolean = false) => {
  return useQuery({
    queryKey: ['academic', 'subjects', { includeInactive }],
    queryFn: async () => {
      const query = includeInactive ? '?includeInactive=true' : '';
      const res = await api.get(`/academic/departments/subjects${query}`);
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Faculty queries
export const useFacultyList = (departmentId?: string, search?: string, includeInactive: boolean = false) => {
  return useQuery({
    queryKey: ['faculty', { departmentId, search, includeInactive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeInactive) params.append('includeInactive', 'true');
      if (departmentId && departmentId !== 'ALL') params.append('departmentId', departmentId);
      if (search && search.trim()) params.append('search', search.trim());
      const query = params.toString();
      const res = await api.get(`/faculty${query ? '?' + query : ''}`);
      return res.data?.data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
  });
};

// Students queries
export const useStudentList = (departmentId?: string, search?: string, includeInactive: boolean = false) => {
  return useQuery({
    queryKey: ['students', { departmentId, search, includeInactive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeInactive) params.append('includeInactive', 'true');
      if (departmentId && departmentId !== 'ALL') params.append('departmentId', departmentId);
      if (search && search.trim()) params.append('search', search.trim());
      const query = params.toString();
      const res = await api.get(`/students${query ? '?' + query : ''}`);
      return res.data?.data || [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

// Today's Schedules query
export const useTodaySchedules = () => {
  return useQuery({
    queryKey: ['schedules', 'today'],
    queryFn: async () => {
      const res = await api.get('/schedules/today');
      return res.data?.data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000,
  });
};

// My Attendance Sessions (Faculty)
export const useMyAttendanceSessions = () => {
  return useQuery({
    queryKey: ['attendance', 'my-sessions'],
    queryFn: async () => {
      const res = await api.get('/attendance/sessions/my-sessions');
      return res.data?.data || [];
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
};

// Attendance Sessions (General)
export const useAttendanceSessions = () => {
  return useQuery({
    queryKey: ['attendance', 'sessions'],
    queryFn: async () => {
      const res = await api.get('/attendance/sessions');
      return res.data?.data || [];
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
};

// Super Admin Stats
export const useSuperAdminStats = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['super-admin', 'stats'],
    queryFn: async () => {
      const res = await api.get('/super-admin/stats');
      return res.data?.data || null;
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
};

// Coordinators query
export const useCoordinators = () => {
  return useQuery({
    queryKey: ['coordinators'],
    queryFn: async () => {
      const res = await api.get('/auth/coordinators');
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Student Attendance Summary
export const useStudentAttendanceSummary = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['students', 'my', 'attendance-summary'],
    queryFn: async () => {
      const res = await api.get('/students/my/attendance-summary');
      return res.data?.data || null;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
};

// Student Academic Notices
export const useStudentNotices = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['students', 'academic', 'notices'],
    queryFn: async () => {
      const res = await api.get('/students/academic/notices');
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled,
  });
};

