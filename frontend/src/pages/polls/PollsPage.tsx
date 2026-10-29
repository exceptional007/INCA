import React, { useState, useEffect, useRef } from 'react';
import {
  Vote,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Archive,
  Layers,
  Sparkles,
  Users,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import gsap from 'gsap';
import { useAuth } from '@/context/AuthContext';
import { pollsApi } from '@/services/polls';
import type { PollItem } from '@/types/polls';
import { PollCard } from './components/PollCard';
import { CreatePollModal } from './components/CreatePollModal';
import { VoteModal } from './components/VoteModal';
import { PollResultsModal } from './components/PollResultsModal';
import { VoterReportModal } from './components/VoterReportModal';

type TabKey = 'ALL' | 'ACTIVE' | 'MY_POLLS' | 'PARTICIPATED' | 'CLOSED';

export const PollsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('ACTIVE');
  const [search, setSearch] = useState('');
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [votingPoll, setVotingPoll] = useState<PollItem | null>(null);
  const [resultsPoll, setResultsPoll] = useState<PollItem | null>(null);
  const [voterReportPoll, setVoterReportPoll] = useState<PollItem | null>(null);

  // Delete confirmation
  const [pollToDelete, setPollToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // GSAP animation container
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const fetchPolls = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await pollsApi.getPolls({
        tab: activeTab,
        search: search.trim() || undefined,
      });
      setPolls(res.items || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load community polls.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, [activeTab]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPolls();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Entrance and tab change GSAP animation
  useEffect(() => {
    if (isLoading) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (!prefersReducedMotion && gridRef.current) {
      const cards = gridRef.current.children;
      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.05,
            ease: 'power2.out',
          },
        );
      }
    }
  }, [polls, isLoading]);

  const handleDeleteConfirm = async () => {
    if (!pollToDelete) return;
    try {
      setIsDeleting(true);
      await pollsApi.deletePoll(pollToDelete);
      setPollToDelete(null);
      fetchPolls();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete poll.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Stats computation
  const totalCount = polls.length;
  const activeCount = polls.filter((p) => !p.isExpired).length;
  const votedCount = polls.filter((p) => p.hasVoted).length;
  const createdByMeCount = polls.filter((p) => p.creator.id === user?.id).length;

  return (
    <div ref={pageContainerRef} className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md text-blue-200 border border-white/10">
              <Vote className="h-3.5 w-3.5 text-blue-300" />
              <span>Campus Governance & Feedback</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Community Polls & Institutional Ballots
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Participate in institutional decisions, campus surveys, and democratic academic feedback. Verified votes, authoritative tallies, and strict anonymity protection.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 active:scale-95 transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Poll</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-6 border-t border-white/10">
          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-sm border border-white/5">
            <div className="flex items-center gap-2 text-blue-200 text-xs">
              <Layers className="h-3.5 w-3.5" />
              <span>Filtered Polls</span>
            </div>
            <p className="mt-1 font-mono text-xl font-bold">{totalCount}</p>
          </div>

          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-sm border border-white/5">
            <div className="flex items-center gap-2 text-emerald-300 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active Ballots</span>
            </div>
            <p className="mt-1 font-mono text-xl font-bold">{activeCount}</p>
          </div>

          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-sm border border-white/5">
            <div className="flex items-center gap-2 text-indigo-200 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Your Ballots Cast</span>
            </div>
            <p className="mt-1 font-mono text-xl font-bold">{votedCount}</p>
          </div>

          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-sm border border-white/5">
            <div className="flex items-center gap-2 text-amber-200 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Authored by You</span>
            </div>
            <p className="mt-1 font-mono text-xl font-bold">{createdByMeCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tab Buttons */}
        <div className="flex items-center overflow-x-auto rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-slate-900 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'ACTIVE'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Active Ballots</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>All Eligible</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PARTICIPATED')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'PARTICIPATED'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Voted</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MY_POLLS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'MY_POLLS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>My Polls</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CLOSED')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'CLOSED'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archive (15d)</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search polls by topic..."
            className="w-full rounded-2xl border border-slate-200/90 bg-white py-2 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
          <p className="text-xs font-medium">Synchronizing campus ballots...</p>
        </div>
      ) : polls.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/60 p-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <Vote className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No Community Polls Found
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            {search
              ? 'No polls match your search query. Try different keywords.'
              : activeTab === 'ACTIVE'
              ? 'There are currently no active ballots open for voting in your eligibility group.'
              : activeTab === 'MY_POLLS'
              ? 'You have not authored any polls yet. Click "Create Poll" to begin.'
              : activeTab === 'PARTICIPATED'
              ? 'You have not cast a vote in any polls yet.'
              : 'No closed polls found within the 15-day retention window.'}
          </p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Poll</span>
          </button>
        </div>
      ) : (
        /* Polls Grid */
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              currentUserId={user?.id}
              userRole={user?.role?.code}
              onVote={(p) => setVotingPoll(p)}
              onViewResults={(p) => setResultsPoll(p)}
              onViewVoters={(p) => setVoterReportPoll(p)}
              onDelete={(id) => setPollToDelete(id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreatePollModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => fetchPolls()}
      />

      <VoteModal
        poll={votingPoll}
        isOpen={Boolean(votingPoll)}
        onClose={() => setVotingPoll(null)}
        onVoted={() => {
          setVotingPoll(null);
          fetchPolls();
        }}
      />

      <PollResultsModal
        poll={resultsPoll}
        isOpen={Boolean(resultsPoll)}
        currentUserId={user?.id}
        userRole={user?.role?.code}
        onClose={() => setResultsPoll(null)}
        onOpenVoterReport={(p) => setVoterReportPoll(p)}
      />

      <VoterReportModal
        poll={voterReportPoll}
        isOpen={Boolean(voterReportPoll)}
        onClose={() => setVoterReportPoll(null)}
      />

      {/* Delete Confirmation Modal */}
      {pollToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Delete Poll?
            </h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to delete this poll? This action cannot be undone, and existing ballots will be archived.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPollToDelete(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
