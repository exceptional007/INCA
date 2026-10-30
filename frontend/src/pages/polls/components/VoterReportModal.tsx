import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Search,
  Users,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { pollsApi } from '@/services/polls';
import type { PollItem, VoterReportResponse } from '@/types/polls';

interface VoterReportModalProps {
  poll: PollItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VoterReportModal: React.FC<VoterReportModalProps> = ({
  poll,
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<VoterReportResponse | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && poll) {
      setIsLoading(true);
      setError(null);
      pollsApi
        .getVoterReport(poll.id)
        .then((res) => setData(res))
        .catch((err) => {
          setError(
            err?.response?.data?.message ||
            err?.message ||
            'Failed to retrieve voter roster.',
          );
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, poll]);

  if (!isOpen || !poll) return null;

  const filteredVoters = (data?.voters || []).filter((v) => {
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q) ||
      v.department.toLowerCase().includes(q) ||
      v.idNumber.toLowerCase().includes(q) ||
      v.selectedOptions.some((opt) => opt.toLowerCase().includes(q))
    );
  });

  const handleExportCSV = () => {
    if (!data?.voters.length) return;

    const headers = [
      'Name',
      'Email',
      'Role',
      'Department',
      'ID / Enrollment',
      'Selected Options',
      'Voted At',
    ];

    const rows = data.voters.map((v) => [
      `"${v.name}"`,
      `"${v.email}"`,
      `"${v.role}"`,
      `"${v.department}"`,
      `"${v.idNumber}"`,
      `"${v.selectedOptions.join('; ')}"`,
      `"${new Date(v.votedAt).toLocaleString()}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `voter-report-${poll.id.slice(0, 8)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Voter Audit Roster
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Authorized participant verification for identified poll
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Question Banner & Search */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-800/40">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {poll.question}
          </h3>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID, or option..."
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {/* Export CSV Button */}
            {data && data.voters.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors w-full sm:w-auto justify-center"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Export CSV Roster</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Table / List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs">Loading voter audit data...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : filteredVoters.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">
                {search ? 'No voters match your search query.' : 'No votes recorded yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 pr-4">Voter Profile</th>
                    <th className="pb-3 pr-4">Department / ID</th>
                    <th className="pb-3 pr-4">Choice Selection</th>
                    <th className="pb-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredVoters.map((voter) => (
                    <tr key={voter.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 text-xs dark:bg-blue-900 dark:text-blue-200 shrink-0">
                            {voter.name.charAt(0)}
                          </div>
                          <div className="truncate">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {voter.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {voter.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-700 dark:text-slate-300">
                          {voter.department}
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">
                          {voter.idNumber}
                        </p>
                      </td>

                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {voter.selectedOptions.map((opt, i) => (
                            <span
                              key={i}
                              className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(voter.votedAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <span className="text-xs text-slate-400">
            {data?.voters.length || 0} total participants recorded
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
