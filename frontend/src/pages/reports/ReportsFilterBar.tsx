import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Filter,
  RotateCcw,
  Download,
  Building2,
  Calendar,
  Layers,
  GraduationCap,
  BookOpen,
  Users,
  Check,
} from 'lucide-react';

export type ReportType = 'overview' | 'student' | 'subject' | 'section' | 'faculty';

export interface FilterOptions {
  departments: Array<{ id: string; code: string; name: string; shortName?: string }>;
  programs: Array<{ id: string; code: string; name: string; shortName?: string; departmentId: string }>;
  semesters: Array<{ id: string; number: number; programId: string }>;
  sections: Array<{ id: string; name: string; semesterNumber?: number; programName?: string; departmentId?: string; displayName: string }>;
  subjects: Array<{ id: string; code: string; name: string; type?: string; semesterNumber?: number; departmentId?: string; displayName: string }>;
  faculty: Array<{ id: string; employeeCode: string; name: string; designation: string; departmentId?: string; departmentName?: string; displayName: string }>;
  students: Array<{ id: string; rollNumber: string; name: string; sectionId?: string; sectionName?: string; displayName: string }>;
}

interface ReportsFilterBarProps {
  reportType: ReportType;
  onReportTypeChange: (type: ReportType) => void;
  filterOptions: FilterOptions | null;
  selectedDepartmentId: string;
  onDepartmentChange: (deptId: string) => void;
  selectedEntityId: string;
  onEntityChange: (id: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  onApply: () => void;
  onReset: () => void;
  onExportCsv: () => void;
  isLoading: boolean;
  isExporting: boolean;
}

export const ReportsFilterBar: React.FC<ReportsFilterBarProps> = ({
  reportType,
  onReportTypeChange,
  filterOptions,
  selectedDepartmentId,
  onDepartmentChange,
  selectedEntityId,
  onEntityChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onApply,
  onReset,
  onExportCsv,
  isLoading,
  isExporting,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  const handleStartDate = (val: string) => {
    onStartDateChange(val);
    if (endDate && val && val > endDate) {
      setDateError('Start date cannot be after end date.');
    } else {
      setDateError(null);
    }
  };

  const handleEndDate = (val: string) => {
    onEndDateChange(val);
    if (startDate && val && startDate > val) {
      setDateError('End date cannot be before start date.');
    } else {
      setDateError(null);
    }
  };

  // Filter entities according to search term and selected department
  const filteredEntities = useMemo(() => {
    if (!filterOptions) return [];
    const term = searchTerm.toLowerCase().trim();

    if (reportType === 'student') {
      let list = filterOptions.students;
      if (term) {
        list = list.filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.rollNumber.toLowerCase().includes(term) ||
            (s.sectionName && s.sectionName.toLowerCase().includes(term)),
        );
      }
      return list.map((s) => ({
        id: s.id,
        primary: s.name,
        secondary: `Roll: ${s.rollNumber}${s.sectionName ? ` | Sec ${s.sectionName}` : ''}`,
      }));
    }

    if (reportType === 'subject') {
      let list = filterOptions.subjects;
      if (selectedDepartmentId) {
        list = list.filter((sub) => sub.departmentId === selectedDepartmentId);
      }
      if (term) {
        list = list.filter(
          (sub) =>
            sub.name.toLowerCase().includes(term) ||
            sub.code.toLowerCase().includes(term),
        );
      }
      return list.map((sub) => ({
        id: sub.id,
        primary: sub.name,
        secondary: `${sub.code} • Sem ${sub.semesterNumber || '—'} (${sub.type || 'THEORY'})`,
      }));
    }

    if (reportType === 'section') {
      let list = filterOptions.sections;
      if (selectedDepartmentId) {
        list = list.filter((sec) => sec.departmentId === selectedDepartmentId);
      }
      if (term) {
        list = list.filter(
          (sec) =>
            sec.name.toLowerCase().includes(term) ||
            (sec.programName && sec.programName.toLowerCase().includes(term)),
        );
      }
      return list.map((sec) => ({
        id: sec.id,
        primary: `Section ${sec.name}`,
        secondary: `${sec.programName || 'Program'} • Sem ${sec.semesterNumber || '—'}`,
      }));
    }

    if (reportType === 'faculty') {
      let list = filterOptions.faculty;
      if (selectedDepartmentId) {
        list = list.filter((f) => f.departmentId === selectedDepartmentId);
      }
      if (term) {
        list = list.filter(
          (f) =>
            f.name.toLowerCase().includes(term) ||
            (f.employeeCode && f.employeeCode.toLowerCase().includes(term)) ||
            (f.designation && f.designation.toLowerCase().includes(term)),
        );
      }
      return list.map((f) => ({
        id: f.id,
        primary: f.name,
        secondary: `${f.designation || 'Faculty'} [${f.employeeCode || '—'}] • ${f.departmentName || 'General'}`,
      }));
    }

    return [];
  }, [reportType, filterOptions, selectedDepartmentId, searchTerm]);

  const activeDepartmentName = useMemo(() => {
    if (!selectedDepartmentId || !filterOptions) return null;
    const d = filterOptions.departments.find((dept) => dept.id === selectedDepartmentId);
    return d?.name || d?.shortName || null;
  }, [selectedDepartmentId, filterOptions]);

  const activeEntityName = useMemo(() => {
    if (!selectedEntityId || !filterOptions) return null;
    if (reportType === 'student') {
      const s = filterOptions.students.find((st) => st.id === selectedEntityId);
      return s ? `${s.name} (${s.rollNumber})` : selectedEntityId;
    }
    if (reportType === 'subject') {
      const sub = filterOptions.subjects.find((item) => item.id === selectedEntityId);
      return sub ? `${sub.name} (${sub.code})` : selectedEntityId;
    }
    if (reportType === 'section') {
      const sec = filterOptions.sections.find((item) => item.id === selectedEntityId);
      return sec ? `Section ${sec.name}` : selectedEntityId;
    }
    if (reportType === 'faculty') {
      const f = filterOptions.faculty.find((item) => item.id === selectedEntityId);
      return f ? `${f.name} [${f.employeeCode}]` : selectedEntityId;
    }
    return null;
  }, [selectedEntityId, filterOptions, reportType]);

  return (
    <Card className="border border-border/80 shadow-2xs bg-card">
      <CardContent className="p-5 space-y-5">
        {/* Scope / Report Type Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/80 overflow-x-auto scrollbar-none">
            {(
              [
                { type: 'overview', label: 'Institutional Overview', icon: Building2 },
                { type: 'student', label: 'Student Report', icon: GraduationCap },
                { type: 'subject', label: 'Subject Report', icon: BookOpen },
                { type: 'section', label: 'Section Report', icon: Layers },
                { type: 'faculty', label: 'Faculty Report', icon: Users },
              ] as const
            ).map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onReportTypeChange(type);
                  onEntityChange('');
                  setSearchTerm('');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  reportType === type
                    ? 'bg-card shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Export CSV action */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={isExporting || isLoading}
            className="gap-2 shrink-0 border-border/80 text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting CSV...' : 'Export CSV'}</span>
          </Button>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Department Filter (Applicable to overview, subject, section, faculty) */}
          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Department
            </Label>
            <select
              value={selectedDepartmentId}
              onChange={(e) => {
                onDepartmentChange(e.target.value);
                onEntityChange('');
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="">All Academic Departments</option>
              {filterOptions?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Entity Selector (Only when reportType !== 'overview') */}
          {reportType !== 'overview' && (
            <div className="md:col-span-5 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Target {reportType.toUpperCase()}
              </Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${reportType} by name, roll, or code...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>

                {/* Entity Dropdown List */}
                <div className="relative">
                  <select
                    value={selectedEntityId}
                    onChange={(e) => onEntityChange(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    <option value="">
                      -- Select {reportType.charAt(0).toUpperCase() + reportType.slice(1)} (
                      {filteredEntities.length} found) --
                    </option>
                    {filteredEntities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.primary} — {item.secondary}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Start Date */}
          <div className={reportType === 'overview' ? 'md:col-span-3 space-y-1.5' : 'md:col-span-2 space-y-1.5'}>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Start Date
            </Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* End Date */}
          <div className={reportType === 'overview' ? 'md:col-span-3 space-y-1.5' : 'md:col-span-2 space-y-1.5'}>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> End Date
            </Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Actions Column in Overview */}
          {reportType === 'overview' && (
            <div className="md:col-span-3 flex items-end gap-2 pt-1">
              <Button
                type="button"
                onClick={onApply}
                disabled={isLoading || !!dateError}
                className="flex-1 h-9 gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                {isLoading ? 'Loading...' : 'Apply Filters'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onReset}
                disabled={isLoading}
                className="h-9 px-3 text-xs cursor-pointer"
                title="Reset Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Date Validation Error Message */}
        {dateError && (
          <p className="text-xs text-destructive font-medium pl-1">{dateError}</p>
        )}

        {/* Actions Row when not overview */}
        {reportType !== 'overview' && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {activeDepartmentName && (
                <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-muted/40">
                  Dept: <span className="font-semibold text-foreground">{activeDepartmentName}</span>
                </Badge>
              )}
              {activeEntityName && (
                <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-primary/10 text-primary border-primary/30">
                  Target: <span className="font-bold">{activeEntityName}</span>
                </Badge>
              )}
              {(startDate || endDate) && (
                <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-muted/40">
                  Period: <span className="font-semibold text-foreground">{startDate || 'Start'} to {endDate || 'Now'}</span>
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReset}
                disabled={isLoading}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={onApply}
                disabled={isLoading || !!dateError || !selectedEntityId}
                className="gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                {isLoading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
