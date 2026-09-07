import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  BookOpen,
  DoorOpen,
  Layers,
  Plus,
  Edit2,
  Power,
  Eye,
  EyeOff,
  Users,
  GraduationCap,
  Filter,
} from 'lucide-react';
import api from '../../api/axios';
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/components/ui/data-table';
import { type ColumnDef } from '@tanstack/react-table';
import { FormDialog } from '@/components/ui/form-dialog';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// --- Zod schemas ----------------------------------------------------------

const departmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(10, 'Code must be ≤10 chars').toUpperCase(),
  description: z.string().optional(),
});

type DepartmentValues = z.infer<typeof departmentSchema>;

const programSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(20, 'Code must be ≤20 chars').toUpperCase(),
  shortName: z.string().optional(),
  departmentId: z.string().min(1, 'Department is required'),
  durationYears: z.coerce.number().min(1, 'Duration must be at least 1 year').max(10, 'Duration must be ≤10 years').default(4),
});

type ProgramValues = z.infer<typeof programSchema>;

const subjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(30, 'Code must be ≤30 chars').toUpperCase(),
  year: z.coerce.number().min(1, 'Academic year is required').max(4, 'Year must be between 1 and 4'),
  semesterId: z.string().min(1, 'Semester is required'),
  isLab: z.boolean().default(false),
});

type SubjectValues = z.infer<typeof subjectSchema>;

const roomSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(30, 'Code must be ≤30 chars').toUpperCase(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  capacity: z.coerce.number().min(1, 'Capacity must be at least 1').default(60),
  building: z.string().optional(),
  isLab: z.boolean().default(false),
});

type RoomValues = z.infer<typeof roomSchema>;

const facultySchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().optional(),
  email: z.string().email('Valid email required'),
  employeeCode: z.string().min(2, 'Employee code required'),
  designation: z.string().min(2, 'Designation required'),
  departmentId: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE'),
  password: z.string().optional(),
});

type FacultyValues = z.infer<typeof facultySchema>;

const studentSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().optional(),
  email: z.string().email('Valid email required'),
  rollNumber: z.string().min(2, 'Roll number required'),
  collegeId: z.string().min(2, 'College ID required'),
  departmentId: z.string().min(1, 'Department is required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE'),
  password: z.string().optional(),
  photoKey: z.string().optional(),
  bloodGroup: z.string().optional().refine(
    (val) => !val || ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(val) || /^(A|B|AB|O)[+-]$/.test(val),
    { message: 'Invalid blood group (e.g. A+, B-, O+)' }
  ),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional().refine(
    (val) => !val || /^[0-9]{10}$/.test(val),
    { message: 'Emergency contact phone must be a 10-digit number' }
  ),
  address: z.string().optional(),
});

type StudentValues = z.infer<typeof studentSchema>;

type TabType = 'departments' | 'programs' | 'subjects' | 'rooms' | 'faculty' | 'students';

interface StudentAvatarProps {
  photoKey?: string;
  alt?: string;
  className?: string;
}

const StudentAvatar: React.FC<StudentAvatarProps> = ({ photoKey, alt, className }) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoKey) {
      setPhotoUrl(null);
      return;
    }
    let active = true;
    let urlToRevoke: string | null = null;
    api
      .get(`/students/photo/stream?key=${encodeURIComponent(photoKey)}`, { responseType: 'blob' })
      .then((res) => {
        if (active) {
          const url = URL.createObjectURL(res.data);
          urlToRevoke = url;
          setPhotoUrl(url);
        }
      })
      .catch(() => {
        if (active) setPhotoUrl(null);
      });

    return () => {
      active = false;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [photoKey]);

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden border border-border',
        className
      )}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={alt || 'Student Photo'}
          className="h-full w-full object-cover"
        />
      ) : (
        <GraduationCap className="h-1/2 w-1/2 text-muted-foreground opacity-60" />
      )}
    </div>
  );
};

// --- Page component -------------------------------------------------------

