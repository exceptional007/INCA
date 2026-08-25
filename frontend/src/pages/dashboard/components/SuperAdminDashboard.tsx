import React, { useState } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Building2, Users, ShieldCheck, Activity, Search, Plus, Trash2, Edit3, Settings, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
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
  institution: string;
  isActive: boolean;
}

export const SuperAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'admins' | 'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local state for interactive Admin accounts CRUD
  const [admins, setAdmins] = useState<AdminAccount[]>([
    { id: '1', name: 'Dr. Ramesh Sarma', email: 'ramesh.sarma@tu.edu', institution: 'Tezpur University', isActive: true },
    { id: '2', name: 'Prof. Alok Sen', email: 'alok.sen@gauhati.ac.in', institution: 'Gauhati University', isActive: true },
    { id: '3', name: 'Dr. Binita Devi', email: 'binita.devi@nits.ac.in', institution: 'NIT Silchar', isActive: true },
    { id: '4', name: 'Prof. J. Baruah', email: 'jbaruah@aec.ac.in', institution: 'Assam Engineering College', isActive: false },
  ]);

  // CRUD Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // Selected admin for Edit/Delete
  const [selectedAdmin, setSelectedAdmin] = useState<AdminAccount | null>(null);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formInstitution, setFormInstitution] = useState('');

  // Settings State
  const [academicPeriod, setAcademicPeriod] = useState('Autumn Semester 2026');
  const [minAttendance, setMinAttendance] = useState(75);
  const [editWindow, setEditWindow] = useState(24);
  const [allowFacultyOverride, setAllowFacultyOverride] = useState(true);

  // Global activity logs
  const [logs, setLogs] = useState([
    { id: '101', event: 'New Institution Admin Created', details: 'Dr. Ramesh Sarma (Tezpur University)', time: '2h ago' },
    { id: '102', event: 'System Backup Completed', details: 'Database auto-snapshot success.', time: '5h ago' },
    { id: '103', event: 'Security Settings Updated', details: 'Session timeout threshold set to 15m.', time: '1d ago' },
    { id: '104', event: 'Institution Suspended', details: 'Temporary suspension for College of Arts.', time: '2d ago' },
  ]);

  const handleOpenCreate = () => {
    setFormName('');
    setFormEmail('');
    setFormInstitution('');
    setIsCreateOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail || !formInstitution) {
      toast.error('All fields are required.');
      return;
    }
    const newAdmin: AdminAccount = {
      id: Date.now().toString(),
      name: formName,
      email: formEmail,
      institution: formInstitution,
      isActive: true,
    };
    setAdmins([newAdmin, ...admins]);
    setIsCreateOpen(false);
    toast.success('Admin account created successfully.');
    setLogs([
      { id: Date.now().toString(), event: 'New Institution Admin Created', details: `${newAdmin.name} (${newAdmin.institution})`, time: 'Just now' },
      ...logs
    ]);
  };

  const handleOpenEdit = (admin: AdminAccount) => {
    setSelectedAdmin(admin);
    setFormName(admin.name);
    setFormEmail(admin.email);
    setFormInstitution(admin.institution);
    setIsEditOpen(true);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    if (!formName || !formEmail || !formInstitution) {
      toast.error('All fields are required.');
      return;
    }
    setAdmins(admins.map(a => a.id === selectedAdmin.id ? { ...a, name: formName, email: formEmail, institution: formInstitution } : a));
    setIsEditOpen(false);
    toast.success('Admin account updated successfully.');
  };

  const handleOpenDelete = (admin: AdminAccount) => {
    setSelectedAdmin(admin);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!selectedAdmin) return;
    setAdmins(admins.filter(a => a.id !== selectedAdmin.id));
    setIsDeleteOpen(false);
    toast.success('Admin account deleted.');
    setLogs([
      { id: Date.now().toString(), event: 'Admin Account Deleted', details: `${selectedAdmin.name} (${selectedAdmin.institution})`, time: 'Just now' },
      ...logs
    ]);
  };

  const toggleAdminStatus = (id: string) => {
    setAdmins(admins.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));
    toast.success('Admin status updated.');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Global configurations saved successfully.');
    setLogs([
      { id: Date.now().toString(), event: 'System Configurations Modified', details: 'Settings tab change applied.', time: 'Just now' },
      ...logs
    ]);
  };

  const filteredAdmins = admins.filter(admin => 
    admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.institution.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Dashboard Section Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase text-action-blue tracking-widest font-semibold">ASSAM System Admin</span>
          <h2 className="text-2xl font-semibold tracking-tight text-ink mt-0.5">Global Administration Control</h2>
          <p className="text-xs text-ink-muted-80">Oversee connected institutions, manage main system settings, and audit logs.</p>
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
                <span className="text-xs font-bold uppercase tracking-wider">Connected Institutions</span>
                <Building2 className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">12</span>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">+2 onboarded this semester</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Total Active Users</span>
                <Users className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">14,231</span>
                <p className="text-[10px] text-action-blue font-semibold mt-1">+12% traffic active</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">System Health</span>
                <Activity className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-emerald-600">99.9%</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Uptime benchmark validated</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Total Admins</span>
                <ShieldCheck className="h-4.5 w-4.5 text-action-blue" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-ink">{admins.length}</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Active institutional accounts</p>
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
                {logs.map((log) => (
                  <div key={log.id} className="flex justify-between items-start border-b pb-3.5 last:border-0 last:pb-0">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-action-blue mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-ink">{log.event}</p>
                        <p className="text-[11px] text-ink-muted-80 mt-0.5">{log.details}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-ink-muted-48 font-medium">{log.time}</span>
                  </div>
                ))}
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
                    <span className="text-xs font-semibold text-ink">Onboard Institution Admin</span>
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
                  Super Admins hold system-level authority. Changing properties or terminating Admin log keys can disrupt connected courses schedules.
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
                placeholder="Search name, email, or institution..."
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
                  <TableHead className="text-xs font-bold text-ink-muted-80">Institution</TableHead>
                  <TableHead className="w-[100px] text-xs font-bold text-ink-muted-80">Status</TableHead>
                  <TableHead className="w-[100px] text-right text-xs font-bold text-ink-muted-80">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.length > 0 ? (
                  filteredAdmins.map((admin) => (
                    <TableRow key={admin.id} className="border-b last:border-0 hover:bg-canvas-parchment/30 transition-colors">
                      <TableCell className="font-semibold text-xs text-ink">{admin.name}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">{admin.email}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">{admin.institution}</TableCell>
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
                      No admin records found matching query.
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
            <CardDescription className="text-xs text-ink-muted-80">Define active system thresholds across all connected institutions.</CardDescription>
          </div>
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
                  onChange={(e) => setMinAttendance(parseInt(e.target.value))}
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
                  onChange={(e) => setEditWindow(parseInt(e.target.value))}
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
                className="h-4 w-4 rounded border-[#e0e0e0] text-action-blue"
              />
              <label htmlFor="override" className="text-xs font-semibold text-ink cursor-pointer">
                Allow Faculty to override lock thresholds on approved exceptions.
              </label>
            </div>

            <Button type="submit" className="bg-action-blue text-white rounded-full mt-4">
              Save Configuration
            </Button>
          </form>
        </Card>
      )}

      {/* --- CRUD Dialogs --- */}
      
      {/* Create Modal Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-[18px] bg-white border border-[#e0e0e0] shadow-none w-11/12 max-w-md font-sans">
          <form onSubmit={handleCreate}>
            <DialogHeader className="pb-3 border-b mb-4">
              <DialogTitle className="text-base font-semibold text-ink">Create Institution Admin</DialogTitle>
              <DialogDescription className="text-xs text-ink-muted-80">Add a new admin account to manage institution schedules.</DialogDescription>
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
                  placeholder="name@institution.edu"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="border-[#e0e0e0]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Institution</label>
                <Input
                  type="text"
                  placeholder="e.g. Tezpur University"
                  value={formInstitution}
                  onChange={(e) => setFormInstitution(e.target.value)}
                  className="border-[#e0e0e0]"
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-6 border-t pt-3 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-full">
                Cancel
              </Button>
              <Button type="submit" className="bg-action-blue text-white rounded-full">
                Create Account
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
              <DialogDescription className="text-xs text-ink-muted-80">Update values for institutional admin account.</DialogDescription>
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
                <label className="text-xs font-bold text-ink">Institution</label>
                <Input
                  type="text"
                  value={formInstitution}
                  onChange={(e) => setFormInstitution(e.target.value)}
                  className="border-[#e0e0e0]"
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-6 border-t pt-3 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-full">
                Cancel
              </Button>
              <Button type="submit" className="bg-action-blue text-white rounded-full">
                Apply Changes
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
            <AlertDialogCancel className="rounded-full text-xs font-semibold cursor-pointer border-[#e0e0e0]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white rounded-full text-xs font-semibold cursor-pointer">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
