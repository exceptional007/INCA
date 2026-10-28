import React, { useState } from 'react';
import type { LostFoundReport, LostFoundClaim } from '@/types/lost-found';
import { lostFoundApi } from '@/services/lost-found';
import { X, ShieldCheck, KeyRound, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: LostFoundReport;
  onClaimSuccess: (claim: LostFoundClaim) => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  isOpen,
  onClose,
  report,
  onClaimSuccess,
}) => {
  const [claimDetails, setClaimDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedClaim, setSubmittedClaim] = useState<LostFoundClaim | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimDetails.trim()) {
      setError('Please provide distinguishing details to verify your ownership');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const claim = await lostFoundApi.submitClaim(report.id, {
        claimDetails: claimDetails.trim(),
      });
      setSubmittedClaim(claim);
      onClaimSuccess(claim);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit claim. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (submittedClaim?.verificationCode) {
      navigator.clipboard.writeText(submittedClaim.verificationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-border shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Claim Ownership: {report.title}
              </h2>
              <p className="text-xs text-slate-500">
                Found at {report.location}
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

        {/* Body */}
        <div className="p-6 space-y-4">
          {submittedClaim ? (
            /* Success & 6-digit OTP Display */
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Claim Filed Successfully!</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  The finder has been notified. When meeting on campus, show them your 6-digit
                  handover verification code below:
                </p>
              </div>

              {submittedClaim.verificationCode && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl inline-block mx-auto">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-action-blue" />
                    Handover Verification OTP
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-2xl font-black text-slate-900 tracking-widest">
                      {submittedClaim.verificationCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                      title="Copy OTP"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {copied && (
                    <span className="text-[10px] text-emerald-600 font-medium">Copied to clipboard!</span>
                  )}
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                You can also access this code at any time under your "My Items & Claims" tab.
              </p>

              <div className="pt-2">
                <Button onClick={onClose} className="w-full text-xs h-9 font-semibold">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* Claim Submission Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Anti-Fraud Ownership Verification
                </span>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Provide unique distinguishing features only the genuine owner would know (e.g.,
                  exact stickers, scratches, contents inside, password hint, lockscreen wallpaper, or
                  receipt serial number).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Distinguishing Proof Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. My keys have a red Batman keychain with a small chipped corner. There are two brass door keys and one Honda bike key."
                  value={claimDetails}
                  onChange={(e) => setClaimDetails(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-action-blue"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isSubmitting ? 'Submitting Claim...' : 'Submit Claim & Get OTP'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

