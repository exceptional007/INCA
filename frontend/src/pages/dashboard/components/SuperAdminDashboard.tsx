import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Building2, Users, ShieldCheck, Activity, Search, Plus, Trash2, Edit3, Settings, AlertTriangle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/api/axios';
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

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName: string;
  departmentCode?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface Department {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  isActive: boolean;
}

interface AuditLog {
  id: string;
  event: string;
  details: string;
  time: string;
  createdAt?: string;
}

interface SystemStats {
  connectedDepartments?: {
    count: number;
    subtitle: string;
  };
  connectedInstitutions?: {
    count: number;
    subtitle: string;
  };
  totalActiveUsers: {
    count: number;
    subtitle: string;
  };
  systemHealth: {
    status: string;
    latencyMs: number;
    uptimePercentage: number | null;
    subtitle: string;
  };
  totalAdmins: {
    count: number;
    subtitle: string;
  };
}

export const SuperAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'admins' | 'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real backend-driven state
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Loading states
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isAdminsLoading, setIsAdminsLoading] = useState(true);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(true);
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CRUD Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // Selected admin for Edit/Delete
  const [selectedAdmin, setSelectedAdmin] = useState<AdminAccount | null>(null);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDepartmentId, setFormDepartmentId] = useState('');

  // Settings State
  const [academicPeriod, setAcademicPeriod] = useState('');
  const [minAttendance, setMinAttendance] = useState(75);
  const [editWindow, setEditWindow] = useState(24);
  const [allowFacultyOverride, setAllowFacultyOverride] = useState(true);

  // Data fetchers
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const response = await api.get('/super-admin/stats');
      if (response.data?.success && response.data?.data) {
        setStats(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to load system statistics', error);
      toast.error(error.response?.data?.message || 'Failed to load system statistics.');
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    setIsDepartmentsLoading(true);
    try {
      const response = await api.get('/academic/departments');
      if (response.data?.success && Array.isArray(response.data?.data)) {
        // Only active departments are valid for assignment
        const activeOnly = response.data.data.filter((d: Department) => d.isActive);
        setDepartments(activeOnly);
      }
    } catch (error: any) {
      console.error('Failed to load departments', error);
      toast.error(error.response?.data?.message || 'Failed to load departments list.');
    } finally {
      setIsDepartmentsLoading(false);
    }
  }, []);

  const fetchAdmins = useCallback(async () => {
    setIsAdminsLoading(true);
    try {
      const response = await api.get('/auth/admins');
      if (response.data?.success && response.data?.data) {
        setAdmins(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to load admin accounts', error);
      toast.error(error.response?.data?.message || 'Failed to load admin accounts.');
    } finally {
      setIsAdminsLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLogsLoading(true);
    try {
      const response = await api.get('/super-admin/audit-logs');
      if (response.data?.success && response.data?.data) {
        setLogs(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to load audit logs', error);
      toast.error(error.response?.data?.message || 'Failed to load audit logs.');
    } finally {
      setIsLogsLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    setIsSettingsLoading(true);
    try {
      const response = await api.get('/super-admin/settings');
      if (response.data?.success && response.data?.data) {
        const s = response.data.data;
        setAcademicPeriod(s.academicPeriod || '');
        setMinAttendance(s.minAttendance ?? 75);
        setEditWindow(s.editWindow ?? 24);
        setAllowFacultyOverride(s.allowFacultyOverride ?? true);
      }
    } catch (error: any) {
      console.error('Failed to load system settings', error);
      toast.error(error.response?.data?.message || 'Failed to load system settings.');
    } finally {
      setIsSettingsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchDepartments();
    fetchAdmins();
    fetchLogs();
    fetchSettings();
  }, [fetchStats, fetchDepartments, fetchAdmins, fetchLogs, fetchSettings]);

  const handleOpenCreate = () => {
    setFormName('');
    setFormEmail('');
    setFormDepartmentId(departments.length > 0 ? departments[0].id : '');
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    if (!formDepartmentId) {
      toast.error('Department selection is mandatory.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/auth/admins', {
        name: formName.trim(),
        email: formEmail.trim(),
        departmentId: formDepartmentId,
      });
      if (response.data?.success) {
        toast.success('Department Admin account created successfully.');
        setIsCreateOpen(false);
        await Promise.all([fetchAdmins(), fetchStats(), fetchLogs()]);
      }
    } catch (error: any) {
      console.error('Failed to create admin account', error);
      toast.error(error.response?.data?.message || 'Failed to create admin account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (admin: AdminAccount) => {
    setSelectedAdmin(admin);
    setFormName(admin.name);
    setFormEmail(admin.email);
    setFormDepartmentId(admin.departmentId || (departments.length > 0 ? departments[0].id : ''));
    setIsEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    if (!formDepartmentId) {
      toast.error('Department selection is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.patch(`/auth/admins/${selectedAdmin.id}`, {
        name: formName.trim(),
        email: formEmail.trim(),
        departmentId: formDepartmentId,
      });
      if (response.data?.success) {
        toast.success('Admin account updated successfully.');
        setIsEditOpen(false);
        await Promise.all([fetchAdmins(), fetchStats(), fetchLogs()]);
      }
    } catch (error: any) {
      console.error('Failed to update admin account', error);
      toast.error(error.response?.data?.message || 'Failed to update admin account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (admin: AdminAccount) => {
    setSelectedAdmin(admin);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedAdmin) return;
    setIsSubmitting(true);
    try {
      const response = await api.delete(`/auth/admins/${selectedAdmin.id}`);
      if (response.data?.success) {
        toast.success('Admin account deleted.');
        setIsDeleteOpen(false);
        await Promise.all([fetchAdmins(), fetchStats(), fetchLogs()]);
      }
    } catch (error: any) {
      console.error('Failed to delete admin account', error);
      toast.error(error.response?.data?.message || 'Failed to delete admin account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAdminStatus = async (id: string) => {
    try {
      const response = await api.patch(`/auth/admins/${id}/toggle-status`);
      if (response.data?.success) {
        toast.success('Admin status updated.');
        await Promise.all([fetchAdmins(), fetchStats(), fetchLogs()]);
      }
    } catch (error: any) {
      console.error('Failed to update admin status', error);
      toast.error(error.response?.data?.message || 'Failed to update admin status.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await api.patch('/super-admin/settings', {
        academicPeriod: academicPeriod.trim(),
        minAttendance: Number(minAttendance),
        editWindow: Number(editWindow),
        allowFacultyOverride,
      });
      if (response.data?.success) {
        toast.success('Global configurations saved successfully.');
        await Promise.all([fetchSettings(), fetchLogs()]);
      }
    } catch (error: any) {
      console.error('Failed to save settings', error);
      toast.error(error.response?.data?.message || 'Failed to save settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAdmins = admins.filter(admin => 
    admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.departmentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (admin.departmentCode && admin.departmentCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Dashboard Section Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">ASSAM System Admin</span>
          <h2 className="text-2xl font-semibold tracking-tight text-ink mt-0.5">Global Administration Control</h2>
          <p className="text-xs text-ink-muted-80">Oversee connected departments, manage main system settings, and audit logs.</p>
        </div>
        
        {/* Navigation Tabs (Apple capsule style) */}
        <div className="flex bg-canvas-parchment p-1 rounded-full border">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            System Overview
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'admins' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Manage Admins
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'settings' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* --- Tab Content: Overview --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Connected Departments</span>
                <Building2 className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                {isStatsLoading ? (
                  <div className="space-y-1.5">
                    <div className="h-7 w-12 bg-canvas-parchment animate-pulse rounded" />
                    <div className="h-3 w-28 bg-canvas-parchment animate-pulse rounded" />
                  </div>
                ) : (
                  <>
                    <span className="text-2xl font-semibold text-ink">
                      {stats?.connectedDepartments?.count ?? stats?.connectedInstitutions?.count ?? 0}
                    </span>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                      {stats?.connectedDepartments?.subtitle ?? stats?.connectedInstitutions?.subtitle ?? 'Active academic departments'}
                    </p>
                  </>
                )}
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Total Active Users</span>
                <Users className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                {isStatsLoading ? (
                  <div className="space-y-1.5">
                    <div className="h-7 w-16 bg-canvas-parchment animate-pulse rounded" />
                    <div className="h-3 w-32 bg-canvas-parchment animate-pulse rounded" />
                  </div>
                ) : (
                  <>
                    <span className="text-2xl font-semibold text-ink">
                      {stats?.totalActiveUsers?.count?.toLocaleString() ?? 0}
                    </span>
                    <p className="text-[10px] text-action-blue font-semibold mt-1">
                      {stats?.totalActiveUsers?.subtitle ?? 'Platform-wide active accounts'}
                    </p>
                  </>
                )}
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">System Health</span>
                <Activity className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div className="mt-4">
                {isStatsLoading ? (
                  <div className="space-y-1.5">
                    <div className="h-7 w-24 bg-canvas-parchment animate-pulse rounded" />
                    <div className="h-3 w-32 bg-canvas-parchment animate-pulse rounded" />
                  </div>
                ) : (
                  <>
                    <span className={`text-2xl font-semibold ${stats?.systemHealth?.status === 'Operational' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {stats?.systemHealth?.status ?? 'Operational'}
                    </span>
                    <p className="text-[10px] text-ink-muted-48 mt-1">
                      {stats?.systemHealth?.subtitle ?? 'Live DB connection validated'}
                    </p>
                  </>
                )}
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Total Admins</span>
                <ShieldCheck className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                {isStatsLoading ? (
                  <div className="space-y-1.5">
                    <div className="h-7 w-10 bg-canvas-parchment animate-pulse rounded" />
                    <div className="h-3 w-28 bg-canvas-parchment animate-pulse rounded" />
                  </div>
                ) : (
                  <>
                    <span className="text-2xl font-semibold text-ink">
                      {stats?.totalAdmins?.count ?? admins.length}
                    </span>
                    <p className="text-[10px] text-ink-muted-48 mt-1">
                      {stats?.totalAdmins?.subtitle ?? 'Active administrator accounts'}
                    </p>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Audit Logs Layout */}
          <div className="grid gap-6 lg:grid-cols-7">
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-4 p-6">
              <div className="pb-4 border-b">
                <CardTitle className="text-base font-semibold text-ink">Recent Audit log</CardTitle>
                <CardDescription className="text-xs text-ink-muted-80">System-wide logs audited over the last 48 hours.</CardDescription>
              </div>
              <div className="mt-6 space-y-4">
                {isLogsLoading ? (
                  <div className="space-y-4 py-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex justify-between items-start border-b pb-3.5 last:border-0">
                        <div className="flex gap-3">
                          <div className="w-2 h-2 rounded-full bg-slate-200 mt-1.5 shrink-0" />
                          <div className="space-y-1">
                            <div className="h-3 w-36 bg-canvas-parchment animate-pulse rounded" />
                            <div className="h-2.5 w-48 bg-canvas-parchment animate-pulse rounded" />
                          </div>
                        </div>
                        <div className="h-2.5 w-10 bg-canvas-parchment animate-pulse rounded" />
                      </div>
                    ))}
                  </div>
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <div key={log.id} className="flex justify-between items-start border-b pb-3.5 last:border-0 last:pb-0">
                      <div className="flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-action-blue mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-ink">{log.event}</p>
                          <p className="text-[11px] text-ink-muted-80 mt-0.5">{log.details}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-ink-muted-48 font-medium shrink-0 ml-2">{log.time}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-ink-muted-48">
                    No recent audit log records found.
                  </div>
                )}
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-3 p-6 flex flex-col justify-between">
              <div>
                <div className="pb-4 border-b">
                  <CardTitle className="text-base font-semibold text-ink">Quick Tools</CardTitle>
                  <CardDescription className="text-xs text-ink-muted-80">Frequently triggered commands.</CardDescription>
                </div>
                <div className="mt-6 space-y-3">
                  <div 
                    onClick={handleOpenCreate} 
                    className="flex justify-between items-center p-3.5 rounded-xl border hover:bg-canvas-parchment/50 cursor-pointer transition-all active:scale-98"
                  >
                    <span className="text-xs font-semibold text-ink">Onboard Department Admin</span>
                    <Plus className="h-4 w-4 text-action-blue" />
                  </div>
                  <div 
                    onClick={() => setActiveTab('settings')} 
                    className="flex justify-between items-center p-3.5 rounded-xl border hover:bg-canvas-parchment/50 cursor-pointer transition-all active:scale-98"
                  >
                    <span className="text-xs font-semibold text-ink">Global Configuration</span>
                    <Settings className="h-4 w-4 text-action-blue" />
                  </div>
                </div>
              </div>
              <div className="bg-canvas-parchment p-3 rounded-xl border border-[#e0e0e0] flex gap-2.5 mt-6 items-start">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-ink-muted-80 leading-relaxed">
                  Super Admins hold system-level authority. Changing properties or terminating Admin log keys can disrupt connected department schedules.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* --- Tab Content: Manage Admins (CRUD) --- */}
      {activeTab === 'admins' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6">
          {/* Table Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b mb-6">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-ink-muted-48" />
              <Input
                type="search"
                placeholder="Search name, email, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 rounded-full border-[#e0e0e0]"
              />
            </div>
            
            <Button onClick={handleOpenCreate} className="bg-action-blue hover:opacity-95 text-white w-full sm:w-auto rounded-full">
              <Plus className="h-4 w-4 mr-2" /> Add Admin
            </Button>
          </div>

          {/* Admin Table Grid */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="w-[180px] text-xs font-bold text-ink-muted-80">Admin Name</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Email</TableHead>
                  <TableHead className="text-xs font-bold text-ink-muted-80">Department</TableHead>
                  <TableHead className="w-[100px] text-xs font-bold text-ink-muted-80">Status</TableHead>
                  <TableHead className="w-[100px] text-right text-xs font-bold text-ink-muted-80">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAdminsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-xs text-ink-muted-48">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-action-blue" />
                        <span>Loading admin accounts from server...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAdmins.length > 0 ? (
                  filteredAdmins.map((admin) => (
                    <TableRow key={admin.id} className="border-b last:border-0 hover:bg-canvas-parchment/30 transition-colors">
                      <TableCell className="font-semibold text-xs text-ink">{admin.name}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">{admin.email}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">
                        <span className="font-medium text-ink">{admin.departmentName || 'Unassigned'}</span>
                        {admin.departmentCode && (
                          <span className="ml-1.5 text-[10px] text-ink-muted-48">({admin.departmentCode})</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          onClick={() => toggleAdminStatus(admin.id)}
                          className={`text-[9px] px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 border-none transition-all ${
                            admin.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {admin.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(admin)}
                            className="p-1.5 rounded-full bg-canvas-parchment text-ink-muted-80 hover:text-action-blue active:scale-95 transition-all cursor-pointer"
                            title="Edit Account"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(admin)}
                            className="p-1.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
                            title="Delete Account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-xs text-ink-muted-48">
                      {admins.length === 0 ? 'No department admin records found in database.' : 'No admin records found matching query.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* --- Tab Content: Settings --- */}
      {activeTab === 'settings' && (
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-6 max-w-2xl">
          <div className="pb-4 border-b mb-6">
            <CardTitle className="text-base font-semibold text-ink">Global Configuration Settings</CardTitle>
            <CardDescription className="text-xs text-ink-muted-80">Define active system thresholds across all connected departments.</CardDescription>
          </div>
          {isSettingsLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-xs text-ink-muted-48">
              <Loader2 className="h-4 w-4 animate-spin text-action-blue" />
              <span>Loading system configurations...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-ink">Active Academic Period</label>
                <Input
                  type="text"
                  value={academicPeriod}
                  onChange={(e) => setAcademicPeriod(e.target.value)}
                  className="border-[#e0e0e0]"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink">Min Attendance Ratio (%)</label>
                  <Input
                    type="number"
                    min="50"
                    max="100"
                    value={minAttendance}
                    onChange={(e) => setMinAttendance(parseInt(e.target.value) || 0)}
                    className="border-[#e0e0e0]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink">Attendance Edit Window (Hours)</label>
                  <Input
                    type="number"
                    min="1"
                    max="168"
                    value={editWindow}
                    onChange={(e) => setEditWindow(parseInt(e.target.value) || 0)}
                    className="border-[#e0e0e0]"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 bg-canvas-parchment rounded-xl border mt-2">
                <input
                  type="checkbox"
                  id="override"
                  checked={allowFacultyOverride}
                  onChange={(e) => setAllowFacultyOverride(e.target.checked)}
                  className="h-4 w-4 rounded border-[#e0e0e0] text-action-blue cursor-pointer"
                />
                <label htmlFor="override" className="text-xs font-semibold text-ink cursor-pointer">
                  Allow Faculty to override lock thresholds on approved exceptions.
                </label>
              </div>

              <Button type="submit" disabled={isSubmitting} className="bg-action-blue text-white rounded-full mt-4">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Configuration'
                )}
              </Button>
            </form>
          )}
        </Card>
      )}

      {/* --- CRUD Dialogs --- */}
      
      {/* Create Modal Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-[18px] bg-white border border-[#e0e0e0] shadow-none w-11/12 max-w-md font-sans">
          <form onSubmit={handleCreate}>
            <DialogHeader className="pb-3 border-b mb-4">
              <DialogTitle className="text-base font-semibold text-ink">Create Department Admin</DialogTitle>
              <DialogDescription className="text-xs text-ink-muted-80">Add a new admin account to manage department schedules.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Full Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Dr. Alok Kumar"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="border-[#e0e0e0]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Email Address</label>
                <Input
                  type="email"
                  placeholder="name@bit.ac.in"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="border-[#e0e0e0]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Department (Required)</label>
                {isDepartmentsLoading ? (
                  <div className="h-10 w-full bg-canvas-parchment animate-pulse rounded-md" />
                ) : departments.length > 0 ? (
                  <select
                    value={formDepartmentId}
                    onChange={(e) => setFormDepartmentId(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-white rounded-md border border-[#e0e0e0] focus:outline-none focus:ring-1 focus:ring-action-blue"
                    required
                  >
                    <option value="" disabled>Select active department...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-rose-600">No active departments available. Create or activate one first.</p>
                )}
              </div>
            </div>
            <DialogFooter className="mt-6 border-t pt-3 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting} className="rounded-full">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !formDepartmentId || !formName.trim() || !formEmail.trim()} 
                className="bg-action-blue text-white rounded-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-[18px] bg-white border border-[#e0e0e0] shadow-none w-11/12 max-w-md font-sans">
          <form onSubmit={handleEdit}>
            <DialogHeader className="pb-3 border-b mb-4">
              <DialogTitle className="text-base font-semibold text-ink">Modify Admin Details</DialogTitle>
              <DialogDescription className="text-xs text-ink-muted-80">Update values for departmental admin account.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Full Name</label>
                <Input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="border-[#e0e0e0]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Email Address</label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="border-[#e0e0e0]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Department (Required)</label>
                <select
                  value={formDepartmentId}
                  onChange={(e) => setFormDepartmentId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white rounded-md border border-[#e0e0e0] focus:outline-none focus:ring-1 focus:ring-action-blue"
                  required
                >
                  <option value="" disabled>Select active department...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter className="mt-6 border-t pt-3 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting} className="rounded-full">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !formDepartmentId || !formName.trim() || !formEmail.trim()} 
                className="bg-action-blue text-white rounded-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-[18px] bg-white border border-[#e0e0e0] shadow-none w-11/12 max-w-sm font-sans">
          <AlertDialogHeader className="pb-2 border-b">
            <AlertDialogTitle className="text-base font-semibold text-ink">Delete Admin Account</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-ink-muted-80">
              Are you sure? This action will permanently remove <strong className="text-ink">{selectedAdmin?.name}</strong> from our database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-3 flex gap-2 justify-end">
            <AlertDialogCancel disabled={isSubmitting} className="rounded-full text-xs font-semibold cursor-pointer border-[#e0e0e0]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90 text-white rounded-full text-xs font-semibold cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
