import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { pollsApi } from '@/services/polls';
import type {
  CreatePollInput,
  PollVotingMode,
  PollResultVisibility,
  AcademicScopesResponse,
} from '@/types/polls';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [votingMode, setVotingMode] = useState<PollVotingMode>('SINGLE_CHOICE');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [resultVisibility, setResultVisibility] =
    useState<PollResultVisibility>('ALWAYS_PUBLIC');

  // Default expiry: 24 hours from now in local ISO string format
  const getDefaultExpiry = () => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [expiresAt, setExpiresAt] = useState<string>(getDefaultExpiry);
  const [resultsPublishAt, setResultsPublishAt] = useState<string>('');

  // Audience targeting
  const [targetScope, setTargetScope] = useState<string>('ALL');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [programId, setProgramId] = useState<string>('');
  const [targetSemester, setTargetSemester] = useState<string>('');
  const [targetBatch, setTargetBatch] = useState<string>('');

  const [scopes, setScopes] = useState<AcademicScopesResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch academic targeting scopes
  useEffect(() => {
    if (isOpen) {
      pollsApi
        .getAcademicScopes()
        .then((data) => setScopes(data))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      setError('Please provide a poll question.');
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError('Please provide at least two distinct options.');
      return;
    }

    if (new Set(cleanOptions).size !== cleanOptions.length) {
      setError('Option choices must be unique.');
      return;
    }

    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      setError('Poll expiry date & time must be in the future.');
      return;
    }

    if (resultVisibility === 'AFTER_EXPIRY' && resultsPublishAt) {
      const pubDate = new Date(resultsPublishAt);
      if (isNaN(pubDate.getTime()) || pubDate < expiryDate) {
        setError('Results reveal time must be on or after poll closure.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload: CreatePollInput = {
        question: cleanQuestion,
        description: description.trim() || undefined,
        options: cleanOptions,
        votingMode,
        isAnonymous,
        resultVisibility,
        expiresAt: expiryDate.toISOString(),
        resultsPublishAt:
          resultVisibility === 'AFTER_EXPIRY' && resultsPublishAt
            ? new Date(resultsPublishAt).toISOString()
            : undefined,
        targetScope,
        departmentId: departmentId || undefined,
        programId: programId || undefined,
        targetSemester: targetSemester ? parseInt(targetSemester, 10) : undefined,
        targetBatch: targetBatch.trim() || undefined,
      };

      await pollsApi.createPoll(payload);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to create poll. Please check your inputs.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Create Community Poll
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set up institutional decision polls, feedback ballots, or student surveys.
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Question */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Poll Question <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Should library open 24 hours during exam week?"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-800"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Context or Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide background context, rationale, or instructions for voters..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
            />
          </div>

          {/* Dynamic Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Poll Options <span className="text-rose-500">*</span>{' '}
                <span className="text-slate-400 font-normal">({options.length}/10)</span>
              </label>
              {options.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Option
                </button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400 shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Voting Controls: Single/Multi, Anonymity, Visibility */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Voting Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Selection Mode
              </label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50 dark:border-slate-700 dark:has-[:checked]:bg-blue-950/30">
                  <input
                    type="radio"
                    name="votingMode"
                    value="SINGLE_CHOICE"
                    checked={votingMode === 'SINGLE_CHOICE'}
                    onChange={() => setVotingMode('SINGLE_CHOICE')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Single Choice
                  </span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50 dark:border-slate-700 dark:has-[:checked]:bg-blue-950/30">
                  <input
                    type="radio"
                    name="votingMode"
                    value="MULTIPLE_CHOICE"
                    checked={votingMode === 'MULTIPLE_CHOICE'}
                    onChange={() => setVotingMode('MULTIPLE_CHOICE')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Multiple Choice
                  </span>
                </label>
              </div>
            </div>

            {/* Voting Identity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Identity & Privacy
              </label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 cursor-pointer has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50/50 dark:border-slate-700 dark:has-[:checked]:bg-purple-950/30">
                  <input
                    type="radio"
                    name="isAnonymous"
                    checked={isAnonymous === true}
                    onChange={() => setIsAnonymous(true)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex flex-col text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Anonymous Ballot
                    </span>
                    <span className="text-[10px] text-slate-400">Identity protected</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 cursor-pointer has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50/50 dark:border-slate-700 dark:has-[:checked]:bg-amber-950/30">
                  <input
                    type="radio"
                    name="isAnonymous"
                    checked={isAnonymous === false}
                    onChange={() => setIsAnonymous(false)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex flex-col text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Identified Vote
                    </span>
                    <span className="text-[10px] text-slate-400">Roster generated</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Results Visibility */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Results Visibility
              </label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 cursor-pointer has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50 dark:border-slate-700 dark:has-[:checked]:bg-emerald-950/30">
                  <input
                    type="radio"
                    name="resultVisibility"
                    value="ALWAYS_PUBLIC"
                    checked={resultVisibility === 'ALWAYS_PUBLIC'}
                    onChange={() => setResultVisibility('ALWAYS_PUBLIC')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex flex-col text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Live / Instant
                    </span>
                    <span className="text-[10px] text-slate-400">Tally seen anytime</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50 dark:border-slate-700 dark:has-[:checked]:bg-blue-950/30">
                  <input
                    type="radio"
                    name="resultVisibility"
                    value="AFTER_EXPIRY"
                    checked={resultVisibility === 'AFTER_EXPIRY'}
                    onChange={() => setResultVisibility('AFTER_EXPIRY')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex flex-col text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      After Closure
                    </span>
                    <span className="text-[10px] text-slate-400">Locked until end</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Expiry & Publication Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Voting Closes At <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {resultVisibility === 'AFTER_EXPIRY' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reveal Results At <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={resultsPublishAt}
                  onChange={(e) => setResultsPublishAt(e.target.value)}
                  placeholder="Defaults to voting closure"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Audience Targeting */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Audience Scope
              </label>
              <select
                value={targetScope}
                onChange={(e) => setTargetScope(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="ALL">Entire Campus (Everyone)</option>
                <option value="STUDENTS">Students Only</option>
                <option value="FACULTY">Faculty & Staff Only</option>
                <option value="DEPARTMENT">Specific Department</option>
                <option value="PROGRAM">Specific Program</option>
              </select>
            </div>

            {/* Department / Program Selectors */}
            {targetScope === 'DEPARTMENT' && scopes?.departments && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select Department...</option>
                  {scopes.departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetScope === 'PROGRAM' && scopes?.programs && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Program
                </label>
                <select
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select Program...</option>
                  {scopes.programs.map((prog) => (
                    <option key={prog.id} value={prog.id}>
                      {prog.name} ({prog.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Optional Semester & Batch */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Semester (Optional)
                </label>
                <select
                  value={targetSemester}
                  onChange={(e) => setTargetSemester(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Batch (Optional)
                </label>
                <input
                  type="text"
                  value={targetBatch}
                  onChange={(e) => setTargetBatch(e.target.value)}
                  placeholder="e.g. 2024-2028"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Publishing...' : 'Publish Poll'}
          </button>
        </div>
      </div>
    </div>
  );
};
