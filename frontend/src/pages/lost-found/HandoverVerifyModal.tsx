import React, { useState } from 'react';
import type { LostFoundClaim } from '@/types/lost-found';
import { lostFoundApi } from '@/services/lost-found';
import { X, ShieldCheck, KeyRound, AlertCircle, Award, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HandoverVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  claim: LostFoundClaim;
  onSuccess: (verifiedClaim: LostFoundClaim) => void;
}

export const HandoverVerifyModal: React.FC<HandoverVerifyModalProps> = ({
  isOpen,
  onClose,
  claim,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const verified = await lostFoundApi.verifyClaimHandover(claim.id, code.trim());
      setSuccess(true);
      onSuccess(verified);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'Invalid verification code. Please confirm the 6-digit OTP with the recipient.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full border border-border shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-action-blue/10 text-action-blue flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Verify Item Handover</h2>
              <p className="text-xs text-slate-500">
                Claimant: {claim.claimantName || 'Campus Member'}
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

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-3 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Handover Complete!</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Item marked as safely returned.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2 text-emerald-800">
                <Award className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-bold">+20 Campus Contribution Points Awarded!</span>
              </div>

              <Button onClick={onClose} className="w-full text-xs h-9 font-semibold">
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Physical Handover Security
                </span>
                <p className="text-[11px] leading-relaxed">
                  Ask the person receiving the item for the 6-digit OTP displayed on their screen.
                  Entering this code confirms you have handed over the item safely on campus.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
                  Enter 6-Digit Recipient OTP Code
                </label>
                <div className="max-w-[200px] mx-auto">
                  <Input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center font-mono text-2xl tracking-widest h-12 font-bold bg-slate-50 border-slate-300 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
                  disabled={isSubmitting || code.length !== 6}
                  className="text-xs h-9 bg-action-blue hover:bg-action-blue/90 text-white font-semibold flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify & Complete Handover'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

