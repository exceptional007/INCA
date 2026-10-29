import React, { useState } from 'react';
import { X, Shield, UserCheck, AlertCircle, Check } from 'lucide-react';
import { pollsApi } from '@/services/polls';
import type { PollItem } from '@/types/polls';

interface VoteModalProps {
  poll: PollItem | null;
  isOpen: boolean;
  onClose: () => void;
  onVoted: (updatedPoll: PollItem) => void;
}

export const VoteModal: React.FC<VoteModalProps> = ({
  poll,
  isOpen,
  onClose,
  onVoted,
}) => {
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !poll) return null;

  const isMulti = poll.votingMode === 'MULTIPLE_CHOICE';

  const handleSelect = (optionId: string) => {
    if (isMulti) {
      if (selectedOptionIds.includes(optionId)) {
        setSelectedOptionIds(selectedOptionIds.filter((id) => id !== optionId));
      } else {
        setSelectedOptionIds([...selectedOptionIds, optionId]);
      }
    } else {
      setSelectedOptionIds([optionId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedOptionIds.length === 0) {
      setError('Please select at least one option before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await pollsApi.submitVote(poll.id, {
        optionIds: selectedOptionIds,
      });
      onVoted(updated);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to record your vote. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Cast Your Ballot
            </h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {isMulti ? 'Multiple Choice' : 'Single Choice'}
            </span>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Privacy Guarantee Notice */}
          {poll.isAnonymous ? (
            <div className="flex items-start gap-3 rounded-xl border border-purple-200/80 bg-purple-50/70 p-3 text-xs text-purple-900 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-300">
              <Shield className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
              <div>
                <p className="font-semibold">Anonymous Ballot</p>
                <p className="text-[11px] text-purple-700 dark:text-purple-300/80 mt-0.5">
                  Your response is decoupled from your user identity. The database records your vote without storing your voter identity in the answers table.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              <UserCheck className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold">Identified Poll</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5">
                  Your campus profile and selected choices will be visible to the poll organizer in an authorized voter roster.
                </p>
              </div>
            </div>
          )}

          {/* Question & Context */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              {poll.question}
            </h3>
            {poll.description && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {poll.description}
              </p>
            )}
          </div>

          {/* Options Choice List */}
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {isMulti ? 'Select all that apply:' : 'Select one option:'}
            </p>

            {poll.options.map((option) => {
              const isSelected = selectedOptionIds.includes(option.id);

              return (
                <div
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className={`group flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition-all duration-200 select-none ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 shadow-sm dark:border-blue-500 dark:bg-blue-950/30'
                      : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 pr-2">
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
                        isMulti ? 'rounded-md' : 'rounded-full'
                      } ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                          : 'border-slate-300 group-hover:border-slate-400 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <span
                      className={`text-xs font-medium leading-relaxed ${
                        isSelected
                          ? 'text-blue-900 dark:text-blue-200 font-semibold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {option.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedOptionIds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Vote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

