import React, { useState, useEffect } from 'react';
import type { MarketplaceReport, ReportStatus } from '@/types/marketplace';
import { marketplaceApi } from '@/services/marketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Loader2,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

export const ModerationQueue: React.FC = () => {
  const [reports, setReports] = useState<MarketplaceReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'ALL'>('OPEN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await marketplaceApi.getModerationReports(
        statusFilter === 'ALL' ? undefined : statusFilter,
      );
      setReports(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  const handleResolve = async (
    reportId: string,
    status: ReportStatus,
    removeListing: boolean = false,
  ) => {
    try {
      setSubmittingAction(true);
      await marketplaceApi.resolveReport(reportId, {
        status,
        resolutionNote: resolutionNote.trim() || undefined,
        removeListing,
      });
      setActiveReportId(null);
      setResolutionNote('');
      loadReports();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update report');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-card border rounded-xl shadow-2xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-amber-600" />
          <h2 className="text-base font-bold text-foreground">Department Moderation Queue</h2>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-2xs"
          >
            <option value="OPEN">Open Reports</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="ACTION_TAKEN">Action Taken</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="RESOLVED">Resolved</option>
            <option value="ALL">All Reports</option>
          </select>
          <Button size="icon" variant="outline" onClick={loadReports} className="size-8">
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-xl text-muted-foreground">
          <CheckCircle className="size-8 mx-auto text-emerald-500 mb-2" />
          <p className="text-sm font-semibold text-foreground">All Clear</p>
          <p className="text-xs">No moderation reports matching this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const reporterName = report.reporter?.student
              ? `${report.reporter.student.firstName} ${report.reporter.student.lastName || ''}`.trim()
              : report.reporter?.email || 'User';

            return (
              <div
                key={report.id}
                className="p-4 bg-card border rounded-xl shadow-2xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      {report.reason.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-semibold">
                      Status: {report.status}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Reported by {reporterName} on{' '}
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {report.listing && (
                  <div className="p-3 bg-muted/40 rounded-lg border flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground font-semibold uppercase">
                        Target Listing
                      </div>
                      <div className="font-bold text-sm text-foreground">
                        {report.listing.title} — ₹{report.listing.price.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Status: {report.listing.status}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase mb-1">
                    Report Details
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-background p-2.5 rounded border">
                    {report.description}
                  </p>
                </div>

                {report.resolutionNote && (
                  <div className="text-xs text-muted-foreground bg-emerald-50/50 border border-emerald-200 p-2.5 rounded">
                    <strong>Resolution Note:</strong> {report.resolutionNote}
                  </div>
                )}

                {report.status !== 'ACTION_TAKEN' && report.status !== 'RESOLVED' && (
                  <div className="pt-2 border-t flex flex-wrap items-center justify-end gap-2">
                    {activeReportId === report.id ? (
                      <div className="w-full space-y-2">
                        <textarea
                          rows={2}
                          placeholder="Resolution note (e.g. prohibited item removed, warning issued)..."
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          className="w-full text-xs p-2 border rounded"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setActiveReportId(null)}
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleResolve(report.id, 'ACTION_TAKEN', true)}
                            disabled={submittingAction}
                            className="h-7 text-xs"
                          >
                            Remove Listing & Take Action
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleResolve(report.id, 'RESOLVED', false)}
                            disabled={submittingAction}
                            className="h-7 text-xs"
                          >
                            Resolve (Keep Listing)
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolve(report.id, 'DISMISSED')}
                          className="h-7 text-xs text-muted-foreground"
                        >
                          Dismiss Report
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setActiveReportId(report.id);
                            setResolutionNote('');
                          }}
                          className="h-7 text-xs"
                        >
                          Take Action / Resolve
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