export const AcademicPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.code === 'SUPER_ADMIN';
  const isAdmin = user?.role?.code === 'ADMIN';

  const [activeTab, setActiveTab] = useState<TabType>(isAdmin ? 'programs' : 'departments');
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [semestersList, setSemestersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAdmin && activeTab === 'departments') {
      setActiveTab('programs');
    }
  }, [isAdmin, activeTab]);

  // Show Inactive records toggle (default false - opt-in)
  const [showInactive, setShowInactive] = useState(false);

  // Department CRUD dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any | null>(null);
  const [deactivatingDepartment, setDeactivatingDepartment] = useState<any | null>(null);

  // Program CRUD dialog states
  const [createProgramDialogOpen, setCreateProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any | null>(null);
  const [deactivatingProgram, setDeactivatingProgram] = useState<any | null>(null);

  // Subject CRUD dialog states
  const [createSubjectDialogOpen, setCreateSubjectDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [deactivatingSubject, setDeactivatingSubject] = useState<any | null>(null);

  // Room CRUD dialog states
  const [createRoomDialogOpen, setCreateRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [deactivatingRoom, setDeactivatingRoom] = useState<any | null>(null);

  // Faculty CRUD dialog states
  const [createFacultyDialogOpen, setCreateFacultyDialogOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [deactivatingFaculty, setDeactivatingFaculty] = useState<any | null>(null);

  // Student CRUD dialog states
  const [createStudentDialogOpen, setCreateStudentDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [deactivatingStudent, setDeactivatingStudent] = useState<any | null>(null);

  // Detail view modal state (for read-only inspection)
  const [detailItem, setDetailItem] = useState<{ type: TabType; item: any } | null>(null);

  // Fetch existing student photo as authenticated blob URL when edit dialog opens
  useEffect(() => {
    if (!editingStudent) {
      // Revoke previous blob URL to avoid memory leaks
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      setPhotoPreviewUrl(null);
      return;
    }
    const photoKey = editingStudent.photoKey;
    if (photoKey) {
      api.get(`/students/photo/stream?key=${encodeURIComponent(photoKey)}`, { responseType: 'blob' })
        .then((res) => {
          const url = URL.createObjectURL(res.data);
          setPhotoPreviewUrl(url);
        })
        .catch(() => setPhotoPreviewUrl(null));
    } else {
      setPhotoPreviewUrl(null);
    }
  }, [editingStudent]);

  // Program department filter
  const [programDeptFilter, setProgramDeptFilter] = useState<string>('ALL');

  // Subject filters (Year, Semester, Lab/Theory)
  const [subjectYearFilter, setSubjectYearFilter] = useState<string>('ALL');
  const [subjectSemFilter, setSubjectSemFilter] = useState<string>('ALL');
  const [subjectTypeFilter, setSubjectTypeFilter] = useState<string>('ALL');

  const allowedSemesters = useMemo(() => {
    if (subjectYearFilter === 'ALL') {
      return [1, 2, 3, 4, 5, 6, 7, 8];
    }
    const yr = Number(subjectYearFilter);
    return [yr * 2 - 1, yr * 2];
  }, [subjectYearFilter]);

  // Load active departments, programs & semesters for dropdowns & filtering
  const fetchDepartments = async () => {
    // Fetch semesters — available to all roles
    try {
      const semRes = await api.get('/academic/departments/semesters');
      if (semRes.data?.success && Array.isArray(semRes.data?.data)) {
        setSemestersList(semRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load semesters', err);
    }

    // Fetch departments list — ADMIN is intentionally blocked from
    // GET /academic/departments, so populate from admin's assigned department instead.
    if (!isAdmin) {
      try {
        const deptRes = await api.get('/academic/departments');
        if (deptRes.data?.success && Array.isArray(deptRes.data?.data)) {
          setDepartments(deptRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    } else {
      const adminDept = (user as any)?.adminProfile?.department;
      if (adminDept) {
        setDepartments([adminDept]);
      } else if ((user as any)?.departmentName) {
        setDepartments([{ id: (user as any)?.departmentId || 'admin-dept', name: (user as any).departmentName }]);
      }
    }
  };

  const getDepartmentName = (record?: any) => {
    if (!record) return '—';
    if (record.department?.name) return record.department.name;
    if (record.departmentId) {
      const found = departments.find((d) => d.id === record.departmentId);
      if (found?.name) return found.name;
    }
    if (isAdmin) {
      const adminDept = (user as any)?.adminProfile?.department?.name || (user as any)?.departmentName;
      if (adminDept) return adminDept;
    }
    if (record.collegeId) {
      const parts = String(record.collegeId).split('/');
      if (parts.length >= 2) {
        const code = parts[1].toUpperCase();
        const found = departments.find(
          (d) => d.code?.toUpperCase() === code || d.shortName?.toUpperCase() === code || d.shortName?.toUpperCase() === `CSE-${code}`
        );
        if (found?.name) return found.name;
      }
    }
    if (departments.length === 1 && departments[0]?.name) {
      return departments[0].name;
    }
    return (user as any)?.adminProfile?.department?.name || (user as any)?.departmentName || '—';
  };

  useEffect(() => {
    fetchDepartments();
  }, [isAdmin, user]);

  const activeFetchIdRef = React.useRef(0);

  const fetchData = async (targetTab?: TabType) => {
    const currentTab = targetTab || activeTab;
    if (isAdmin && currentTab === 'departments') {
      setData([]);
      setIsLoading(false);
      return;
    }

    const fetchId = ++activeFetchIdRef.current;
    setIsLoading(true);
    setData([]);

    try {
      const queryParam = showInactive ? '?includeInactive=true' : '';
      let endpoint = `/academic/departments${queryParam}`;
      if (currentTab === 'programs') endpoint = `/academic/departments/programs${queryParam}`;
      if (currentTab === 'subjects') endpoint = `/academic/departments/subjects${queryParam}`;
      if (currentTab === 'rooms') endpoint = `/academic/departments/rooms`;
      if (currentTab === 'faculty') endpoint = `/faculty${queryParam}`;
      if (currentTab === 'students') endpoint = `/students${queryParam}`;

      const response = await api.get(endpoint);
      if (fetchId === activeFetchIdRef.current) {
        setData(response.data?.data || []);
      }
    } catch (error: any) {
      if (fetchId === activeFetchIdRef.current) {
        console.error(`Failed to load ${currentTab} data`, error);
        toast.error(error.response?.data?.message || `Failed to load ${currentTab} data.`);
        setData([]);
      }
    } finally {
      if (fetchId === activeFetchIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, showInactive]);

  const handleCreateDepartment = async (values: DepartmentValues) => {
    try {
      const payload: any = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
      };
      if (values.description && values.description.trim()) {
        payload.description = values.description.trim();
      }
      await api.post('/academic/departments', payload);
      toast.success('Department created successfully.');
      setCreateDialogOpen(false);
      fetchData();
      fetchDepartments();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create department.';
      toast.error(msg);
      throw err;
    }
  };

  const handleUpdateDepartment = async (values: DepartmentValues) => {
    if (!editingDepartment) return;
    try {
      const payload: any = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
      };
      if (values.description && values.description.trim()) {
        payload.description = values.description.trim();
      }
      await api.patch(`/academic/departments/${editingDepartment.id}`, payload);
      toast.success('Department updated successfully.');
      setEditingDepartment(null);
      fetchData();
      fetchDepartments();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update department.';
      toast.error(msg);
      throw err;
    }
  };

  const handleDeactivateDepartment = async () => {
    if (!deactivatingDepartment) return;
    try {
      await api.patch(`/academic/departments/${deactivatingDepartment.id}/deactivate`);
      toast.success('Department deactivated successfully.');
      setDeactivatingDepartment(null);
      fetchData();
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate department.');
    }
  };

  const handleActivateDepartment = async (id: string) => {
    try {
      await api.patch(`/academic/departments/${id}/activate`);
      toast.success('Department activated successfully.');
      fetchData();
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to activate department.');
    }
  };

  const handleCreateProgram = async (values: ProgramValues) => {
    try {
      const adminDeptId = (user as any)?.adminProfile?.departmentId || (user as any)?.departmentId;
      const targetDeptId = isAdmin ? adminDeptId : values.departmentId;

      const payload: any = {
        departmentId: targetDeptId,
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        durationYears: Number(values.durationYears) || 4,
      };
      if (values.shortName && values.shortName.trim()) {
        payload.shortName = values.shortName.trim();
      }
      await api.post('/academic/departments/programs', payload);
      toast.success('Program created successfully.');
      setCreateProgramDialogOpen(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create program.';
      toast.error(msg);
      throw err;
    }
  };

  const handleUpdateProgram = async (values: ProgramValues) => {
    if (!editingProgram) return;
    try {
      const payload: any = {
        departmentId: values.departmentId,
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        durationYears: Number(values.durationYears) || 4,
      };
      if (values.shortName && values.shortName.trim()) {
        payload.shortName = values.shortName.trim();
      }
      await api.patch(`/academic/departments/programs/${editingProgram.id}`, payload);
      toast.success('Program updated successfully.');
      setEditingProgram(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update program.';
      toast.error(msg);
      throw err;
    }
  };

  const handleDeactivateProgram = async () => {
    if (!deactivatingProgram) return;
    try {
      await api.delete(`/academic/departments/programs/${deactivatingProgram.id}`);
      toast.success('Program deactivated successfully.');
      setDeactivatingProgram(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate program.');
    }
  };

  const handleActivateProgram = async (id: string) => {
    try {
      await api.patch(`/academic/departments/programs/${id}/activate`);
      toast.success('Program activated successfully.');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to activate program.');
    }
  };

  const handleCreateSubject = async (values: SubjectValues) => {
    try {
      const payload: any = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        year: Number(values.year),
        semesterId: values.semesterId,
        isLab: Boolean(values.isLab),
      };
      await api.post('/academic/departments/subjects', payload);
      toast.success('Subject created successfully.');
      setCreateSubjectDialogOpen(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create subject.';
      toast.error(msg);
      throw err;
    }
  };

  const handleUpdateSubject = async (values: SubjectValues) => {
    if (!editingSubject) return;
    try {
      const payload: any = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        year: Number(values.year),
        semesterId: values.semesterId,
        isLab: Boolean(values.isLab),
      };
      await api.patch(`/academic/departments/subjects/${editingSubject.id}`, payload);
      toast.success('Subject updated successfully.');
      setEditingSubject(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update subject.';
      toast.error(msg);
      throw err;
    }
  };

  const handleDeactivateSubject = async () => {
    if (!deactivatingSubject) return;
    try {
      await api.patch(`/academic/departments/subjects/${deactivatingSubject.id}/deactivate`);
      toast.success('Subject deactivated successfully.');
      setDeactivatingSubject(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate subject.');
    }
  };

  const handleActivateSubject = async (id: string) => {
    try {
      await api.patch(`/academic/departments/subjects/${id}/activate`);
      toast.success('Subject activated successfully.');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to activate subject.');
    }
  };

  // Room CRUD Handlers
  const handleCreateRoom = async (values: RoomValues) => {
    try {
      const payload: any = {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        capacity: Number(values.capacity) || 60,
        isLab: Boolean(values.isLab),
      };
      if (values.building && values.building.trim()) {
        payload.building = values.building.trim();
      }
      await api.post('/academic/departments/rooms', payload);
      toast.success('Room created successfully.');
      setCreateRoomDialogOpen(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create room.';
      toast.error(msg);
      throw err;
    }
  };

  const handleUpdateRoom = async (values: RoomValues) => {
    if (!editingRoom) return;
    try {
      const payload: any = {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        capacity: Number(values.capacity) || 60,
        isLab: Boolean(values.isLab),
      };
      if (values.building && values.building.trim()) {
        payload.building = values.building.trim();
      }
      await api.patch(`/academic/departments/rooms/${editingRoom.id}`, payload);
      toast.success('Room updated successfully.');
      setEditingRoom(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update room.';
      toast.error(msg);
      throw err;
    }
  };

  const handleDeactivateRoom = async () => {
    if (!deactivatingRoom) return;
    try {
      await api.patch(`/academic/departments/rooms/${deactivatingRoom.id}/deactivate`);
      toast.success('Room deactivated successfully.');
      setDeactivatingRoom(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate room.');
    }
  };

  const handleActivateRoom = async (id: string) => {
    try {
      await api.patch(`/academic/departments/rooms/${id}/activate`);
      toast.success('Room activated successfully.');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to activate room.');
    }
  };

  // Faculty CRUD Handlers
  const handleCreateFaculty = async (values: FacultyValues) => {
    try {
      const payload: any = {
        email: values.email.trim(),
        password: values.password?.trim() || 'Password123!',
        employeeCode: values.employeeCode.trim().toUpperCase(),
        firstName: values.firstName.trim(),
        gender: values.gender || 'MALE',
        designation: values.designation.trim(),
      };
      if (values.lastName && values.lastName.trim()) {
        payload.lastName = values.lastName.trim();
      }
      await api.post('/faculty/accounts', payload);
      toast.success('Faculty account created successfully.');
      setCreateFacultyDialogOpen(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create faculty account.';
      toast.error(msg);
      throw err;
    }
  };

  const handleUpdateFaculty = async (values: FacultyValues) => {
    if (!editingFaculty) return;
    try {
      const payload: any = {
        employeeCode: values.employeeCode.trim().toUpperCase(),
        firstName: values.firstName.trim(),
        designation: values.designation.trim(),
        gender: values.gender || 'MALE',
      };
      if (values.lastName && values.lastName.trim()) {
        payload.lastName = values.lastName.trim();
      }
      await api.patch(`/faculty/${editingFaculty.id}`, payload);
      toast.success('Faculty updated successfully.');
      setEditingFaculty(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update faculty.';
      toast.error(msg);
      throw err;
    }
  };

  const handleDeactivateFaculty = async () => {
    if (!deactivatingFaculty) return;
    try {
      await api.patch(`/faculty/${deactivatingFaculty.id}/deactivate`);
      toast.success('Faculty deactivated successfully.');
      setDeactivatingFaculty(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate faculty.');
    }
  };

  const handleActivateFaculty = async (id: string) => {
    try {
      await api.patch(`/faculty/${id}/activate`);
      toast.success('Faculty activated successfully.');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to activate faculty.');
    }
  };

  // Helper to map blood group display string to Enum
  const mapBloodGroupToEnum = (bg?: string) => {
    if (!bg) return undefined;
    const mapping: Record<string, string> = {
      'A+': 'A_POSITIVE', 'A-': 'A_NEGATIVE',
      'B+': 'B_POSITIVE', 'B-': 'B_NEGATIVE',
      'AB+': 'AB_POSITIVE', 'AB-': 'AB_NEGATIVE',
      'O+': 'O_POSITIVE', 'O-': 'O_NEGATIVE',
    };
    return mapping[bg] || bg;
  };

  // Student CRUD Handlers
  const handleCreateStudent = async (values: StudentValues) => {
    try {
      const payload: any = {
        email: values.email.trim(),
        password: values.password?.trim() || 'Password123!',
        rollNumber: values.rollNumber.trim().toUpperCase(),
        collegeId: values.collegeId.trim().toUpperCase(),
        enrollmentNumber: 'ENR-' + values.rollNumber.trim().toUpperCase() + '-' + Date.now().toString().slice(-4),
        firstName: values.firstName.trim(),
        gender: values.gender || 'MALE',
      };
      if (values.lastName && values.lastName.trim()) payload.lastName = values.lastName.trim();
      if (values.photoKey) payload.photoKey = values.photoKey;
      if (values.bloodGroup) payload.bloodGroup = mapBloodGroupToEnum(values.bloodGroup);
      if (values.emergencyContactName?.trim()) payload.emergencyContactName = values.emergencyContactName.trim();
      if (values.emergencyContactPhone?.trim()) payload.emergencyContactPhone = values.emergencyContactPhone.trim();
      if (values.address?.trim()) payload.address = values.address.trim();

      await api.post('/students/accounts', payload);
      toast.success('Student account created successfully.');
      setCreateStudentDialogOpen(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create student account.';
      toast.error(msg);
      throw err;
    }
  };

  const handleUpdateStudent = async (values: StudentValues) => {
    if (!editingStudent) return;
    try {
      const payload: any = {
        rollNumber: values.rollNumber.trim().toUpperCase(),
        collegeId: values.collegeId.trim().toUpperCase(),
        firstName: values.firstName.trim(),
        gender: values.gender || 'MALE',
      };
      if (values.lastName && values.lastName.trim()) payload.lastName = values.lastName.trim();
      if (isAdmin && values.photoKey !== undefined) payload.photoKey = values.photoKey;
      if (values.bloodGroup !== undefined) payload.bloodGroup = mapBloodGroupToEnum(values.bloodGroup);
      if (values.emergencyContactName !== undefined) payload.emergencyContactName = values.emergencyContactName.trim();
      if (values.emergencyContactPhone !== undefined) payload.emergencyContactPhone = values.emergencyContactPhone.trim();
      if (values.address !== undefined) payload.address = values.address.trim();

      await api.patch(`/students/${editingStudent.id}`, payload);
      toast.success('Student updated successfully.');
      setEditingStudent(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update student.';
      toast.error(msg);
      throw err;
    }
  };

  const handleDeactivateStudent = async () => {
    if (!deactivatingStudent) return;
    try {
      await api.patch(`/students/${deactivatingStudent.id}/deactivate`);
      toast.success('Student deactivated successfully.');
      setDeactivatingStudent(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate student.');
    }
  };

  const handleActivateStudent = async (id: string) => {
    try {
      await api.patch(`/students/${id}/activate`);
      toast.success('Student activated successfully.');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to activate student.');
    }
  };

  // Filtered data for programs & subjects tabs
  const displayData = useMemo(() => {
    if (activeTab === 'programs' && programDeptFilter !== 'ALL') {
      return data.filter(
        (p: any) => p.departmentId === programDeptFilter || p.department?.id === programDeptFilter,
      );
    }
    if (activeTab === 'subjects') {
      return data.filter((s: any) => {
        if (subjectYearFilter !== 'ALL' && Number(s.year) !== Number(subjectYearFilter)) {
          return false;
        }
        if (subjectSemFilter !== 'ALL') {
          const semNum = Number(subjectSemFilter);
          if (!isNaN(semNum)) {
            if (s.semester?.number !== semNum) return false;
          } else {
            if (s.semesterId !== subjectSemFilter && s.semester?.id !== subjectSemFilter) return false;
          }
        }
        if (subjectTypeFilter !== 'ALL') {
          const isLabBool = subjectTypeFilter === 'LAB';
          if (s.isLab !== isLabBool) return false;
        }
        return true;
      });
    }
    return data;
  }, [data, activeTab, programDeptFilter, subjectYearFilter, subjectSemFilter, subjectTypeFilter]);

  // Dynamic table columns based on activeTab
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (activeTab === 'departments') {
      return [
        {
          accessorKey: 'code',
          header: 'Code',
          cell: ({ row }) => (
            <span className="font-mono text-xs font-semibold">{String(row.getValue('code') || '—')}</span>
          ),
        },
        {
          accessorKey: 'name',
          header: 'Name',
          cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
        },
        {
          accessorKey: 'description',
          header: 'Description',
          cell: ({ row }) => (
            <span className="text-muted-foreground text-xs">{row.original.description || '—'}</span>
          ),
        },
        {
          accessorKey: 'isActive',
          header: 'Status',
          cell: ({ row }) => {
            const isActive = row.original.isActive !== false;
            return (
              <Badge variant={isActive ? 'default' : 'secondary'}>
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
            );
          },
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: ({ row }) => {
            const dept = row.original;
            const isActive = dept.isActive !== false;
            return (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setEditingDepartment(dept)}
                  title="Edit Department"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                {isActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeactivatingDepartment(dept)}
                    title="Deactivate Department"
                  >
                    <Power className="w-3.5 h-3.5 mr-1" /> Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    onClick={() => handleActivateDepartment(dept.id)}
                    title="Activate Department"
                  >
                    <Power className="w-3.5 h-3.5 mr-1" /> Activate
                  </Button>
                )}
              </div>
            );
          },
        },
      ];
    }

    if (activeTab === 'programs') {
      return [
        {
          accessorKey: 'code',
          header: 'Code',
          cell: ({ row }) => (
            <span className="font-mono text-xs font-semibold">{String(row.getValue('code') || '—')}</span>
          ),
        },
        {
          accessorKey: 'name',
          header: 'Program Name',
          cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
        },
        {
          id: 'department',
          header: 'Department',
          cell: ({ row }) => {
            const dept = row.original.department;
            return (
              <span className="text-muted-foreground text-xs">
                {dept?.name || getDepartmentName(row.original)}
              </span>
            );
          },
        },
        {
          accessorKey: 'durationYears',
          header: 'Duration',
          cell: ({ row }) => (
            <span className="text-xs">{row.original.durationYears ? `${row.original.durationYears} Years` : '—'}</span>
          ),
        },
        {
          accessorKey: 'isActive',
          header: 'Status',
          cell: ({ row }) => (
            <Badge variant={row.original.isActive !== false ? 'default' : 'secondary'}>
              {row.original.isActive !== false ? 'Active' : 'Inactive'}
            </Badge>
          ),
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: ({ row }) => {
            const prog = row.original;
            const isActive = prog.isActive !== false;
            return (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setEditingProgram(prog)}
                  title="Edit Program"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                {isActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeactivatingProgram(prog)}
                    title="Deactivate Program"
                  >
                    <Power className="w-3.5 h-3.5 mr-1" /> Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    onClick={() => handleActivateProgram(prog.id)}
                    title="Activate Program"
                  >
                    <Power className="w-3.5 h-3.5 mr-1" /> Activate
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setDetailItem({ type: 'programs', item: prog })}
                  title="View Details"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Details
                </Button>
              </div>
            );
          },
        },
      ];
    }

    if (activeTab === 'subjects') {
      return [
        {
          accessorKey: 'code',
          header: 'Subject Code',
          cell: ({ row }) => (
            <span className="font-mono text-xs font-semibold">{String(row.getValue('code') || '—')}</span>
          ),
        },
        {
          accessorKey: 'name',
          header: 'Subject Name',
          cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
        },
        {
          id: 'year',
          header: 'Year',
          cell: ({ row }) => {
            const yr = Number(row.original.year) || 1;
            const labels: Record<number, string> = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
            return (
              <Badge variant="secondary" className="text-[11px] font-medium">
                {labels[yr] || `Year ${yr}`}
              </Badge>
            );
          },
        },
        {
          id: 'semester',
          header: 'Semester',
          cell: ({ row }) => {
            const sem = row.original.semester;
            return <span className="text-xs">{sem ? `Sem ${sem.number}` : '—'}</span>;
          },
        },
        {
          accessorKey: 'isLab',
          header: 'Type',
          cell: ({ row }) => (
            <Badge variant="outline" className="text-[10px]">
              {row.original.isLab ? 'Lab' : 'Theory'}
            </Badge>
          ),
        },
        {
          accessorKey: 'isActive',
          header: 'Status',
          cell: ({ row }) => {
            const active = row.original.isActive !== false;
            return (
              <Badge
                variant={active ? 'default' : 'secondary'}
                className={active ? '' : 'bg-muted text-muted-foreground border-border'}
              >
                {active ? 'Active' : 'Inactive'}
              </Badge>
            );
          },
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: ({ row }) => {
            const sub = row.original;
            return (
              <div className="flex items-center gap-1.5">
                {isSuperAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setEditingSubject(sub)}
                      title="Edit Subject"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    {sub.isActive !== false ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeactivatingSubject(sub)}
                        title="Deactivate Subject"
                      >
                        <Power className="w-3.5 h-3.5 mr-1" /> Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                        onClick={() => handleActivateSubject(sub.id)}
                        title="Activate Subject"
                      >
                        <Power className="w-3.5 h-3.5 mr-1" /> Activate
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setDetailItem({ type: 'subjects', item: sub })}
                  title="View Details"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Details
                </Button>
              </div>
            );
          },
        },
      ];
    }

    if (activeTab === 'rooms') {
      return [
        {
          accessorKey: 'code',
          header: 'Room Code',
          cell: ({ row }) => (
            <span className="font-mono text-xs font-semibold">{String(row.getValue('code') || '—')}</span>
          ),
        },
        {
          accessorKey: 'name',
          header: 'Room Name',
          cell: ({ row }) => <span className="font-medium">{row.getValue('name') || row.original.code}</span>,
        },
        {
          id: 'location',
          header: 'Building & Floor',
          cell: ({ row }) => {
            const b = row.original.building || 'Main Campus';
            const f = row.original.floor !== undefined ? `Floor ${row.original.floor}` : '';
            return <span className="text-muted-foreground text-xs">{[b, f].filter(Boolean).join(' • ')}</span>;
          },
        },
        {
          accessorKey: 'capacity',
          header: 'Capacity',
          cell: ({ row }) => (
            <span className="text-xs font-mono">{row.original.capacity ? `${row.original.capacity} seats` : '—'}</span>
          ),
        },
        {
          accessorKey: 'isActive',
          header: 'Status',
          cell: ({ row }) => (
            <Badge variant={row.original.isActive !== false ? 'default' : 'secondary'}>
              {row.original.isActive !== false ? 'Active' : 'Inactive'}
            </Badge>
          ),
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: ({ row }) => {
            const rm = row.original;
            const isActive = rm.isActive !== false;
            return (
              <div className="flex items-center gap-1">
                {(isSuperAdmin || isAdmin) && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setEditingRoom(rm)}
                      title="Edit Room"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    {isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeactivatingRoom(rm)}
                        title="Deactivate Room"
                      >
                        <Power className="w-3.5 h-3.5 mr-1" /> Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                        onClick={() => handleActivateRoom(rm.id)}
                        title="Activate Room"
                      >
                        <Power className="w-3.5 h-3.5 mr-1" /> Activate
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setDetailItem({ type: 'rooms', item: rm })}
                  title="View Details"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Details
                </Button>
              </div>
            );
          },
        },
      ];
    }

    if (activeTab === 'faculty') {
      return [
        {
          accessorKey: 'employeeCode',
          header: 'Employee Code',
          cell: ({ row }) => (
            <span className="font-mono text-xs font-semibold">{String(row.getValue('employeeCode') || '—')}</span>
          ),
        },
        {
          id: 'name',
          header: 'Faculty Name',
          cell: ({ row }) => {
            const f = row.original;
            return <span className="font-medium">{`${f.firstName || ''} ${f.lastName || ''}`.trim()}</span>;
          },
        },
        {
          id: 'email',
          header: 'Email',
          cell: ({ row }) => (
            <span className="text-xs text-muted-foreground">{row.original.user?.email || '—'}</span>
          ),
        },
        {
          accessorKey: 'designation',
          header: 'Designation',
          cell: ({ row }) => <span className="text-xs">{row.getValue('designation') || 'Faculty'}</span>,
        },
        {
          id: 'department',
          header: 'Department',
          cell: ({ row }) => (
            <span className="text-xs text-muted-foreground">{getDepartmentName(row.original)}</span>
          ),
        },
        {
          accessorKey: 'isActive',
          header: 'Status',
          cell: ({ row }) => (
            <Badge variant={row.original.isActive !== false ? 'default' : 'secondary'}>
              {row.original.isActive !== false ? 'Active' : 'Inactive'}
            </Badge>
          ),
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: ({ row }) => {
            const fac = row.original;
            const isActive = fac.isActive !== false;
            return (
              <div className="flex items-center gap-1">
                {(isSuperAdmin || isAdmin) && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setEditingFaculty(fac)}
                      title="Edit Faculty"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    {isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeactivatingFaculty(fac)}
                        title="Deactivate Faculty"
                      >
                        <Power className="w-3.5 h-3.5 mr-1" /> Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                        onClick={() => handleActivateFaculty(fac.id)}
                        title="Activate Faculty"
                      >
                        <Power className="w-3.5 h-3.5 mr-1" /> Activate
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setDetailItem({ type: 'faculty', item: fac })}
                  title="View Details"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Details
                </Button>
              </div>
            );
          },
        },
      ];
    }

    // Students tab
    return [
      {
        accessorKey: 'rollNumber',
        header: 'Roll Number',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold">{String(row.getValue('rollNumber') || '—')}</span>
        ),
      },
      {
        id: 'name',
        header: 'Student Name',
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center gap-2">
              <StudentAvatar
                photoKey={s.photoKey}
                alt={`${s.firstName || ''} ${s.lastName || ''}`}
                className="w-7 h-7"
              />
              <span className="font-medium">{`${s.firstName || ''} ${s.lastName || ''}`.trim()}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'collegeId',
        header: 'College ID',
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue('collegeId') || '—'}</span>,
      },
      {
        id: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.user?.email || '—'}</span>
        ),
      },
      {
        id: 'department',
        header: 'Department',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{getDepartmentName(row.original)}</span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive !== false ? 'default' : 'secondary'}>
            {row.original.isActive !== false ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const stu = row.original;
          const isActive = stu.isActive !== false;
          return (
            <div className="flex items-center gap-1">
              {(isSuperAdmin || isAdmin) && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setEditingStudent(stu)}
                    title="Edit Student"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  {isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeactivatingStudent(stu)}
                      title="Deactivate Student"
                    >
                      <Power className="w-3.5 h-3.5 mr-1" /> Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                      onClick={() => handleActivateStudent(stu.id)}
                      title="Activate Student"
                    >
                      <Power className="w-3.5 h-3.5 mr-1" /> Activate
                    </Button>
                  )}
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setDetailItem({ type: 'students', item: stu })}
                title="View Details"
              >
                <Eye className="w-3.5 h-3.5 mr-1" /> Details
              </Button>
            </div>
          );
        },
      },
    ];
  }, [activeTab, departments, isSuperAdmin, isAdmin]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Master Data</h1>
          <p className="text-sm text-muted-foreground">
            Manage institutional departments, programs, subjects, rooms, faculty, and students
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['departments', 'programs', 'subjects', 'faculty', 'students'].includes(activeTab) && (
            <Button
              variant={showInactive ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowInactive((prev) => !prev)}
              className="text-xs h-9 border-dashed"
            >
              {showInactive ? (
                <Eye className="w-3.5 h-3.5 mr-1.5 text-primary" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              )}
              {showInactive ? 'Showing Inactive' : 'Show Inactive'}
            </Button>
          )}
          {activeTab === 'departments' && isSuperAdmin && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Department
            </Button>
          )}
          {activeTab === 'programs' && (isSuperAdmin || isAdmin) && (
            <Button onClick={() => setCreateProgramDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Program
            </Button>
          )}
          {activeTab === 'subjects' && isSuperAdmin && (
            <Button onClick={() => setCreateSubjectDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Subject
            </Button>
          )}
          {activeTab === 'rooms' && (isSuperAdmin || isAdmin) && (
            <Button onClick={() => setCreateRoomDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Room
            </Button>
          )}
          {activeTab === 'faculty' && (isSuperAdmin || isAdmin) && (
            <Button onClick={() => setCreateFacultyDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Faculty
            </Button>
          )}
          {activeTab === 'students' && (isSuperAdmin || isAdmin) && (
            <Button onClick={() => setCreateStudentDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-muted rounded-xl max-w-4xl">
        {(
          [
            { key: 'departments', label: 'Departments', icon: Building2 },
            { key: 'programs', label: 'Programs', icon: Layers },
            { key: 'subjects', label: 'Subjects', icon: BookOpen },
            { key: 'rooms', label: 'Rooms', icon: DoorOpen },
            { key: 'faculty', label: 'Faculty', icon: GraduationCap },
            { key: 'students', label: 'Students', icon: Users },
          ] as const
        )
          .filter(({ key }) => !(key === 'departments' && isAdmin))
          .map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                fetchData(key);
              }}
              className={`flex-1 min-w-[110px] py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
      </div>

      {/* Programs Tab: Department Filter or Assigned Department Badge */}
      {activeTab === 'programs' && (
        isAdmin ? (
          <div className="flex items-center gap-2.5 p-3 bg-muted/40 rounded-lg border border-border max-w-lg">
            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-medium text-foreground whitespace-nowrap">Assigned Department:</span>
            <Badge variant="secondary" className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-0.5">
              {(user as any)?.adminProfile?.department?.name || (user as any)?.departmentName || 'Assigned Department'}
            </Badge>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border max-w-lg">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-foreground whitespace-nowrap">Filter by Department:</span>
            <select
              value={programDeptFilter}
              onChange={(e) => setProgramDeptFilter(e.target.value)}
              className="w-full text-xs bg-background border border-input rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Departments ({departments.length})</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>
        )
      )}

      {/* Subjects Tab: Year, Semester & Lab/Theory Filters */}
      {activeTab === 'subjects' && (
        <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/40 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">Filter Subjects:</span>
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Year:</span>
            <select
              value={subjectYearFilter}
              onChange={(e) => {
                const yr = e.target.value;
                setSubjectYearFilter(yr);
                if (yr !== 'ALL' && subjectSemFilter !== 'ALL') {
                  const yrNum = Number(yr);
                  const validSems = [yrNum * 2 - 1, yrNum * 2];
                  if (!validSems.includes(Number(subjectSemFilter))) {
                    setSubjectSemFilter('ALL');
                  }
                }
              }}
              className="text-xs bg-background border border-input rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Years</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          {/* Semester Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Semester:</span>
            <select
              value={subjectSemFilter}
              onChange={(e) => setSubjectSemFilter(e.target.value)}
              className="text-xs bg-background border border-input rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Semesters</option>
              {allowedSemesters.map((semNum) => (
                <option key={semNum} value={String(semNum)}>
                  Semester {semNum}
                </option>
              ))}
            </select>
          </div>

          {/* Type (Theory / Lab) Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Type:</span>
            <select
              value={subjectTypeFilter}
              onChange={(e) => setSubjectTypeFilter(e.target.value)}
              className="text-xs bg-background border border-input rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="THEORY">Theory</option>
              <option value="LAB">Lab</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(subjectYearFilter !== 'ALL' || subjectSemFilter !== 'ALL' || subjectTypeFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSubjectYearFilter('ALL');
                setSubjectSemFilter('ALL');
                setSubjectTypeFilter('ALL');
              }}
              className="text-xs h-7 px-2.5 ml-auto text-muted-foreground hover:text-foreground border border-border"
            >
              Reset Filters
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="capitalize">{activeTab}</CardTitle>
              <CardDescription>
                {activeTab === 'departments'
                  ? 'Full management of institutional departments.'
                  : activeTab === 'programs'
                    ? 'Management of academic programs under active departments.'
                    : activeTab === 'subjects'
                      ? (isSuperAdmin ? 'Full management of academic subjects with Year and Lab configuration.' : 'View-only list of academic subjects.')
                      : activeTab === 'rooms'
                        ? 'Management of classroom and laboratory facilities.'
                        : activeTab === 'faculty'
                          ? 'Management of faculty profiles and user accounts.'
                          : 'Management of student records and user accounts.'}
              </CardDescription>
            </div>
            {isAdmin && activeTab === 'subjects' && (
              <Badge variant="outline" className="text-xs text-muted-foreground bg-muted/30">
                View-Only
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={displayData}
            isLoading={isLoading}
            searchKey={activeTab === 'departments' || activeTab === 'programs' || activeTab === 'subjects' ? 'name' : undefined}
          />
        </CardContent>
      </Card>

      {/* Create Department Dialog */}
      <FormDialog<typeof departmentSchema>
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Create Department"
        description="Add a new academic department to the institution."
        schema={departmentSchema}
        defaultValues={{ name: '', code: '', description: '' }}
        onSubmit={handleCreateDepartment}
        submitLabel="Create Department"
      >
        {(form) => (
          <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Computer Science & Engineering" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. CSE" {...field} className="uppercase" />
                  </FormControl>
                  <FormDescription>Short code used for identification (max 10 chars).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Brief description of the department..."
                      rows={3}
                      className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </FormDialog>

      {/* Edit Department Dialog */}
      {editingDepartment && (
        <FormDialog<typeof departmentSchema>
          open={!!editingDepartment}
          onOpenChange={(open) => !open && setEditingDepartment(null)}
          title="Edit Department"
          description={`Update details for ${editingDepartment.name} (${editingDepartment.code}).`}
          schema={departmentSchema}
          defaultValues={{
            name: editingDepartment.name || '',
            code: editingDepartment.code || '',
            description: editingDepartment.description || '',
          }}
          onSubmit={handleUpdateDepartment}
          submitLabel="Save Changes"
        >
          {(form) => (
            <>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Computer Science & Engineering" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CSE" {...field} className="uppercase" />
                    </FormControl>
                    <FormDescription>Short code used for identification (max 10 chars).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <textarea
                        placeholder="Brief description of the department..."
                        rows={3}
                        className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </FormDialog>
      )}

      {/* Deactivate Department Confirmation */}
      <AlertDialog
        open={!!deactivatingDepartment}
        onOpenChange={(open) => !open && setDeactivatingDepartment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-semibold text-foreground">
                {deactivatingDepartment?.name} ({deactivatingDepartment?.code})
              </span>
              ? Associated programs and classes may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivateDepartment}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Program Dialog */}
      <FormDialog<typeof programSchema>
        open={createProgramDialogOpen}
        onOpenChange={setCreateProgramDialogOpen}
        title="Create Program"
        description="Add a new academic program under an active department."
        schema={programSchema}
        defaultValues={{
          name: '',
          code: '',
          shortName: '',
          departmentId: isAdmin
            ? ((user as any)?.adminProfile?.departmentId || (user as any)?.departmentId || '')
            : (programDeptFilter !== 'ALL' ? programDeptFilter : (departments[0]?.id || '')),
          durationYears: 4,
        }}
        onSubmit={handleCreateProgram}
        submitLabel="Create Program"
      >
        {(form) => (
          <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Bachelor of Technology in CSE" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. BTECH-CSE" {...field} className="uppercase" />
                  </FormControl>
                  <FormDescription>Unique identifier code.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shortName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. B.Tech CSE" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    {isAdmin ? (
                      <Input
                        value={(user as any)?.adminProfile?.department?.name || (user as any)?.departmentName || 'Assigned Department'}
                        disabled
                        className="bg-muted text-muted-foreground font-medium"
                      />
                    ) : (
                      <select
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select active department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </FormControl>
                  <FormDescription>
                    {isAdmin ? 'Programs are created under your assigned department.' : 'Only active departments can host programs.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="durationYears"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (Years)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      placeholder="4"
                      {...field}
                      value={field.value ?? 4}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || Number(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </FormDialog>

      {/* Edit Program Dialog */}
      {editingProgram && (
        <FormDialog<typeof programSchema>
          open={!!editingProgram}
          onOpenChange={(open) => !open && setEditingProgram(null)}
          title="Edit Program"
          description={`Update details for ${editingProgram.name} (${editingProgram.code}).`}
          schema={programSchema}
          defaultValues={{
            name: editingProgram.name || '',
            code: editingProgram.code || '',
            shortName: editingProgram.shortName || '',
            departmentId: editingProgram.departmentId || '',
            durationYears: editingProgram.durationYears || 4,
          }}
          onSubmit={handleUpdateProgram}
          submitLabel="Save Changes"
        >
          {(form) => (
            <>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Bachelor of Technology in CSE" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. BTECH-CSE" {...field} className="uppercase" />
                    </FormControl>
                    <FormDescription>Unique identifier code.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shortName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. B.Tech CSE" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select active department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormDescription>Must remain under an active department.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durationYears"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (Years)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        placeholder="4"
                        {...field}
                        value={field.value ?? 4}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || Number(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </FormDialog>
      )}

      {/* Deactivate Program Confirmation */}
      <AlertDialog
        open={!!deactivatingProgram}
        onOpenChange={(open) => !open && setDeactivatingProgram(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Program</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-semibold text-foreground">
                {deactivatingProgram?.name} ({deactivatingProgram?.code})
              </span>
              ? Associated semesters, sections, and subjects may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivateProgram}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Subject Dialog */}
      <FormDialog<typeof subjectSchema>
        open={createSubjectDialogOpen}
        onOpenChange={setCreateSubjectDialogOpen}
        title="Create Subject"
        description="Register a new academic subject with Year, Semester, and Type."
        schema={subjectSchema}
        defaultValues={{
          name: '',
          code: '',
          year: 1,
          semesterId: '',
          isLab: false,
        }}
        onSubmit={handleCreateSubject}
        submitLabel="Create Subject"
      >
        {(form) => {
          const selectedYear = Number(form.watch('year')) || 1;
          const targetSemNumbers = [selectedYear * 2 - 1, selectedYear * 2];
          const uniqueSemesters = Array.from(
            new Map(
              semestersList
                .filter((s) => targetSemNumbers.includes(s.number) && s.isActive !== false)
                .map((s) => [s.number, s])
            ).values()
          ).sort((a, b) => a.number - b.number);

          return (
            <>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Compiler Design" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CS601" {...field} className="uppercase" />
                    </FormControl>
                    <FormDescription>Unique identifier code (max 30 chars).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          value={field.value ?? 1}
                          onChange={(e) => {
                            const newYr = Number(e.target.value);
                            field.onChange(newYr);
                            form.setValue('semesterId', '');
                          }}
                          className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value={1}>1st Year</option>
                          <option value={2}>2nd Year</option>
                          <option value={3}>3rd Year</option>
                          <option value={4}>4th Year</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="semesterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semester</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select semester</option>
                          {uniqueSemesters.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name || `Semester ${s.number}`}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isLab"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3.5 shadow-xs bg-muted/20">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">Laboratory Subject</FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        Toggle on if this subject requires laboratory facilities.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value || false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          );
        }}
      </FormDialog>

      {/* Edit Subject Dialog */}
      {editingSubject && (
        <FormDialog<typeof subjectSchema>
          open={!!editingSubject}
          onOpenChange={(open) => !open && setEditingSubject(null)}
          title="Edit Subject"
          description={`Update details for ${editingSubject.name} (${editingSubject.code}).`}
          schema={subjectSchema}
          defaultValues={{
            name: editingSubject.name || '',
            code: editingSubject.code || '',
            year: editingSubject.year || 1,
            semesterId: editingSubject.semesterId || '',
            isLab: editingSubject.isLab || false,
          }}
          onSubmit={handleUpdateSubject}
          submitLabel="Save Changes"
        >
          {(form) => {
            const selectedYear = Number(form.watch('year')) || 1;
            const targetSemNumbers = [selectedYear * 2 - 1, selectedYear * 2];
            const uniqueSemesters = Array.from(
              new Map(
                semestersList
                  .filter((s) => targetSemNumbers.includes(s.number) && s.isActive !== false)
                  .map((s) => [s.number, s])
              ).values()
            ).sort((a, b) => a.number - b.number);

            return (
              <>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Compiler Design" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. CS601" {...field} className="uppercase" />
                      </FormControl>
                      <FormDescription>Unique identifier code (max 30 chars).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            value={field.value ?? 1}
                            onChange={(e) => {
                              const newYr = Number(e.target.value);
                              field.onChange(newYr);
                              form.setValue('semesterId', '');
                            }}
                            className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value={1}>1st Year</option>
                            <option value={2}>2nd Year</option>
                            <option value={3}>3rd Year</option>
                            <option value={4}>4th Year</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="semesterId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Semester</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Select semester</option>
                            {uniqueSemesters.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name || `Semester ${s.number}`}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="isLab"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3.5 shadow-xs bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">Laboratory Subject</FormLabel>
                        <FormDescription className="text-xs text-muted-foreground">
                          Toggle on if this subject requires laboratory facilities.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            );
          }}
        </FormDialog>
      )}

      {/* Deactivate Subject Confirmation */}
      <AlertDialog
        open={!!deactivatingSubject}
        onOpenChange={(open) => !open && setDeactivatingSubject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Subject</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-semibold text-foreground">
                {deactivatingSubject?.name} ({deactivatingSubject?.code})
              </span>
              ? Associated timetables and slot assignments may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivateSubject}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Room Dialog */}
      <FormDialog<typeof roomSchema>
        open={createRoomDialogOpen}
        onOpenChange={setCreateRoomDialogOpen}
        title="Add New Room"
        description="Register a classroom or laboratory facility."
        schema={roomSchema}
        defaultValues={{
          code: '',
          name: '',
          capacity: 60,
          building: '',
          isLab: false,
        }}
        onSubmit={handleCreateRoom}
        submitLabel="Create Room"
      >
        {(form) => (
          <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Lab 301 / Lecture Hall A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. R301" {...field} className="uppercase" />
                  </FormControl>
                  <FormDescription>Unique identifier code (max 30 chars).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity (Seats)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} placeholder="60" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="building"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building / Block</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Main Block" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="isLab"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 shadow-xs">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">Laboratory Room</FormLabel>
                    <FormDescription className="text-xs text-muted-foreground">
                      Toggle on if this room is equipped for practical labs.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </>
        )}
      </FormDialog>

      {/* Edit Room Dialog */}
      {editingRoom && (
        <FormDialog<typeof roomSchema>
          open={!!editingRoom}
          onOpenChange={(open) => !open && setEditingRoom(null)}
          title="Edit Room"
          description={`Update details for ${editingRoom.name || editingRoom.code}.`}
          schema={roomSchema}
          defaultValues={{
            code: editingRoom.code || '',
            name: editingRoom.name || '',
            capacity: editingRoom.capacity || 60,
            building: editingRoom.building || '',
            isLab: editingRoom.isLab || false,
          }}
          onSubmit={handleUpdateRoom}
          submitLabel="Save Changes"
        >
          {(form) => (
            <>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Lab 301 / Lecture Hall A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. R301" {...field} className="uppercase" />
                    </FormControl>
                    <FormDescription>Unique identifier code (max 30 chars).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (Seats)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} placeholder="60" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="building"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Building / Block</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Main Block" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isLab"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 shadow-xs">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">Laboratory Room</FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        Toggle on if this room is equipped for practical labs.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value || false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          )}
        </FormDialog>
      )}

      {/* Deactivate Room Confirmation */}
      <AlertDialog
        open={!!deactivatingRoom}
        onOpenChange={(open) => !open && setDeactivatingRoom(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-semibold text-foreground">
                {deactivatingRoom?.name || deactivatingRoom?.code}
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivateRoom}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Faculty Dialog */}
      <FormDialog<typeof facultySchema>
        open={createFacultyDialogOpen}
        onOpenChange={setCreateFacultyDialogOpen}
        title="Add New Faculty"
        description="Register a new faculty profile and user account."
        schema={facultySchema}
        defaultValues={{
          firstName: '',
          lastName: '',
          email: '',
          employeeCode: '',
          designation: 'Assistant Professor',
          departmentId: isAdmin ? ((user as any)?.adminProfile?.departmentId || (user as any)?.departmentId || '') : '',
          gender: 'MALE',
          password: 'Password123!',
        }}
        onSubmit={handleCreateFaculty}
        submitLabel="Create Faculty"
      >
        {(form) => (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Ramesh" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Kumar" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employeeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. FAC101" {...field} className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Associate Professor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Official Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@bit.ac.in" {...field} />
                  </FormControl>
                  <FormDescription>Must be an official @bit.ac.in email address.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isAdmin ? (
              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={(user as any)?.adminProfile?.department?.name || (user as any)?.departmentName || 'Assigned Department'}
                  disabled
                  className="bg-muted text-muted-foreground font-medium cursor-not-allowed"
                />
              </div>
            ) : (
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Password123!" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        )}
      </FormDialog>

      {/* Edit Faculty Dialog */}
      {editingFaculty && (
        <FormDialog<typeof facultySchema>
          open={!!editingFaculty}
          onOpenChange={(open) => !open && setEditingFaculty(null)}
          title="Edit Faculty Profile"
          description={`Update profile details for ${editingFaculty.firstName} ${editingFaculty.lastName || ''}.`}
          schema={facultySchema}
          defaultValues={{
            firstName: editingFaculty.firstName || '',
            lastName: editingFaculty.lastName || '',
            email: editingFaculty.user?.email || '',
            employeeCode: editingFaculty.employeeCode || '',
            designation: editingFaculty.designation || 'Faculty',
            departmentId: editingFaculty.departmentId || (isAdmin ? ((user as any)?.adminProfile?.departmentId || (user as any)?.departmentId || '') : ''),
            gender: editingFaculty.gender || 'MALE',
            password: '',
          }}
          onSubmit={handleUpdateFaculty}
          submitLabel="Save Changes"
        >
          {(form) => (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Ramesh" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Kumar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employeeCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. FAC101" {...field} className="uppercase" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Associate Professor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={(user as any)?.adminProfile?.department?.name || (user as any)?.departmentName || 'Assigned Department'}
                    disabled
                    className="bg-muted text-muted-foreground font-medium cursor-not-allowed"
                  />
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="">Select Department</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name} ({dept.code})
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </FormDialog>
      )}

      {/* Deactivate Faculty Confirmation */}
      <AlertDialog
        open={!!deactivatingFaculty}
        onOpenChange={(open) => !open && setDeactivatingFaculty(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Faculty</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-semibold text-foreground">
                {deactivatingFaculty?.firstName} {deactivatingFaculty?.lastName || ''} ({deactivatingFaculty?.employeeCode})
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivateFaculty}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Student Dialog */}
      <FormDialog<typeof studentSchema>
        open={createStudentDialogOpen}
        onOpenChange={(open) => {
          setCreateStudentDialogOpen(open);
          if (!open) {
            if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
            setPhotoPreviewUrl(null);
            setPhotoUploading(false);
          }
        }}
        title="Add New Student"
        description="Register a new student profile and login account."
        schema={studentSchema}
        className="sm:max-w-2xl"
        defaultValues={{
          firstName: '',
          lastName: '',
          email: '',
          rollNumber: '',
          collegeId: '',
          departmentId: isAdmin ? ((user as any)?.adminProfile?.departmentId || (user as any)?.departmentId || '') : '',
          gender: 'MALE',
          password: 'Password123!',
        }}
        onSubmit={handleCreateStudent}
        submitLabel="Create Student"
      >
        {(form) => (
          <>
            {/* Photo Upload (Optional) */}
            <div className="border border-dashed border-border rounded-lg p-4 space-y-2 bg-muted/20">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {photoPreviewUrl ? (
                    <img
                      src={photoPreviewUrl}
                      alt="Student Photo Preview"
                      className="w-24 h-24 rounded-lg object-cover border-2 border-border bg-background"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center text-muted-foreground">
                      <GraduationCap className="w-8 h-8 mb-1 opacity-60" />
                      <span className="text-[10px]">No photo</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <span className="text-sm font-semibold block">Profile Photo (Cloudflare R2 - Optional)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={photoUploading}
                    className="text-xs w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Photo size must be ≤ 5MB.');
                        return;
                      }
                      // Instant local preview
                      const localUrl = URL.createObjectURL(file);
                      setPhotoPreviewUrl(localUrl);

                      const formData = new FormData();
                      formData.append('file', file);
                      setPhotoUploading(true);
                      try {
                        const res = await api.post('/students/upload-photo', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                        });
                        if (res.data?.success) {
                          form.setValue('photoKey', res.data.data.photoKey);
                          toast.success('Photo uploaded to R2!');
                        }
                      } catch (err: any) {
                        toast.error(err.response?.data?.message || 'Photo upload failed.');
                      } finally {
                        setPhotoUploading(false);
                      }
                    }}
                  />
                  {photoUploading && (
                    <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
                  )}
                  <p className="text-[10px] text-muted-foreground">JPG, PNG, or WebP · Max 5 MB</p>
                </div>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Priya" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Singh" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rollNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Roll Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 10123" {...field} className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="collegeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>College ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. BIT/2026/001" {...field} className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Official Email</FormLabel>
                    <FormControl>
                      <Input placeholder="student@bit.ac.in" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={(user as any)?.adminProfile?.department?.name || (user as any)?.departmentName || 'Assigned Department'}
                    disabled
                    className="bg-muted text-muted-foreground font-medium cursor-not-allowed"
                  />
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="">Select Department</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name} ({dept.code})
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Password123!" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bloodGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blood Group</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="">Select Blood Group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="10-digit phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Parent / Guardian Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Residential Address</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={2}
                      placeholder="Full residential address (street, city, state, pin code)"
                      className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </FormDialog>

      {/* Edit Student Dialog */}
      {editingStudent && (
        <FormDialog<typeof studentSchema>
          open={!!editingStudent}
          onOpenChange={(open) => !open && setEditingStudent(null)}
          title="Edit Student Profile"
          description={`Update details for ${editingStudent.firstName} ${editingStudent.lastName || ''}.`}
          schema={studentSchema}
          className="sm:max-w-2xl"
          defaultValues={{
            firstName: editingStudent.firstName || '',
            lastName: editingStudent.lastName || '',
            email: editingStudent.user?.email || '',
            rollNumber: editingStudent.rollNumber || '',
            collegeId: editingStudent.collegeId || '',
            departmentId: isAdmin
              ? ((user as any)?.adminProfile?.departmentId || (user as any)?.departmentId || '')
              : (editingStudent.departmentId || ''),
            gender: editingStudent.gender || 'MALE',
            password: '',
            photoKey: editingStudent.photoKey || '',
            bloodGroup: editingStudent.bloodGroup || '',
            emergencyContactName: editingStudent.emergencyContactName || '',
            emergencyContactPhone: editingStudent.emergencyContactPhone || '',
            address: editingStudent.address || '',
          }}
          onSubmit={handleUpdateStudent}
          submitLabel="Save Changes"
        >
          {(form) => (
            <>
              {/* Photo section — Admin restricted */}
              <div className="border border-dashed border-border rounded-lg p-4 mb-2 bg-muted/20">
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    {photoPreviewUrl ? (
                      <img
                        src={photoPreviewUrl}
                        alt="Student Photo Preview"
                        className="w-24 h-24 rounded-lg object-cover border-2 border-border bg-background"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center text-muted-foreground">
                        <GraduationCap className="w-8 h-8 mb-1 opacity-60" />
                        <span className="text-[10px]">No photo</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <span className="text-sm font-semibold block">Profile Photo</span>
                    {isAdmin ? (
                      <>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={photoUploading}
                          className="text-xs w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('Photo size must be ≤ 5MB.');
                              return;
                            }
                            // Instant local preview
                            const localUrl = URL.createObjectURL(file);
                            setPhotoPreviewUrl(localUrl);

                            const formData = new FormData();
                            formData.append('file', file);
                            setPhotoUploading(true);
                            try {
                              const res = await api.patch(`/students/${editingStudent.id}/photo`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' },
                              });
                              if (res.data?.success) {
                                form.setValue('photoKey', res.data.data.photoKey);
                                toast.success('Student photo updated in R2!');
                              }
                            } catch (err: any) {
                              toast.error(err.response?.data?.message || 'Failed to update photo.');
                            } finally {
                              setPhotoUploading(false);
                            }
                          }}
                        />
                        {photoUploading && (
                          <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
                        )}
                        <p className="text-[10px] text-muted-foreground">JPG, PNG, or WebP · Max 5 MB</p>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Photo edits restricted to ADMIN
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Priya" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Singh" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rollNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roll Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 10123" {...field} className="uppercase" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="collegeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>College ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. BIT/2026/001" {...field} className="uppercase" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={(user as any)?.adminProfile?.department?.name || (user as any)?.departmentName || 'Assigned Department'}
                    disabled
                    className="bg-muted text-muted-foreground font-medium cursor-not-allowed"
                  />
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="">Select Department</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name} ({dept.code})
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bloodGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Group</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Guardian Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="10-digit number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Residential Address</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={2}
                        placeholder="Full residential address (street, city, state, pin code)"
                        className="w-full text-xs bg-background border border-input rounded-md px-3 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </FormDialog>
      )}

      {/* Deactivate Student Confirmation */}
      <AlertDialog
        open={!!deactivatingStudent}
        onOpenChange={(open) => !open && setDeactivatingStudent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-semibold text-foreground">
                {deactivatingStudent?.firstName} {deactivatingStudent?.lastName || ''} ({deactivatingStudent?.rollNumber})
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivateStudent}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Read-Only Details Modal */}
      {detailItem && (
        <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="capitalize flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                {detailItem.type.slice(0, -1)} Details
              </DialogTitle>
              <DialogDescription>
                Full details for this {detailItem.type.slice(0, -1)} record.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              {detailItem.type === 'students' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg border border-border">
                    <StudentAvatar
                      photoKey={detailItem.item.photoKey}
                      alt={`${detailItem.item.firstName || ''} ${detailItem.item.lastName || ''}`}
                      className="w-14 h-14"
                    />
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        {`${detailItem.item.firstName || ''} ${detailItem.item.lastName || ''}`.trim()}
                      </h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        {detailItem.item.rollNumber} • {detailItem.item.collegeId}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Enrollment No</span>
                      <p className="font-mono text-foreground">{detailItem.item.enrollmentNumber || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Email</span>
                      <p className="text-foreground">{detailItem.item.user?.email || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Phone</span>
                      <p className="text-foreground">{detailItem.item.phone || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Department</span>
                      <p className="text-foreground">{getDepartmentName(detailItem.item)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Gender</span>
                      <p className="text-foreground">{detailItem.item.gender || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Blood Group</span>
                      <p className="text-foreground font-semibold text-primary">
                        {detailItem.item.bloodGroup ? detailItem.item.bloodGroup.replace('_POSITIVE', '+').replace('_NEGATIVE', '-') : '—'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Date of Birth</span>
                      <p className="text-foreground">
                        {detailItem.item.dateOfBirth ? new Date(detailItem.item.dateOfBirth).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-muted-foreground">Emergency Contact Name</span>
                      <p className="text-foreground">{detailItem.item.emergencyContactName || '—'}</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <span className="font-semibold text-muted-foreground">Emergency Contact Phone</span>
                      <p className="text-foreground font-mono">{detailItem.item.emergencyContactPhone || '—'}</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <span className="font-semibold text-muted-foreground">Residential Address</span>
                      <p className="text-foreground">{detailItem.item.address || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {detailItem.type === 'faculty' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Full Name</span>
                    <p className="font-medium text-foreground">{`${detailItem.item.firstName || ''} ${detailItem.item.lastName || ''}`.trim() || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Employee Code</span>
                    <p className="font-mono font-medium text-foreground">{detailItem.item.employeeCode || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Designation</span>
                    <p className="text-foreground">{detailItem.item.designation || 'Faculty'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Department</span>
                    <p className="text-foreground">{getDepartmentName(detailItem.item)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Email</span>
                    <p className="text-foreground">{detailItem.item.user?.email || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Phone</span>
                    <p className="text-foreground">{detailItem.item.phone || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Gender</span>
                    <p className="text-foreground">{detailItem.item.gender || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Date of Birth</span>
                    <p className="text-foreground">
                      {detailItem.item.dateOfBirth ? new Date(detailItem.item.dateOfBirth).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
              )}

              {detailItem.type === 'programs' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Program Name</span>
                    <p className="font-medium text-foreground">{detailItem.item.name || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Program Code</span>
                    <p className="font-mono font-medium text-foreground">{detailItem.item.code || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Short Name</span>
                    <p className="text-foreground">{detailItem.item.shortName || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Department</span>
                    <p className="text-foreground">{detailItem.item.department?.name || getDepartmentName(detailItem.item)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Duration</span>
                    <p className="text-foreground">{detailItem.item.durationYears ? `${detailItem.item.durationYears} Years` : '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Status</span>
                    <p className="text-foreground">{detailItem.item.isActive !== false ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
              )}

              {detailItem.type === 'subjects' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Subject Name</span>
                    <p className="font-medium text-foreground">{detailItem.item.name || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Subject Code</span>
                    <p className="font-mono font-medium text-foreground">{detailItem.item.code || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Academic Year</span>
                    <p className="text-foreground">
                      {detailItem.item.year
                        ? `${detailItem.item.year === 1 ? '1st' : detailItem.item.year === 2 ? '2nd' : detailItem.item.year === 3 ? '3rd' : `${detailItem.item.year}th`} Year`
                        : '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Semester</span>
                    <p className="text-foreground">
                      {semestersList.find((s: any) => s.id === detailItem.item.semesterId)?.name || detailItem.item.semester?.name || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Subject Type</span>
                    <p className="text-foreground">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${detailItem.item.isLab ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-primary/10 text-primary border border-primary/20'
                        }`}>
                        {detailItem.item.isLab ? 'Laboratory' : 'Theory'}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Status</span>
                    <p className="text-foreground">{detailItem.item.isActive !== false ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
              )}

              {detailItem.type === 'rooms' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Room Code</span>
                    <p className="font-mono font-medium text-foreground">{detailItem.item.code || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Room Name</span>
                    <p className="font-medium text-foreground">{detailItem.item.name || detailItem.item.code || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Building</span>
                    <p className="text-foreground">{detailItem.item.building || 'Main Campus'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Floor</span>
                    <p className="text-foreground">{detailItem.item.floor !== undefined ? `Floor ${detailItem.item.floor}` : '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Capacity</span>
                    <p className="font-mono text-foreground">{detailItem.item.capacity ? `${detailItem.item.capacity} seats` : '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Status</span>
                    <p className="text-foreground">{detailItem.item.isActive !== false ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setDetailItem(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
