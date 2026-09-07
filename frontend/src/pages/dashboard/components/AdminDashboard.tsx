import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Users, GraduationCap, Building2, CheckCircle, Search, Plus, Trash2, Edit3, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
}

interface StudentRecord {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  batch: string;
}

interface CoordinatorRecord {
  id: string;
  name: string;
  email: string;
  program: string;
}

interface CourseRule {
  id: string;
  courseName: string;
  code: string;
  requiredAttendance: number;
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const departmentDisplayName =
    (user as any)?.departmentName ||
    (user as any)?.adminProfile?.department?.name ||
    (user as any)?.department?.name ||
    (user as any)?.department?.shortName ||
    null;
  const [activeTab, setActiveTab] = useState<'overview' | 'faculty' | 'students' | 'coordinators' | 'policies'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Faculty-specific form fields
  const [facFirstName, setFacFirstName] = useState('');
  const [facLastName, setFacLastName] = useState('');
  const [facGender, setFacGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [facDob, setFacDob] = useState('');
  const [facPhone, setFacPhone] = useState('');

  // Database-backed state arrays
  const [faculties, setFaculties] = useState<FacultyMember[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [coordinators, setCoordinators] = useState<CoordinatorRecord[]>([]);
  const [rules, setRules] = useState<CourseRule[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // Overview stats & setup helpers
  const [departmentsCount, setDepartmentsCount] = useState(0);
  const [departmentsList, setDepartmentsList] = useState('Loading departments...');
  const [defaultSemesterId, setDefaultSemesterId] = useState('');

  // Modals visibility states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Active selection item
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Generic form fields used for shared inputs
  const [fieldA, setFieldA] = useState('');
  const [fieldB, setFieldB] = useState('');
  const [fieldC, setFieldC] = useState('');
  const [fieldD, setFieldD] = useState('');

  // Fetch all dashboard data from backend
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch departments (Only for SUPER_ADMIN, as ADMIN is restricted from departments endpoint)
      if ((user as any)?.role === 'SUPER_ADMIN' || user?.role?.code === 'SUPER_ADMIN') {
        try {
          const deptRes = await api.get('/academic/departments');
          if (deptRes.data?.success) {
            const depts = deptRes.data.data || [];
            setDepartmentsCount(depts.length);
            if (depts.length > 0) {
              setDepartmentsList(depts.slice(0, 3).map((d: any) => d.shortName || d.name).join(', ') + (depts.length > 3 ? '...' : ''));
            } else {
              setDepartmentsList('No departments registered.');
            }
          }
        } catch {
          setDepartmentsCount(1);
          setDepartmentsList(departmentDisplayName || 'Assigned Department');
        }
      } else {
        setDepartmentsCount(1);
        setDepartmentsList(departmentDisplayName || 'Assigned Department');
      }

      // 2. Fetch faculty list
      try {
        const facRes = await api.get('/faculty');
        if (facRes.data?.success) {
          const facs = facRes.data.data || [];
          setFaculties(facs.map((f: any) => ({
            id: f.id,
            name: `${f.firstName} ${f.lastName || ''}`.trim(),
            email: f.user?.email || '',
            department: (user as any)?.adminProfile?.department?.name || (user as any)?.departmentName || departmentDisplayName || 'Assigned Department',
            designation: f.designation,
            gender: f.gender,
            dateOfBirth: f.dateOfBirth ? f.dateOfBirth.split('T')[0] : '',
            phone: f.phone || '',
          })));
        }
      } catch (err) {
        console.error('Failed to fetch faculty:', err);
      }

      // 3. Fetch students list
      try {
        const studRes = await api.get('/students');
        if (studRes.data?.success) {
          const studs = studRes.data.data || [];
          setStudents(studs.map((s: any) => {
            const roll = s.rollNumber || '';
            let department = (user as any)?.adminProfile?.department?.name || (user as any)?.departmentName || departmentDisplayName || 'Assigned Department';
            let batch = '2023-27';
            if (roll.startsWith('MEB')) {
              department = 'Mechanical Eng.';
            } else if (roll.startsWith('MAB')) {
              department = 'Mathematics';
            }
            if (roll.match(/\d+/)) {
              const yearDigits = roll.match(/\d+/)[0].substring(0, 2);
              if (yearDigits) {
                const startYear = parseInt('20' + yearDigits);
                batch = `${startYear}-${startYear + 4}`;
              }
            }
            return {
              id: s.id,
              name: `${s.firstName} ${s.lastName || ''}`.trim(),
              rollNumber: s.rollNumber,
              department,
              batch,
            };
          }));
        }
      } catch (err) {
        console.error('Failed to fetch students:', err);
      }

      // 4. Fetch coordinators list
      try {
        const coordRes = await api.get('/auth/coordinators');
        if (coordRes.data?.success) {
          setCoordinators(coordRes.data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch coordinators:', err);
      }

      // 5. Fetch course rules
      try {
        const subRes = await api.get('/academic/departments/subjects');
        if (subRes.data?.success) {
          const subs = subRes.data.data || [];
          setRules(subs.map((s: any) => ({
            id: s.id,
            courseName: s.name,
            code: s.code,
            requiredAttendance: 75,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
      }

      // 6. Fetch pending approvals
      try {
        const reqRes = await api.get('/requests');
        if (reqRes.data?.success) {
          const reqs = reqRes.data.data || [];
          setPendingApprovals(reqs.filter((r: any) => r.status === 'PENDING'));
        }
      } catch (err) {
        console.error('Failed to fetch requests:', err);
      }

      // 7. Load default parameters for policy links
      try {
        const semRes = await api.get('/academic/departments/semesters');
        if (semRes.data?.success && semRes.data.data?.length > 0) {
          setDefaultSemesterId(semRes.data.data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch semesters:', err);
      }

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      toast.error('Failed to sync live dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setFieldA('');
    setFieldB('');
    setFieldC('');
    setFieldD('');
    setFacFirstName('');
    setFacLastName('');
    setFacGender('MALE');
    setFacDob('');
    setFacPhone('');
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab !== 'faculty' && (!fieldA || !fieldB || !fieldC)) {
      toast.error('Required fields must be filled.');
      return;
    }
    if (activeTab === 'faculty' && (!facFirstName || !fieldB)) {
      toast.error('First Name and Email are required.');
      return;
    }

    // Email validation for faculty
    if (activeTab === 'faculty') {
      const email = fieldB.trim();
      if (!/^[a-zA-Z0-9._%+-]+@bit\.ac\.in$/.test(email)) {
        toast.error('Only official @bit.ac.in email addresses are allowed.');
        return;
      }
    }

    // Phone number validation for faculty
    let formattedPhone = undefined;
    if (activeTab === 'faculty' && facPhone.trim() !== '') {
      const digits = facPhone.replace(/[^0-9]/g, '');
      const isTenDigits = digits.length === 10;
      const isTwelveDigitsWith91 = digits.length === 12 && digits.startsWith('91');
      
      if (!isTenDigits && !isTwelveDigitsWith91) {
        toast.error('Phone number must be exactly 10 digits.');
        return;
      }

      if (isTenDigits) {
        formattedPhone = `+91${digits}`;
      } else {
        formattedPhone = `+91${digits.substring(2)}`;
      }
    }

    try {
      if (activeTab === 'faculty') {
        const employeeCode = 'FAC-' + Date.now().toString().slice(-6);

        await api.post('/faculty/accounts', {
          email: fieldB,
          password: 'Temp@12345',
          employeeCode,
          firstName: facFirstName,
          lastName: facLastName,
          gender: facGender,
          dateOfBirth: facDob || undefined,
          phone: formattedPhone,
          designation: fieldD || 'Lecturer',
        });
        toast.success('Faculty member account created successfully.');
      } else if (activeTab === 'students') {
        const nameParts = fieldA.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        const collegeId = 'COL-' + Date.now().toString().slice(-6);
        const enrollmentNumber = 'ENR-' + Date.now().toString().slice(-6);

        await api.post('/students/accounts', {
          email: fieldC,
          password: 'Temp@12345',
          collegeId,
          rollNumber: fieldB,
          enrollmentNumber,
          firstName,
          lastName,
          gender: 'MALE',
        });
        toast.success('Student account registered successfully.');
      } else if (activeTab === 'coordinators') {
        await api.post('/auth/coordinators', {
          email: fieldB,
          password: 'Temp@12345',
        });
        toast.success('Coordinator registered.');
      } else if (activeTab === 'policies') {
        if (!defaultSemesterId) {
          toast.error('Semester parameters missing in database.');
          return;
        }
        await api.post('/academic/departments/subjects', {
          code: fieldB,
          name: fieldA,
          year: 1,
          semesterId: defaultSemesterId,
          isLab: false,
        });
        toast.success('Course attendance threshold registered.');
      }
      setIsCreateOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to create record.');
    }
  };

  const handleOpenEdit = (item: any) => {
    setSelectedItem(item);
    if (activeTab === 'faculty') {
      const nameParts = item.name.split(' ');
      setFacFirstName(nameParts[0] || '');
      setFacLastName(nameParts.slice(1).join(' ') || '');
      setFacGender((item.gender as any) || 'MALE');
      setFacDob(item.dateOfBirth || '');
      setFacPhone(item.phone || '');
      setFieldB(item.email);
      setFieldC(item.department);
      setFieldD(item.designation);
    } else if (activeTab === 'students') {
      setFieldA(item.name);
      setFieldB(item.rollNumber);
      setFieldC(item.department);
      setFieldD(item.batch);
    } else if (activeTab === 'coordinators') {
      setFieldA(item.name);
      setFieldB(item.email);
      setFieldC(item.program);
    } else if (activeTab === 'policies') {
      setFieldA(item.courseName);
      setFieldB(item.code);
      setFieldC(String(item.requiredAttendance));
    }
    setIsEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab !== 'faculty' && (!fieldA || !fieldB || !fieldC)) return;
    if (activeTab === 'faculty' && (!facFirstName || !fieldB)) return;

    // Email validation for faculty
    if (activeTab === 'faculty') {
      const email = fieldB.trim();
      if (!/^[a-zA-Z0-9._%+-]+@bit\.ac\.in$/.test(email)) {
        toast.error('Only official @bit.ac.in email addresses are allowed.');
        return;
      }
    }

    // Phone number validation for faculty
    let formattedPhone = undefined;
    if (activeTab === 'faculty' && facPhone.trim() !== '') {
      const digits = facPhone.replace(/[^0-9]/g, '');
      const isTenDigits = digits.length === 10;
      const isTwelveDigitsWith91 = digits.length === 12 && digits.startsWith('91');
      
      if (!isTenDigits && !isTwelveDigitsWith91) {
        toast.error('Phone number must be exactly 10 digits.');
        return;
      }

      if (isTenDigits) {
        formattedPhone = `+91${digits}`;
      } else {
        formattedPhone = `+91${digits.substring(2)}`;
      }
    }

    try {
      if (activeTab === 'faculty') {
        await api.patch(`/faculty/${selectedItem.id}`, {
          firstName: facFirstName,
          lastName: facLastName,
          designation: fieldD,
          gender: facGender,
          dateOfBirth: facDob || undefined,
          phone: formattedPhone,
        });
        toast.success('Faculty member details updated successfully.');
      } else if (activeTab === 'students') {
        const nameParts = fieldA.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        await api.patch(`/students/${selectedItem.id}`, {
          firstName,
          lastName,
          rollNumber: fieldB,
        });
        toast.success('Student record updated.');
      } else if (activeTab === 'coordinators') {
        await api.patch(`/auth/coordinators/${selectedItem.id}`, {
          email: fieldB,
        });
        toast.success('Coordinator details updated.');
      } else if (activeTab === 'policies') {
        await api.patch(`/academic/departments/subjects/${selectedItem.id}`, {
          name: fieldA,
          code: fieldB,
        });
        toast.success('Course attendance threshold modified.');
      }
      setIsEditOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update record.');
    }
  };

  const handleOpenDelete = (item: any) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      if (activeTab === 'faculty') {
        await api.patch(`/faculty/${selectedItem.id}/deactivate`);
      } else if (activeTab === 'students') {
        await api.patch(`/students/${selectedItem.id}/deactivate`);
      } else if (activeTab === 'coordinators') {
        await api.delete(`/auth/coordinators/${selectedItem.id}`);
      } else if (activeTab === 'policies') {
        await api.patch(`/academic/departments/subjects/${selectedItem.id}/deactivate`);
      }
      setIsDeleteOpen(false);
      toast.success('Record deactivated/removed successfully.');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to terminate record.');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/requests/${id}`, { status: 'APPROVED' });
      toast.success('Request approved successfully.');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to approve request.');
    }
  };

  return (
    <div className="space-y-6 font-sans select-none">

      {/* Brand Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">ASSAM Institutional Control</span>
          <h2 className="text-2xl font-semibold tracking-tight text-ink mt-0.5">Management Dashboard</h2>
          <p className="text-xs text-ink-muted-80">Oversee curricula settings, assign coordinators, and enroll faculties or rosters.</p>
        </div>

        {/* Navigation Tabs & Department Badge */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Green Tag */}
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 shadow-2xs hover:bg-emerald-50">
            <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{departmentDisplayName || 'Unassigned'}</span>
          </Badge>

          {/* Navigation Tabs (Apple capsule style) */}
          <div className="flex flex-wrap bg-canvas-parchment p-1 rounded-full border">
            {['overview', 'faculty', 'students', 'coordinators', 'policies'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab as any);
                  setSearchQuery('');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer capitalize ${
                  activeTab === tab ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
                }`}
              >
                {tab === 'policies' ? 'Rules & Policies' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- Tab Content: Overview --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Departments</span>
                <Building2 className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">{departmentsCount}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">{departmentsList}</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Active Faculty</span>
                <Users className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">{faculties.length}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Registered lecturers</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Students Roster</span>
                <GraduationCap className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">{students.length}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Enrolled students</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Pending Tasks</span>
                <CheckCircle className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">{pendingApprovals.length}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Awaiting administrative actions</p>
              </div>
            </Card>
          </div>

          <div className="bg-white border border-[#e0e0e0] rounded-[18px] p-6">
            <div className="flex items-center gap-2 pb-4 border-b mb-6">
              <ShieldAlert className="h-5 w-5 text-action-blue" />
              <div>
                <h3 className="text-sm font-semibold text-ink mt-0.5">Recent Requests & Approvals</h3>
                <p className="text-[10px] text-ink-muted-48">Audit log of system overrides and scheduling shifts.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-action-blue"></div>
                <p className="text-xs text-ink-muted-48">Loading requests...</p>
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="text-center py-6 text-ink-muted-48 text-xs">No pending requests require attention.</div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((req) => (
                  <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-canvas-parchment/30 rounded-xl border border-[#e5e5e5] hover:border-action-blue/20 transition-colors">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-ink">{req.title}</span>
                      <p className="text-[11px] text-ink-muted-80 leading-relaxed">{req.details}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200/50 text-[9px] hover:bg-amber-50">Pending Approval</Badge>
                        <span className="text-[9px] text-ink-muted-48">Requested by: {req.requester}</span>
                      </div>
                    </div>
                    <Button onClick={() => handleApprove(req.id)} size="sm" className="bg-action-blue hover:opacity-95 text-white rounded-full text-xs font-semibold px-4 py-1 h-8">
                      Approve Request
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Management Tabs: Faculty / Students / Coordinators / Policies (CRUD Lists) --- */}
      {activeTab !== 'overview' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b mb-6">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-ink-muted-48" />
              <Input
                type="search"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 rounded-full border-[#e0e0e0]"
              />
            </div>
            
            {activeTab !== 'policies' && (
              <Button onClick={handleOpenCreate} className="bg-action-blue hover:opacity-95 text-white w-full sm:w-auto rounded-full">
                <Plus className="h-4 w-4 mr-2" /> Add {activeTab.slice(0, -1)}
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-action-blue"></div>
                <p className="text-xs text-ink-muted-48">Syncing registry records...</p>
              </div>
            ) : (
              <>
                {activeTab === 'faculty' && (
                  faculties.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="text-center py-12 text-ink-muted-48 text-xs">No registered teaching faculty found.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Name</TableHead>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Email</TableHead>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Phone</TableHead>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Designation</TableHead>
                          <TableHead className="w-[100px] text-right text-xs font-bold text-ink-muted-80">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {faculties.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((f) => (
                          <TableRow key={f.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                            <TableCell className="font-semibold text-xs text-ink">{f.name}</TableCell>
                            <TableCell className="text-xs text-ink-muted-80">{f.email}</TableCell>
                            <TableCell className="text-xs text-ink-muted-80">{f.phone || 'N/A'}</TableCell>
                            <TableCell className="text-xs text-ink-muted-80">{f.designation}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => handleOpenEdit(f)} className="p-1.5 rounded-full bg-canvas-parchment text-ink-muted-80 hover:text-action-blue cursor-pointer"><Edit3 className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleOpenDelete(f)} className="p-1.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                )}

                {activeTab === 'students' && (
                  students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="text-center py-12 text-ink-muted-48 text-xs">No registered students found.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Student Name</TableHead>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Roll Number</TableHead>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Department</TableHead>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Batch</TableHead>
                          <TableHead className="w-[100px] text-right text-xs font-bold text-ink-muted-80">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map((s) => (
                          <TableRow key={s.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                            <TableCell className="font-semibold text-xs text-ink">{s.name}</TableCell>
                            <TableCell className="text-xs font-mono">{s.rollNumber}</TableCell>
                            <TableCell className="text-xs text-ink-muted-80">{s.department}</TableCell>
                            <TableCell className="text-xs text-ink-muted-80">{s.batch}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => handleOpenEdit(s)} className="p-1.5 rounded-full bg-canvas-parchment text-ink-muted-80 hover:text-action-blue cursor-pointer"><Edit3 className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleOpenDelete(s)} className="p-1.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                )}

                {activeTab === 'coordinators' && (
                  coordinators.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="text-center py-12 text-ink-muted-48 text-xs">No registered academic coordinators found.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Name</TableHead>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Email</TableHead>
                          <TableHead className="text-xs font-bold text-ink-muted-80">Assigned Scope / Program</TableHead>
                          <TableHead className="w-[100px] text-right text-xs font-bold text-ink-muted-80">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coordinators.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((c) => (
                          <TableRow key={c.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                            <TableCell className="font-semibold text-xs text-ink">{c.name}</TableCell>
                            <TableCell className="text-xs text-ink-muted-80">{c.email}</TableCell>
                            <TableCell className="text-xs text-ink-muted-80">{c.program}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => handleOpenEdit(c)} className="p-1.5 rounded-full bg-canvas-parchment text-ink-muted-80 hover:text-action-blue cursor-pointer"><Edit3 className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleOpenDelete(c)} className="p-1.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                )}

                {activeTab === 'policies' && (
                  rules.filter(r => r.courseName.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="text-center py-12 text-ink-muted-48 text-xs">No course attendance rules or policies found.</div>
                  ) : (
                    <div>
                      <div className="mb-3 px-1 flex items-center justify-between">
                        <span className="text-xs text-ink-muted-80">
                          Course attendance rules and subjects are centrally managed by <strong>SUPER_ADMIN</strong>.
                        </span>
                        <Badge variant="outline" className="text-[10px] text-ink-muted-80">Read-Only Scope</Badge>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs font-bold text-ink-muted-80">Course Subject</TableHead>
                            <TableHead className="text-xs font-bold text-ink-muted-80">Subject Code</TableHead>
                            <TableHead className="text-xs font-bold text-ink-muted-80">Required Attendance Ratio</TableHead>
                            <TableHead className="w-[80px] text-right text-xs font-bold text-ink-muted-80">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rules.filter(r => r.courseName.toLowerCase().includes(searchQuery.toLowerCase())).map((r) => (
                            <TableRow key={r.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                              <TableCell className="font-semibold text-xs text-ink">{r.courseName}</TableCell>
                              <TableCell className="text-xs font-mono">{r.code}</TableCell>
                              <TableCell className="text-xs text-ink-muted-80">
                                <Badge className="bg-action-blue/10 text-action-blue border-none text-[10px]">
                                  {r.requiredAttendance}% Attendance
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary" className="text-[10px]">Active</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* --- CRUD Dialog Forms --- */}

      {/* Create Dialog Form */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-[18px] bg-white border border-[#e0e0e0] shadow-none w-11/12 max-w-md font-sans">
          <form onSubmit={handleCreate}>
            <DialogHeader className="pb-3 border-b mb-4">
              <DialogTitle className="text-base font-semibold text-ink">
                Create {activeTab === 'faculty' ? 'Faculty Member' : activeTab === 'students' ? 'Student Record' : activeTab === 'coordinators' ? 'Coordinator' : 'Course Rule'}
              </DialogTitle>
              <DialogDescription className="text-xs text-ink-muted-80">Register new record parameters in administrative scopes.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {activeTab === 'faculty' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink">First Name</label>
                      <Input
                        type="text"
                        placeholder="e.g. Ramesh"
                        value={facFirstName}
                        onChange={(e) => setFacFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink">Last Name</label>
                      <Input
                        type="text"
                        placeholder="e.g. Baruah"
                        value={facLastName}
                        onChange={(e) => setFacLastName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink">Gender</label>
                      <select
                        value={facGender}
                        onChange={(e) => setFacGender(e.target.value as any)}
                        className="flex h-9 w-full rounded-md border border-[#e0e0e0] bg-transparent px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink">Date of Birth</label>
                      <Input
                        type="date"
                        value={facDob}
                        onChange={(e) => setFacDob(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-ink">Phone Number (10 digits)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs text-ink-muted-80 font-semibold select-none">+91</span>
                      <Input
                        type="tel"
                        placeholder="9876543210"
                        value={facPhone.replace(/^\+91/, '')}
                        onChange={(e) => setFacPhone(e.target.value)}
                        className="pl-10 rounded-md border-[#e0e0e0]"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">
                    {activeTab === 'policies' ? 'Course Title' : 'Full Name'}
                  </label>
                  <Input
                    type="text"
                    placeholder={activeTab === 'policies' ? 'e.g. Computer Networks' : 'e.g. Prof. Ramesh Baruah'}
                    value={fieldA}
                    onChange={(e) => setFieldA(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">
                  {activeTab === 'students' ? 'Roll Number' : activeTab === 'policies' ? 'Course Code' : 'Email Address'}
                </label>
                <Input
                  type="text"
                  placeholder={activeTab === 'students' ? 'CSB23011' : activeTab === 'policies' ? 'CS-301' : 'user@inca.edu'}
                  value={fieldB}
                  onChange={(e) => setFieldB(e.target.value)}
                  required
                />
              </div>

              {activeTab !== 'faculty' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">
                    {activeTab === 'policies' ? 'Required Attendance Percentage (%)' : 'Department'}
                  </label>
                  <Input
                    type="text"
                    placeholder={activeTab === 'policies' ? '75' : 'e.g. Computer Science'}
                    value={fieldC}
                    onChange={(e) => setFieldC(e.target.value)}
                    required
                  />
                </div>
              )}

              {(activeTab === 'faculty' || activeTab === 'students') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">
                    {activeTab === 'faculty' ? 'Designation' : 'Batch / Program'}
                  </label>
                  <Input
                    type="text"
                    placeholder={activeTab === 'faculty' ? 'e.g. Associate Professor' : 'e.g. 2023-27'}
                    value={fieldD}
                    onChange={(e) => setFieldD(e.target.value)}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 border-t pt-3 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-full">
                Cancel
              </Button>
              <Button type="submit" className="bg-action-blue text-white rounded-full">
                Save Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog Form */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-[18px] bg-white border border-[#e0e0e0] shadow-none w-11/12 max-w-md font-sans">
          <form onSubmit={handleEdit}>
            <DialogHeader className="pb-3 border-b mb-4">
              <DialogTitle className="text-base font-semibold text-ink">Modify Record</DialogTitle>
              <DialogDescription className="text-xs text-ink-muted-80">Update values for select registry.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {activeTab === 'faculty' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink">First Name</label>
                      <Input
                        type="text"
                        value={facFirstName}
                        onChange={(e) => setFacFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink">Last Name</label>
                      <Input
                        type="text"
                        value={facLastName}
                        onChange={(e) => setFacLastName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink">Gender</label>
                      <select
                        value={facGender}
                        onChange={(e) => setFacGender(e.target.value as any)}
                        className="flex h-9 w-full rounded-md border border-[#e0e0e0] bg-transparent px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink">Date of Birth</label>
                      <Input
                        type="date"
                        value={facDob}
                        onChange={(e) => setFacDob(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-ink">Phone Number (10 digits)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs text-ink-muted-80 font-semibold select-none">+91</span>
                      <Input
                        type="tel"
                        placeholder="9876543210"
                        value={facPhone.replace(/^\+91/, '')}
                        onChange={(e) => setFacPhone(e.target.value)}
                        className="pl-10 rounded-md border-[#e0e0e0]"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">
                    {activeTab === 'policies' ? 'Course Title' : 'Full Name'}
                  </label>
                  <Input
                    type="text"
                    value={fieldA}
                    onChange={(e) => setFieldA(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">
                  {activeTab === 'students' ? 'Roll Number' : activeTab === 'policies' ? 'Course Code' : 'Email Address'}
                </label>
                <Input
                  type="text"
                  value={fieldB}
                  onChange={(e) => setFieldB(e.target.value)}
                  required
                />
              </div>

              {activeTab !== 'faculty' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">
                    {activeTab === 'policies' ? 'Required Attendance Percentage (%)' : 'Department'}
                  </label>
                  <Input
                    type="text"
                    value={fieldC}
                    onChange={(e) => setFieldC(e.target.value)}
                    required
                  />
                </div>
              )}

              {(activeTab === 'faculty' || activeTab === 'students') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">
                    {activeTab === 'faculty' ? 'Designation' : 'Batch / Program'}
                  </label>
                  <Input
                    type="text"
                    value={fieldD}
                    onChange={(e) => setFieldD(e.target.value)}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 border-t pt-3 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-full">
                Cancel
              </Button>
              <Button type="submit" className="bg-action-blue text-white rounded-full">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Warning Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-[18px] bg-white border border-[#e0e0e0] shadow-none w-11/12 max-w-sm font-sans">
          <AlertDialogHeader className="pb-2 border-b">
            <AlertDialogTitle className="text-base font-semibold text-ink">Delete Record</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-ink-muted-80">
              Are you sure? This will terminate <strong className="text-ink">{selectedItem?.name || selectedItem?.courseName}</strong> permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-3 flex gap-2 justify-end">
            <AlertDialogCancel className="rounded-full text-xs font-semibold cursor-pointer border-[#e0e0e0]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white rounded-full text-xs font-semibold cursor-pointer">
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
