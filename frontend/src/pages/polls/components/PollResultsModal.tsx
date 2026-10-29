import React from 'react';
import {
  X,
  Users,
  CheckCircle2,
  Lock,
  FileText,
  Clock,
  Shield,
  UserCheck,
} from 'lucide-react';
import type { PollItem } from '@/types/polls';

interface PollResultsModalProps {
  poll: PollItem | null;
  isOpen: boolean;
  currentUserId?: string;
  userRole?: string;
  onClose: () => void;
  onOpenVoterReport: (poll: PollItem) => void;
}

export const PollResultsModal: React.FC<PollResultsModalProps> = ({
  poll,
  isOpen,
  currentUserId,
  userRole,
  onClose,
  onOpenVoterReport,
}) => {
  if (!isOpen || !poll) return null;

  const isCreator = currentUserId && poll.creator.id === currentUserId;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((userRole || '').toUpperCase());
  const canSeeVoterReport = (isCreator || isAdmin) && !poll.isAnonymous;

  const formattedDate = new Date(poll.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const expiryFormatted = new Date(poll.expiresAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Poll Analytics & Results
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Top Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {poll.isAnonymous ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                <Shield className="h-3 w-3" /> Anonymous Ballot
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <UserCheck className="h-3 w-3" /> Identified Voting
              </span>
            )}

            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Clock className="h-3 w-3" /> Closes: {expiryFormatted}
            </span>

            {poll.hasVoted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> You Participated
              </span>
            )}
          </div>

          {/* Question & Description */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {poll.question}
            </h3>
            {poll.description && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {poll.description}
              </p>
            )}
          </div>

          {/* Total Votes Stat */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs text-slate-400">Total Valid Ballots</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                  {poll.totalVotes}
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-slate-400">
              <p>Published on</p>
              <p className="font-medium text-slate-600 dark:text-slate-300">
                {formattedDate}
              </p>
            </div>
          </div>

          {/* Results Bars */}
          {poll.canViewResults ? (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Vote Distribution:
              </p>

              {poll.options.map((opt) => {
                const count = opt.voteCount || 0;
                const percentage = opt.percentage || 0;

                return (
                  <div
                    key={opt.id}
                    className="relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    {/* Background Progress Fill */}
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-700 ${
                        opt.isSelectedByMe
                          ? 'bg-blue-100/80 dark:bg-blue-900/40'
                          : 'bg-slate-100 dark:bg-slate-800/70'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />

                    {/* Content on top */}
                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        {opt.isSelectedByMe && (
                          <span
                            title="You voted for this option"
                            className="inline-flex items-center rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white shrink-0"
                          >
                            YOUR VOTE
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {opt.text}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {count} {count === 1 ? 'vote' : 'votes'}
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 min-w-[45px] text-right">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
              <Lock className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Results Concealed by Organizer
              </p>
              <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
                To prevent voter bias, voting tallies will be automatically revealed once the ballot officially closes.
              </p>
            </div>
          )}

          {/* Organizer / Admin Actions */}
          {canSeeVoterReport && (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    Organizer Voter Roster
                  </h4>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400/80">
                    View authorized list of verified voters and their ballot selections.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVoterReport(poll);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>View Roster</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

