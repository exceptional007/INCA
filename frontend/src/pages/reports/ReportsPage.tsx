import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/api/axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { ReportsFilterBar, type ReportType, type FilterOptions } from './ReportsFilterBar';
import { ReportsOverviewView } from './ReportsOverviewView';
import { StudentReportView } from './StudentReportView';
import { SubjectReportView } from './SubjectReportView';
import { SectionReportView } from './SectionReportView';
import { FacultyReportView } from './FacultyReportView';
import { FacultyReportsWorkspace } from './FacultyReportsWorkspace';
import { useAuth } from '@/context/AuthContext';

interface BreadcrumbItem {
  type: ReportType;
  id?: string;
  label: string;
}

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const roleCode = user?.role?.code || (typeof (user as any)?.role === 'string' ? (user as any).role : '');
  const isFaculty = roleCode === 'FACULTY' || !!user?.faculty;

  if (isFaculty) {
    return <FacultyReportsWorkspace />;
  }

  const [reportType, setReportType] = useState<ReportType>('overview');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [reportData, setReportData] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Breadcrumbs history stack for cross-entity navigation
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { type: 'overview', label: 'Institutional Overview' },
  ]);

  // Load filter options on mount or when department changes
  const fetchFilterOptions = useCallback(async (deptId?: string) => {
    try {
      const endpoint = deptId
        ? `/reports/filter-options?departmentId=${encodeURIComponent(deptId)}`
        : '/reports/filter-options';
      const res = await api.get(endpoint);
      if (res.data?.data) {
        setFilterOptions(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load report filter options:', err);
    }
  }, []);

  useEffect(() => {
    fetchFilterOptions(selectedDepartmentId);
  }, [fetchFilterOptions, selectedDepartmentId]);

  // Load institutional overview
  const fetchOverview = useCallback(async (deptId?: string, start?: string, end?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (deptId) params.append('departmentId', deptId);
      if (start) params.append('startDate', start);
      if (end) params.append('endDate', end);

      const endpoint = `/reports/analytics/overview${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await api.get(endpoint);
      setOverviewData(res.data?.data || null);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load institutional overview.');
      setOverviewData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load entity-specific report (student, subject, section, faculty)
  const fetchEntityReport = useCallback(
    async (type: ReportType, entityId: string, start?: string, end?: string) => {
      if (!entityId || type === 'overview') return;

      setIsLoading(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        if (start) params.append('startDate', start);
        if (end) params.append('endDate', end);

        const endpoint = `/reports/${type}/${encodeURIComponent(entityId)}${
          params.toString() ? `?${params.toString()}` : ''
        }`;
        const res = await api.get(endpoint);
        setReportData(res.data?.data || null);
      } catch (err: any) {
        setErrorMsg(err.response?.data?.message || `Failed to generate ${type} report.`);
        setReportData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Initial load
  useEffect(() => {
    fetchOverview(selectedDepartmentId, startDate, endDate);
  }, [fetchOverview, selectedDepartmentId, startDate, endDate]);

  // Handle Apply button
  const handleApply = () => {
    if (reportType === 'overview') {
      fetchOverview(selectedDepartmentId, startDate, endDate);
      setBreadcrumbs([{ type: 'overview', label: 'Institutional Overview' }]);
    } else {
      if (!selectedEntityId) {
        toast.error(`Please select a ${reportType} to generate report.`);
        return;
      }
      fetchEntityReport(reportType, selectedEntityId, startDate, endDate);
    }
  };

  // Handle Reset button
  const handleReset = () => {
    setSelectedDepartmentId('');
    setSelectedEntityId('');
    setStartDate('');
    setEndDate('');
    setErrorMsg(null);
    setReportType('overview');
    setBreadcrumbs([{ type: 'overview', label: 'Institutional Overview' }]);
    fetchOverview(undefined, undefined, undefined);
  };

  // CSV Export
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('type', reportType);
      if (selectedEntityId && reportType !== 'overview') {
        params.append('targetId', selectedEntityId);
      }
      if (selectedDepartmentId) {
        params.append('departmentId', selectedDepartmentId);
      }
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const endpoint = `/reports/export/csv?${params.toString()}`;
      const res = await api.get(endpoint, { responseType: 'blob' });

      // Determine filename from response header or default
      const disposition = res.headers['content-disposition'];
      let filename = `inca-${reportType}-report.csv`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('CSV Report exported successfully.');
    } catch (err: any) {
      console.error('CSV export failed:', err);
      toast.error(err.response?.data?.message || 'Failed to export CSV report.');
    } finally {
      setIsExporting(false);
    }
  };

  // Drill-down to Student Report
  const handleDrillDownStudent = (studentId: string) => {
    setReportType('student');
    setSelectedEntityId(studentId);
    setBreadcrumbs((prev) => [
      ...prev,
      { type: 'student', id: studentId, label: 'Student Report' },
    ]);
    fetchEntityReport('student', studentId, startDate, endDate);
  };

  // Drill-down to Subject Report
  const handleDrillDownSubject = (subjectId: string) => {
    setReportType('subject');
    setSelectedEntityId(subjectId);
    setBreadcrumbs((prev) => [
      ...prev,
      { type: 'subject', id: subjectId, label: 'Subject Report' },
    ]);
    fetchEntityReport('subject', subjectId, startDate, endDate);
  };

  // Drill-down to Section Report
  const handleDrillDownSection = (sectionId: string) => {
    setReportType('section');
    setSelectedEntityId(sectionId);
    setBreadcrumbs((prev) => [
      ...prev,
      { type: 'section', id: sectionId, label: 'Section Report' },
    ]);
    fetchEntityReport('section', sectionId, startDate, endDate);
  };

  // Drill-down to Department filter
  const handleDrillDownDepartment = (deptId: string) => {
    setSelectedDepartmentId(deptId);
    setReportType('overview');
    setBreadcrumbs([{ type: 'overview', label: 'Institutional Overview' }]);
    fetchOverview(deptId, startDate, endDate);
  };

  // Navigate to previous breadcrumb
  const handleBreadcrumbClick = (item: BreadcrumbItem, index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setReportType(item.type);
    if (item.type === 'overview') {
      setSelectedEntityId('');
      fetchOverview(selectedDepartmentId, startDate, endDate);
    } else if (item.id) {
      setSelectedEntityId(item.id);
      fetchEntityReport(item.type, item.id, startDate, endDate);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-primary" />
            Super Admin Reports & Analytics Workspace
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Institutional operations, classroom attendance turnout, shortfall diagnostics, and statutory reporting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-muted/30 px-3 py-1 font-semibold">
            Statutory Threshold: 75%
          </Badge>
        </div>
      </div>

      {/* Interactive Breadcrumb Path */}
      {breadcrumbs.length > 1 && (
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg border border-border/60">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(crumb, idx)}
                  disabled={isLast}
                  className={`font-medium transition-colors cursor-pointer ${
                    isLast ? 'text-foreground font-bold cursor-default' : 'hover:text-primary hover:underline'
                  }`}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Filter Bar with Cascading Controls */}
      <ReportsFilterBar
        reportType={reportType}
        onReportTypeChange={(t) => {
          setReportType(t);
          setBreadcrumbs([
            {
              type: t,
              label: t === 'overview' ? 'Institutional Overview' : `${t.charAt(0).toUpperCase() + t.slice(1)} Report`,
            },
          ]);
          setReportData(null);
          if (t === 'overview') {
            fetchOverview(selectedDepartmentId, startDate, endDate);
          }
        }}
        filterOptions={filterOptions}
        selectedDepartmentId={selectedDepartmentId}
        onDepartmentChange={setSelectedDepartmentId}
        selectedEntityId={selectedEntityId}
        onEntityChange={setSelectedEntityId}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        onApply={handleApply}
        onReset={handleReset}
        onExportCsv={handleExportCsv}
        isLoading={isLoading}
        isExporting={isExporting}
      />

      {/* Error Alert Banner */}
      {errorMsg && (
        <Card className="p-4 bg-destructive/10 border-destructive/20 text-destructive text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleApply}
            className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            Retry
          </Button>
        </Card>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-medium">Generating analytics and processing records...</p>
        </div>
      )}

      {/* Main Views Container */}
      {!isLoading && (
        <>
          {/* Institutional Overview */}
          {reportType === 'overview' && overviewData && (
            <ReportsOverviewView
              data={overviewData}
              onDrillDownStudent={handleDrillDownStudent}
              onDrillDownDepartment={handleDrillDownDepartment}
            />
          )}

          {/* Student Report View */}
          {reportType === 'student' && reportData && (
            <StudentReportView
              data={reportData}
              onBack={() => {
                setReportType('overview');
                fetchOverview(selectedDepartmentId, startDate, endDate);
              }}
              onDrillDownSubject={handleDrillDownSubject}
              onDrillDownSection={handleDrillDownSection}
            />
          )}

          {/* Subject Report View */}
          {reportType === 'subject' && reportData && (
            <SubjectReportView
              data={reportData}
              onBack={() => {
                setReportType('overview');
                fetchOverview(selectedDepartmentId, startDate, endDate);
              }}
              onDrillDownStudent={handleDrillDownStudent}
              onDrillDownSection={handleDrillDownSection}
            />
          )}

          {/* Section Report View */}
          {reportType === 'section' && reportData && (
            <SectionReportView
              data={reportData}
              onBack={() => {
                setReportType('overview');
                fetchOverview(selectedDepartmentId, startDate, endDate);
              }}
              onDrillDownStudent={handleDrillDownStudent}
              onDrillDownSubject={handleDrillDownSubject}
            />
          )}

          {/* Faculty Report View */}
          {reportType === 'faculty' && reportData && (
            <FacultyReportView
              data={reportData}
              onBack={() => {
                setReportType('overview');
                fetchOverview(selectedDepartmentId, startDate, endDate);
              }}
              onDrillDownSubject={handleDrillDownSubject}
            />
          )}

          {/* Empty Prompt when non-overview report is selected but no entity selected yet */}
          {reportType !== 'overview' && !reportData && !isLoading && !errorMsg && (
            <Card className="border border-border/80 p-12 text-center shadow-2xs">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Select a {reportType.charAt(0).toUpperCase() + reportType.slice(1)} to Generate Report
                </h3>
                <p className="text-xs text-muted-foreground">
                  Use the searchable filter controls above to pick a {reportType} by name, roll number, or code, then click "Generate Report".
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
export default ReportsPage;
