import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Database, Building2, GraduationCap, Layers, Hash, Sparkles } from 'lucide-react';
import api from '@/api/axios';

interface AcademicConfigSelectorProps {
  onDepartmentSelect?: (deptId: string) => void;
  onProgramSelect?: (programId: string) => void;
  onSemesterSelect?: (semesterId: string) => void;
  onSectionSelect?: (sectionId: string, details?: any) => void;
  onStatusChange?: (status: { loading: boolean; exists?: boolean; details?: any } | null) => void;
}

export const AcademicConfigSelector: React.FC<AcademicConfigSelectorProps> = ({
  onDepartmentSelect,
  onProgramSelect,
  onSemesterSelect,
  onSectionSelect,
  onStatusChange,
}) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');

  const [activeConfigs, setActiveConfigs] = useState<any[]>([]);
  const [status, setStatus] = useState<{ loading: boolean; exists?: boolean; details?: any } | null>(null);

  useEffect(() => {
    fetchDepartments();
    fetchActiveConfigs();
  }, []);

  const fetchActiveConfigs = async () => {
    try {
      const res = await api.get('/admin/timetable-imports/active-configurations');
      const configs = res.data.data || [];
      setActiveConfigs(configs);

      // Automatically auto-select the first/primary active config if none is selected yet!
      if (configs.length > 0 && !selectedSection) {
        handleQuickSelect(configs[0]);
      }
    } catch (err) {
      console.error('Error fetching active timetable configs:', err);
    }
  };

  const handleQuickSelect = async (cfg: any) => {
    if (!cfg) return;
    try {
      setSelectedDept(cfg.departmentId || '');
      if (cfg.departmentId) {
        const progRes = await api.get(`/academic/departments/programs?departmentId=${cfg.departmentId}`);
        setPrograms(progRes.data.data || progRes.data || []);
      }
      setSelectedProgram(cfg.programId || '');

      if (cfg.programId) {
        const semRes = await api.get(`/academic/departments/semesters?programId=${cfg.programId}`);
        setSemesters(semRes.data.data || semRes.data || []);
      }
      setSelectedSemester(cfg.semesterId || '');

      if (cfg.semesterId) {
        const secRes = await api.get(`/academic/departments/sections?semesterId=${cfg.semesterId}`);
        setSections(secRes.data.data || secRes.data || []);
      }
      setSelectedSection(cfg.sectionId || '');

      if (onSectionSelect) {
        onSectionSelect(cfg.sectionId, {
          id: cfg.sectionId,
          name: cfg.sectionName,
          semesterId: cfg.semesterId,
          programId: cfg.programId,
          programName: cfg.programName,
        });
      }
    } catch (e) {
      console.error('Failed to quick-select active timetable config:', e);
      setSelectedSection(cfg.sectionId || '');
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/academic/departments');
      setDepartments(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  useEffect(() => {
    if (selectedDept) {
      fetchPrograms(selectedDept);
    } else {
      setPrograms([]);
      setSelectedProgram('');
    }
  }, [selectedDept]);

  const fetchPrograms = async (deptId: string) => {
    try {
      const res = await api.get(`/academic/departments/programs?departmentId=${deptId}`);
      setPrograms(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error fetching programs:', err);
    }
  };

  useEffect(() => {
    if (selectedProgram) {
      fetchSemesters(selectedProgram);
    } else {
      setSemesters([]);
      setSelectedSemester('');
    }
  }, [selectedProgram]);

  const fetchSemesters = async (progId: string) => {
    try {
      const res = await api.get(`/academic/departments/semesters?programId=${progId}`);
      setSemesters(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error fetching semesters:', err);
    }
  };

  useEffect(() => {
    if (selectedSemester) {
      fetchSections(selectedSemester);
    } else {
      setSections([]);
      setSelectedSection('');
    }
  }, [selectedSemester]);

  const fetchSections = async (semId: string) => {
    try {
      const res = await api.get(`/academic/departments/sections?semesterId=${semId}`);
      setSections(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error fetching sections:', err);
    }
  };

  useEffect(() => {
    if (selectedSection) {
      checkSectionTimetable(selectedSection);
    } else {
      setStatus(null);
    }
  }, [selectedSection]);

  const checkSectionTimetable = async (secId: string) => {
    setStatus({ loading: true });
    try {
      const res = await api.get(`/admin/timetable-imports/check-section/${secId}`);
      const details = res.data?.data || res.data;
      const newStatus = {
        loading: false,
        exists: details?.exists || false,
        details,
      };
      setStatus(newStatus);
      if (onStatusChange) onStatusChange(newStatus);
    } catch (err) {
      console.error('Error checking timetable status:', err);
      const errStatus = { loading: false, exists: false };
      setStatus(errStatus);
      if (onStatusChange) onStatusChange(errStatus);
    }
  };

  useEffect(() => {
    if (onDepartmentSelect) onDepartmentSelect(selectedDept);
  }, [selectedDept, onDepartmentSelect]);

  useEffect(() => {
    if (onProgramSelect) onProgramSelect(selectedProgram);
  }, [selectedProgram, onProgramSelect]);

  useEffect(() => {
    if (onSemesterSelect) onSemesterSelect(selectedSemester);
  }, [selectedSemester, onSemesterSelect]);

  useEffect(() => {
    if (onSectionSelect) {
      const sec = sections.find((s) => s.id === selectedSection);
      onSectionSelect(selectedSection, sec);
    }
  }, [selectedSection, sections, onSectionSelect]);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground text-base">Select Academic Configuration</h3>
          </div>

          {status && !status.loading && (
            <div className="flex items-center gap-2">
              {status.exists ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 px-3 py-1 font-medium text-xs flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  Timetable Available (Loaded from DB)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 px-3 py-1 font-medium text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  No Timetable Configured
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Quick Select Bar for Active Timetables */}
        {activeConfigs.length > 0 && (
          <div className="bg-secondary/40 border border-border/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Active Timetables in Database ({activeConfigs.length}):
              </span>
              <span className="text-[11px] text-muted-foreground">Click any configuration to switch timetable</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeConfigs.map((cfg) => {
                const isSelected = selectedSection === cfg.sectionId;
                return (
                  <button
                    key={cfg.sectionId}
                    type="button"
                    onClick={() => handleQuickSelect(cfg)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                        : 'bg-card hover:bg-secondary/80 text-foreground border-border shadow-2xs hover:border-primary/40'
                    }`}
                  >
                    <span className="font-semibold">{cfg.programName || cfg.programCode}</span>
                    <span className="opacity-60">·</span>
                    <span>Sem {cfg.semesterNumber}</span>
                    <span className="opacity-60">·</span>
                    <span className="font-mono bg-background/20 px-1.5 py-0.5 rounded text-[11px] font-bold">
                      Sec {cfg.sectionName}
                    </span>
                    <Badge variant={isSelected ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                      {cfg.slotCount} slots
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Department */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Department
            </Label>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select Dept" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.code || d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Program */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" /> Program
            </Label>
            <Select value={selectedProgram} onValueChange={setSelectedProgram} disabled={!selectedDept}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select Program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Semester */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Semester
            </Label>
            <Select value={selectedSemester} onValueChange={setSelectedSemester} disabled={!selectedProgram}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select Sem" />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    Semester {s.number} ({s.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" /> Section
            </Label>
            <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedSemester}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select Section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((sec) => (
                  <SelectItem key={sec.id} value={sec.id} className="text-xs">
                    Section {sec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
