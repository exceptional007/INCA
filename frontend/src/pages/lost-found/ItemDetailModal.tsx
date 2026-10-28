import React, { useState } from 'react';
import type { LostFoundReport, LostFoundClaim } from '@/types/lost-found';
import { getCategoryIcon, formatCategoryLabel } from './ItemCard';
import {
  X,
  MapPin,
  Calendar,
  Sparkles,
  ShieldCheck,
  User,
  Clock,
  KeyRound,
  Check,
  XCircle,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: LostFoundReport;
  currentUserId?: string;
  onOpenClaim: (item: LostFoundReport) => void;
  onOpenMatches: (item: LostFoundReport) => void;
  onVerifyHandover: (claim: LostFoundClaim) => void;
  onReviewClaim?: (claimId: string, status: 'APPROVED' | 'REJECTED') => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  currentUserId,
  onOpenClaim,
  onOpenMatches,
  onVerifyHandover,
  onReviewClaim,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!isOpen) return null;

  const isLost = item.type === 'LOST';
  const isOwner = currentUserId && item.reporterId === currentUserId;
  const CategoryIcon = getCategoryIcon(item.category);
  const images = item.images || [];
  const matchesCount = (item._count?.lostMatches || 0) + (item._count?.foundMatches || 0);

  const getImageUrl = (urlOrKey?: string | null) => {
    if (!urlOrKey) return '';
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) return urlOrKey;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    return `${apiUrl.replace(/\/api\/v1\/?$/, '')}/api/storage/photo/${urlOrKey}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-border shadow-xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide flex items-center gap-1.5 ${
                isLost
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLost ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
              {isLost ? 'Lost Item Report' : 'Found Item Report'}
            </span>
            <Badge variant="outline" className="text-xs">
              {item.status}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Image Gallery */}
          {images.length > 0 ? (
            <div className="space-y-2">
              <div className="h-64 sm:h-72 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                <img
                  src={getImageUrl(images[activeImageIndex]?.url || images[activeImageIndex]?.storageKey)}
                  alt={item.title}
                  className="w-full h-full object-contain"
                />
              </div>
              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                        activeImageIndex === idx ? 'border-action-blue ring-2 ring-action-blue/20' : 'border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={getImageUrl(img.url || img.storageKey)}
                        alt="thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-36 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-1.5">
              <CategoryIcon className="w-10 h-10" />
              <span className="text-xs font-medium text-slate-500">
                No photos uploaded for this report
              </span>
            </div>
          )}

          {/* Title & Category Info */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-action-blue uppercase tracking-wider flex items-center gap-1">
                <CategoryIcon className="w-3.5 h-3.5" />
                {formatCategoryLabel(item.category)}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 leading-snug">
              {item.title}
            </h2>
            <p className="text-xs text-slate-600 mt-2 whitespace-pre-line leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Key Meta Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] font-medium mb-0.5">Location</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{item.location}</span>
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-medium mb-0.5">Date</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{new Date(item.approximateDate).toLocaleDateString()}</span>
              </span>
            </div>

            {item.approximateTime && (
              <div>
                <span className="text-slate-400 block text-[11px] font-medium mb-0.5">Time</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{item.approximateTime}</span>
                </span>
              </div>
            )}

            <div>
              <span className="text-slate-400 block text-[11px] font-medium mb-0.5">Reported By</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{item.reporterName || 'Campus Peer'}</span>
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-medium mb-0.5">Report ID</span>
              <span className="font-mono text-[11px] text-slate-600 truncate block">
                {item.id.slice(0, 8)}...
              </span>
            </div>
          </div>

          {/* Distinguishing Features */}
          {item.distinguishingFeatures && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Distinguishing Marks & Hidden Features
              </span>
              <p className="text-xs text-amber-900 font-mono leading-relaxed">
                {item.distinguishingFeatures}
              </p>
            </div>
          )}

          {/* Contact Preference */}
          {item.contactPreference && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-0.5">
              <span className="text-slate-400 font-medium">Handover Instructions:</span>
              <p className="text-slate-800 font-medium">{item.contactPreference}</p>
            </div>
          )}

          {/* Owner Claim Review Section (if report is owned by current user and has claims) */}
          {isOwner && item.claims && item.claims.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-action-blue" />
                Ownership Claims Received ({item.claims.length})
              </h4>

              <div className="space-y-2">
                {item.claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {claim.claimantName || 'Claimant'}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {claim.status}
                      </Badge>
                    </div>

                    <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 italic">
                      "{claim.claimDetails}"
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">
                        Submitted {new Date(claim.createdAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {claim.status === 'PENDING' && onReviewClaim && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px] h-7 text-rose-600 hover:bg-rose-50"
                              onClick={() => onReviewClaim(claim.id, 'REJECTED')}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px] h-7 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => onReviewClaim(claim.id, 'APPROVED')}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                          </>
                        )}

                        {claim.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            className="text-[11px] h-7 bg-action-blue hover:bg-action-blue/90 text-white font-semibold"
                            onClick={() => onVerifyHandover(claim)}
                          >
                            <Award className="w-3 h-3 mr-1" />
                            Verify Handover OTP (+20 Pts)
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-slate-50/50 flex items-center justify-between">
          <div>
            {matchesCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5"
                onClick={() => onOpenMatches(item)}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                View {matchesCount} AI Matches
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8"
            >
              Close
            </Button>

            {!isLost && !isOwner && item.status === 'OPEN' && (
              <Button
                size="sm"
                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
                onClick={() => onOpenClaim(item)}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Claim Ownership
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

