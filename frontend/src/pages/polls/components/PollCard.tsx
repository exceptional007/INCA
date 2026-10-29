import React, { useState, useEffect } from 'react';
import {
  Clock,
  Shield,
  CheckCircle2,
  Users,
  BarChart2,
  Trash2,
  FileText,
  UserCheck,
  Layers,
  Lock,
} from 'lucide-react';
import type { PollItem } from '@/types/polls';

interface PollCardProps {
  poll: PollItem;
  currentUserId?: string;
  userRole?: string;
  onVote: (poll: PollItem) => void;
  onViewResults: (poll: PollItem) => void;
  onViewVoters: (poll: PollItem) => void;
  onDelete: (pollId: string) => void;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  currentUserId,
  userRole,
  onVote,
  onViewResults,
  onViewVoters,
  onDelete,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpiredLocal, setIsExpiredLocal] = useState<boolean>(poll.isExpired);

  const isCreator = currentUserId && poll.creator.id === currentUserId;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((userRole || '').toUpperCase());
  const canDelete = isCreator || isAdmin;
  const canSeeVoterReport = (isCreator || isAdmin) && !poll.isAnonymous;

  // Countdown timer calculation
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const expiry = new Date(poll.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setIsExpiredLocal(true);
        setTimeLeft('Closed');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const pad = (n: number) => n.toString().padStart(2, '0');

      if (days > 0) {
        setTimeLeft(`${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      } else {
        setTimeLeft(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [poll.expiresAt]);

  return (
    <div data-poll-card="true" className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-slate-900/90">
      <div>
        {/* Top Meta Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Status & Expiry Badge */}
            {isExpiredLocal ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <Clock className="h-3 w-3" /> Closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                {timeLeft || 'Ending soon'}
              </span>
            )}

            {/* Voting Mode Badge */}
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <Layers className="h-3 w-3" />
              {poll.votingMode === 'MULTIPLE_CHOICE' ? 'Multi-Choice' : 'Single-Choice'}
            </span>

            {/* Anonymity Badge */}
            {poll.isAnonymous ? (
              <span
                title="Strict anonymous ballot: vote choices are never tied to user profile"
                className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 cursor-help"
              >
                <Shield className="h-3 w-3" /> Anonymous
              </span>
            ) : (
              <span
                title="Identified voting: organizers can generate a participant report"
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 cursor-help"
              >
                <UserCheck className="h-3 w-3" /> Identified
              </span>
            )}
          </div>

          {/* User Participation Check */}
          {poll.hasVoted && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Voted
            </span>
          )}
        </div>

        {/* Question & Description */}
        <div className="mt-1">
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 transition-colors">
            {poll.question}
          </h3>
          {poll.description && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {poll.description}
            </p>
          )}
        </div>

        {/* Preview of Options / Results */}
        <div className="mt-4 space-y-2">
          {poll.options.slice(0, 3).map((opt) => {
            const showTally = poll.canViewResults && opt.percentage !== undefined;
            return (
              <div
                key={opt.id}
                className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2 text-xs transition-colors dark:border-white/5 dark:bg-slate-800/40"
              >
                {/* Progress bar background */}
                {showTally && (
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-100/60 transition-all duration-500 dark:bg-blue-900/30"
                    style={{ width: `${opt.percentage || 0}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between z-10">
                  <div className="flex items-center gap-2 truncate pr-2">
                    {opt.isSelectedByMe && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                    )}
                    <span
                      className={`truncate font-medium ${
                        opt.isSelectedByMe
                          ? 'text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.text}
                    </span>
                  </div>
                  {showTally ? (
                    <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      {opt.percentage}%
                    </span>
                  ) : (
                    <Lock className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}

          {poll.options.length > 3 && (
            <p className="text-right text-[11px] text-slate-400">
              +{poll.options.length - 3} more options
            </p>
          )}

          {!poll.canViewResults && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-1.5 text-[11px] text-slate-400 dark:border-slate-800">
              <Lock className="h-3 w-3" />
              <span>Results hidden until voting closes</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="mt-5 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>
              <strong className="font-semibold text-slate-700 dark:text-slate-200">
                {poll.totalVotes}
              </strong>{' '}
              {poll.totalVotes === 1 ? 'vote' : 'votes'}
            </span>
          </div>

          <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
            by {poll.creator.name}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {canSeeVoterReport && (
              <button
                type="button"
                onClick={() => onViewVoters(poll)}
                title="View Voter Roster & Audit"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Roster</span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(poll.id)}
                title="Delete Poll"
                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50/50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onViewResults(poll)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Details</span>
            </button>

            {!isExpiredLocal && !poll.hasVoted && (
              <button
                type="button"
                onClick={() => onVote(poll)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors active:scale-95"
              >
                <span>Vote Now</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
