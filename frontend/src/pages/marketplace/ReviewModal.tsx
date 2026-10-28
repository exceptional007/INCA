import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { marketplaceApi } from '@/services/marketplace';
import { Star, Loader2 } from 'lucide-react';

interface ReviewModalProps {
  transactionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onReviewed: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  transactionId,
  isOpen,
  onClose,
  onReviewed,
}) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId) return;

    try {
      setLoading(true);
      setError(null);
      await marketplaceApi.createReview(transactionId, rating, comment.trim());
      onReviewed();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="size-5 text-amber-500 fill-amber-500" />
            <span>Rate & Review Seller</span>
          </DialogTitle>
          <DialogDescription>
            You are reviewing a verified transaction completed in-person on campus.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Interactive Star Rating */}
          <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-xl border">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`size-8 ${
                        filled ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/40'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <span className="text-xs font-semibold text-muted-foreground mt-2">
              {rating === 5 && 'Outstanding - As described & punctual'}
              {rating === 4 && 'Good - Smooth handover'}
              {rating === 3 && 'Average - Decent transaction'}
              {rating === 2 && 'Fair - Minor issues'}
              {rating === 1 && 'Poor - Unpleasant experience'}
            </span>
          </div>

          <div>
            <Label htmlFor="comment" className="text-xs font-semibold uppercase text-muted-foreground">
              Feedback & Comments (Optional)
            </Label>
            <textarea
              id="comment"
              rows={3}
              placeholder="Was the item in the described condition? Was the handover easy to coordinate?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full mt-1.5 rounded-md border border-input bg-background p-2.5 text-sm shadow-xs focus:ring-1 focus:ring-primary"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
