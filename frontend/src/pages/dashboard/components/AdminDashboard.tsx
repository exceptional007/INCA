import React, { useState } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Users, GraduationCap, Building2, CheckCircle, Search, Plus, Trash2, Edit3, ShieldAlert } from 'lucide-react';
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

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'faculty' | 'students' | 'coordinators' | 'policies'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Local State collections for CRUD operations
  const [faculties, setFaculties] = useState<FacultyMember[]>([
    { id: 'f1', name: 'Dr. Amitabh Roy', email: 'aroy@inca.edu', department: 'Computer Science', designation: 'Professor' },
    { id: 'f2', name: 'Prof. J. Phukan', email: 'jphukan@inca.edu', department: 'Mechanical Eng.', designation: 'Associate Professor' },
    { id: 'f3', name: 'Dr. Minati Kalita', email: 'mkalita@inca.edu', department: 'Mathematics', designation: 'Assistant Professor' },
  ]);

  const [students, setStudents] = useState<StudentRecord[]>([
    { id: 's1', name: 'Prabin Barua', rollNumber: 'CSB23010', department: 'Computer Science', batch: '2023-27' },
    { id: 's2', name: 'Nayanika Saikia', rollNumber: 'CSB23018', department: 'Computer Science', batch: '2023-27' },
    { id: 's3', name: 'Himanshu Bora', rollNumber: 'MEB23045', department: 'Mechanical Eng.', batch: '2023-27' },
  ]);

  const [coordinators, setCoordinators] = useState<CoordinatorRecord[]>([
    { id: 'c1', name: 'Amit Kumar', email: 'akumar@inca.edu', program: 'B.Tech CS (3rd Yr)' },
    { id: 'c2', name: 'Runima Bora', email: 'rbora@inca.edu', program: 'M.Tech CSE' },
  ]);

  const [rules, setRules] = useState<CourseRule[]>([
    { id: 'r1', courseName: 'Computer Networks', code: 'CS-301', requiredAttendance: 75 },
    { id: 'r2', courseName: 'Engineering Mathematics III', code: 'MA-201', requiredAttendance: 75 },
    { id: 'r3', courseName: 'Fluid Mechanics', code: 'ME-302', requiredAttendance: 80 },
  ]);

  // 2. Dialog Modal control states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Selected item tracking
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Generic form states
  const [fieldA, setFieldA] = useState('');
  const [fieldB, setFieldB] = useState('');
  const [fieldC, setFieldC] = useState('');
  const [fieldD, setFieldD] = useState('');

  // Pending Approvals logs
  const [pendingApprovals, setPendingApprovals] = useState([
    { id: 'app1', title: 'Schedule Reschedule Request', details: 'Dr. Amit Roy - CS-301 slot shift from 10:00 AM to 11:30 AM', requester: 'Faculty HOD' },
    { id: 'app2', title: 'Attendance Override Request', details: 'Prabin Barua (CSB23010) - Medical Leave approved', requester: 'Coordinator' },
  ]);

  // CRUD actions
  const handleOpenCreate = () => {
    setFieldA('');
    setFieldB('');
    setFieldC('');
    setFieldD('');
    setIsCreateOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldA || !fieldB || !fieldC) {
      toast.error('Required fields must be filled.');
      return;
    }

    if (activeTab === 'faculty') {
      const newFaculty: FacultyMember = { id: Date.now().toString(), name: fieldA, email: fieldB, department: fieldC, designation: fieldD || 'Lecturer' };
      setFaculties([newFaculty, ...faculties]);
      toast.success('Faculty member added.');
    } else if (activeTab === 'students') {
      const newStudent: StudentRecord = { id: Date.now().toString(), name: fieldA, rollNumber: fieldB, department: fieldC, batch: fieldD || '2023-27' };
      setStudents([newStudent, ...students]);
      toast.success('Student record added.');
    } else if (activeTab === 'coordinators') {
      const newCoord: CoordinatorRecord = { id: Date.now().toString(), name: fieldA, email: fieldB, program: fieldC };
      setCoordinators([newCoord, ...coordinators]);
      toast.success('Coordinator registered.');
    } else if (activeTab === 'policies') {
      const newRule: CourseRule = { id: Date.now().toString(), courseName: fieldA, code: fieldB, requiredAttendance: parseInt(fieldC) || 75 };
      setRules([newRule, ...rules]);
      toast.success('Course attendance threshold registered.');
    }
    setIsCreateOpen(false);
  };

  const handleOpenEdit = (item: any) => {
    setSelectedItem(item);
    if (activeTab === 'faculty') {
      setFieldA(item.name);
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

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !fieldA || !fieldB || !fieldC) return;

    if (activeTab === 'faculty') {
      setFaculties(faculties.map(f => f.id === selectedItem.id ? { ...f, name: fieldA, email: fieldB, department: fieldC, designation: fieldD } : f));
      toast.success('Faculty member details updated.');
    } else if (activeTab === 'students') {
      setStudents(students.map(s => s.id === selectedItem.id ? { ...s, name: fieldA, rollNumber: fieldB, department: fieldC, batch: fieldD } : s));
      toast.success('Student record updated.');
    } else if (activeTab === 'coordinators') {
      setCoordinators(coordinators.map(c => c.id === selectedItem.id ? { ...c, name: fieldA, email: fieldB, program: fieldC } : c));
      toast.success('Coordinator details updated.');
    } else if (activeTab === 'policies') {
      setRules(rules.map(r => r.id === selectedItem.id ? { ...r, courseName: fieldA, code: fieldB, requiredAttendance: parseInt(fieldC) || 75 } : r));
      toast.success('Course attendance rule modified.');
    }
    setIsEditOpen(false);
  };

  const handleOpenDelete = (item: any) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    if (activeTab === 'faculty') {
      setFaculties(faculties.filter(f => f.id !== selectedItem.id));
    } else if (activeTab === 'students') {
      setStudents(students.filter(s => s.id !== selectedItem.id));
    } else if (activeTab === 'coordinators') {
      setCoordinators(coordinators.filter(c => c.id !== selectedItem.id));
    } else if (activeTab === 'policies') {
      setRules(rules.filter(r => r.id !== selectedItem.id));
    }
    setIsDeleteOpen(false);
    toast.success('Record terminated.');
  };

  const handleApprove = (id: string) => {
    setPendingApprovals(pendingApprovals.filter(app => app.id !== id));
    toast.success('Request approved successfully.');
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

        {/* Navigation Tabs (Apple capsule style) */}
        <div className="flex flex-wrap bg-canvas-parchment p-1 rounded-full border">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('faculty')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'faculty' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Faculty
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'students' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Students
          </button>
          <button
            onClick={() => setActiveTab('coordinators')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'coordinators' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Coordinators
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'policies' ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-ink-muted-80 hover:text-ink'
            }`}
          >
            Rules & Policies
          </button>
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
                <span className="text-2xl font-semibold text-ink">8</span>
                <p className="text-[10px] text-ink-muted-48 mt-1">Computer Science, Mechanical, Math...</p>
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
                <p className="text-[10px] text-[#86868b] mt-1">Enrolled program batch</p>
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] p-5 shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-ink-muted-80">
                <span className="text-xs font-bold uppercase tracking-wider">Pending Tasks</span>
                <CheckCircle className="h-4.5 w-4.5 text-amber-500" />
              </div>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-amber-600">{pendingApprovals.length}</span>
                <p className="text-[10px] text-[#ff9500] font-semibold mt-1">Requires review action</p>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-7">
            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-4 p-6">
              <div className="pb-4 border-b">
                <CardTitle className="text-base font-semibold text-ink">Recent Requests & Approvals</CardTitle>
                <CardDescription className="text-xs text-ink-muted-80">Actions requiring administrative approval.</CardDescription>
              </div>
              <div className="mt-6 space-y-4">
                {pendingApprovals.length > 0 ? (
                  pendingApprovals.map((app) => (
                    <div key={app.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                      <div>
                        <p className="text-xs font-semibold text-ink">{app.title}</p>
                        <p className="text-[10px] text-ink-muted-80 mt-1">{app.details}</p>
                        <span className="text-[9px] bg-canvas-parchment px-1.5 py-0.5 rounded text-ink-muted-80 font-medium mt-2 inline-block">
                          From: {app.requester}
                        </span>
                      </div>
                      <Button onClick={() => handleApprove(app.id)} className="bg-action-blue hover:opacity-95 text-white text-xs h-8 px-4 rounded-full">
                        Approve
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center py-6 text-ink-muted-48">All request actions are cleared.</p>
                )}
              </div>
            </Card>

            <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none col-span-3 p-6 flex flex-col justify-between">
              <div>
                <div className="pb-4 border-b">
                  <CardTitle className="text-base font-semibold text-ink">Curriculum Actions</CardTitle>
                  <CardDescription className="text-xs text-ink-muted-80">Syllabus adjustments.</CardDescription>
                </div>
                <div className="mt-6 space-y-3">
                  <div onClick={() => setActiveTab('faculty')} className="flex justify-between items-center p-3.5 rounded-xl border hover:bg-canvas-parchment/50 cursor-pointer active:scale-98">
                    <span className="text-xs font-semibold text-ink">Manage Faculty Members</span>
                    <Plus className="h-4 w-4 text-action-blue" />
                  </div>
                  <div onClick={() => setActiveTab('students')} className="flex justify-between items-center p-3.5 rounded-xl border hover:bg-canvas-parchment/50 cursor-pointer active:scale-98">
                    <span className="text-xs font-semibold text-ink">Register Student Roster</span>
                    <Plus className="h-4 w-4 text-action-blue" />
                  </div>
                  <div onClick={() => setActiveTab('policies')} className="flex justify-between items-center p-3.5 rounded-xl border hover:bg-canvas-parchment/50 cursor-pointer active:scale-98">
                    <span className="text-xs font-semibold text-ink">Attendance Rules</span>
                    <Plus className="h-4 w-4 text-action-blue" />
                  </div>
                </div>
              </div>
              <div className="bg-canvas-parchment p-3 rounded-xl border flex gap-2.5 mt-6 items-start">
                <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[10px] text-ink-muted-80 leading-relaxed">
                  Modifying courses or deleting roster keys will affect scheduling and block active faculty check-in access sheets.
                </p>
              </div>
            </Card>
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
            
            <Button onClick={handleOpenCreate} className="bg-action-blue hover:opacity-95 text-white w-full sm:w-auto rounded-full">
              <Plus className="h-4 w-4 mr-2" /> Add {activeTab === 'policies' ? 'Policy' : activeTab.slice(0, -1)}
            </Button>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'faculty' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Name</TableHead>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Email</TableHead>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Department</TableHead>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Designation</TableHead>
                    <TableHead className="w-[100px] text-right text-xs font-bold text-ink-muted-80">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faculties.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((f) => (
                    <TableRow key={f.id} className="border-b last:border-0 hover:bg-canvas-parchment/30">
                      <TableCell className="font-semibold text-xs text-ink">{f.name}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">{f.email}</TableCell>
                      <TableCell className="text-xs text-ink-muted-80">{f.department}</TableCell>
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
            )}

            {activeTab === 'students' && (
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
            )}

            {activeTab === 'coordinators' && (
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
            )}

            {activeTab === 'policies' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Course Subject</TableHead>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Subject Code</TableHead>
                    <TableHead className="text-xs font-bold text-ink-muted-80">Required Attendance Ratio</TableHead>
                    <TableHead className="w-[100px] text-right text-xs font-bold text-ink-muted-80">Actions</TableHead>
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
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => handleOpenEdit(r)} className="p-1.5 rounded-full bg-canvas-parchment text-ink-muted-80 hover:text-action-blue cursor-pointer"><Edit3 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleOpenDelete(r)} className="p-1.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
