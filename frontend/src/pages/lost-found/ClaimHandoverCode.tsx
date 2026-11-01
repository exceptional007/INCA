import { useState } from 'react';
import type { LostFoundClaim } from '@/types/lost-found';
import { lostFoundApi } from '@/services/lost-found';
import { Button } from '@/components/ui/button';

export const ClaimHandoverCode = ({ claim, onUpdated }: { claim: LostFoundClaim; onUpdated: () => void }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (claim.status !== 'APPROVED') return null;
  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await lostFoundApi.regenerateHandoverCode(claim.id);
      onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to generate a fresh code.');
    } finally { setBusy(false); }
  };
  return (
    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
      <span className="text-xs font-bold text-emerald-800">Your Handover Code</span>
      {claim.verificationCode && <div className="font-mono text-xl font-black tracking-widest">{claim.verificationCode}</div>}
      <p className="text-xs text-emerald-800">
        {claim.verificationCodeExpiresAt ? `Expires ${new Date(claim.verificationCodeExpiresAt).toLocaleString()}.` : 'Generate a fresh code before handover.'}
        {' '}Codes last 15 minutes and allow five failed attempts. Share only when collecting your item.
      </p>
      <Button size="sm" variant="outline" disabled={busy} onClick={refresh}>
        {busy ? 'Generating…' : 'Generate New Code'}
      </Button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
};
