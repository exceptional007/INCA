import React from 'react';
import type { LostFoundMatch } from '@/types/lost-found';
import { lostFoundApi } from '@/services/lost-found';
import {
  X,
  Sparkles,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AiMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: LostFoundMatch[];
  onMatchUpdated: () => void;
}

export const AiMatchesModal: React.FC<AiMatchesModalProps> = ({
  isOpen,
  onClose,
  matches,
  onMatchUpdated,
}) => {
  if (!isOpen) return null;

  const handleReviewMatch = async (matchId: string, status: 'VERIFIED_MATCH' | 'REJECTED') => {
    try {
      await lostFoundApi.reviewMatch(matchId, status);
      onMatchUpdated();
    } catch (err) {
      console.error('Failed to review match:', err);
    }
  };

  const getImageUrl = (urlOrKey?: string | null) => {
    if (!urlOrKey) return null;
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) return urlOrKey;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    return `${apiUrl.replace(/\/api\/v1\/?$/, '')}/api/storage/photo/${urlOrKey}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-border shadow-xl my-8 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Gemini AI Match Results ({matches.length})
              </h2>
              <p className="text-xs text-slate-500">
                Multi-stage semantic similarity and location proximity analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matches List */}
        <div className="p-6 overflow-y-auto space-y-6">
          {matches.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium">No candidate matches found yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Our AI continuously evaluates incoming lost & found reports across campus.
              </p>
            </div>
          ) : (
            matches.map((match) => {
              const score = Math.round(match.matchingScore);
              const isHigh = score >= 75;
              const lostImg = match.lostReport?.images?.[0]?.url || match.lostReport?.images?.[0]?.storageKey;
              const foundImg = match.foundReport?.images?.[0]?.url || match.foundReport?.images?.[0]?.storageKey;

              return (
                <div
                  key={match.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-4 hover:shadow-xs transition-shadow"
                >
                  {/* Match Header with Confidence Pill */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                          isHigh
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {score}% Confidence ({isHigh ? 'Strong Match' : 'Possible Match'})
                      </span>
                      {match.status === 'VERIFIED_MATCH' && (
                        <Badge className="bg-emerald-600 text-white text-[10px]">Verified Match</Badge>
                      )}
                      {match.status === 'REJECTED' && (
                        <Badge variant="outline" className="text-slate-400 text-[10px]">Dismissed</Badge>
                      )}
                    </div>
                  </div>

                  {/* Side by Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Lost Item Card */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Lost Item
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {match.lostReport?.reporterName || 'Student'}
                        </span>
                      </div>

                      {lostImg && (
                        <div className="h-28 rounded-md overflow-hidden bg-slate-100">
                          <img
                            src={getImageUrl(lostImg) || ''}
                            alt="lost item"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <h4 className="font-semibold text-slate-900 text-xs">
                        {match.lostReport?.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {match.lostReport?.description}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {match.lostReport?.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {match.lostReport?.approximateDate &&
                            new Date(match.lostReport.approximateDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Found Item Card */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Found Item
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {match.foundReport?.reporterName || 'Finder'}
                        </span>
                      </div>

                      {foundImg && (
                        <div className="h-28 rounded-md overflow-hidden bg-slate-100">
                          <img
                            src={getImageUrl(foundImg) || ''}
                            alt="found item"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <h4 className="font-semibold text-slate-900 text-xs">
                        {match.foundReport?.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {match.foundReport?.description}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {match.foundReport?.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {match.foundReport?.approximateDate &&
                            new Date(match.foundReport.approximateDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Reasoning Box */}
                  {match.matchReason && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-lg text-xs text-amber-900 space-y-1">
                      <span className="font-bold flex items-center gap-1 text-[11px] text-amber-800">
                        <Sparkles className="w-3 h-3" />
                        Gemini AI Semantic Analysis
                      </span>
                      <p className="text-[11px] leading-relaxed text-amber-900">
                        {match.matchReason}
                      </p>
                    </div>
                  )}

                  {/* Match Review Actions */}
                  {match.status === 'PENDING_REVIEW' && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7.5 text-slate-600 hover:bg-slate-100"
                        onClick={() => handleReviewMatch(match.id, 'REJECTED')}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Dismiss Candidate
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="text-xs h-7.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleReviewMatch(match.id, 'VERIFIED_MATCH')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Confirm Valid Match
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

