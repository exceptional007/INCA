import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { MarketplaceListing } from '@/types/marketplace';
import { getMarketplaceImageUrl, marketplaceApi } from '@/services/marketplace';
import {
  MapPin,
  Star,
  CheckCircle2,
  MessageSquare,
  ShieldAlert,
  ShoppingBag,
  Trash2,
  Check,
  UserCheck,
} from 'lucide-react';

interface ListingDetailModalProps {
  listing: MarketplaceListing | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onOpenChat: (listing: MarketplaceListing) => void;
  onInitiateBuy: (listing: MarketplaceListing) => void;
  onReport: (listing: MarketplaceListing) => void;
  onMarkSold?: (listingId: string) => void;
  onDeleteListing?: (listingId: string) => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  BOOKS_AND_STUDY: 'Textbooks & Academic Notes',
  ELECTRONICS: 'Electronics & Gadgets',
  LAB_EQUIPMENT: 'Lab & Engineering Equipment',
  HOSTEL_DORM: 'Hostel & Dorm Essentials',
  FURNITURE: 'Furniture',
  STATIONERY: 'Stationery',
  SPORTS_FITNESS: 'Sports & Fitness',
  CLOTHING_ACCESSORIES: 'Clothing & Accessories',
  OTHER: 'Other Campus Goods',
};

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  isOpen,
  onClose,
  currentUserId,
  onOpenChat,
  onInitiateBuy,
  onReport,
  onMarkSold,
  onDeleteListing,
}) => {
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [fullListing, setFullListing] = useState<MarketplaceListing | null>(listing);

  useEffect(() => {
    setFullListing(listing);
    setSelectedImgIndex(0);
    if (listing?.id && isOpen) {
      marketplaceApi
        .getListingById(listing.id)
        .then((fresh) => {
          if (fresh) setFullListing(fresh);
        })
        .catch(() => {});
    }
  }, [listing?.id, isOpen]);

  if (!listing) return null;

  const current = fullListing || listing;
  const isSeller = current.sellerId === currentUserId;

  const seller = current.seller;
  const sellerName =
    seller?.student
      ? `${seller.student.firstName} ${seller.student.lastName || ''}`.trim()
      : seller?.faculty
      ? `${seller.faculty.firstName} ${seller.faculty.lastName || ''}`.trim()
      : seller?.adminProfile?.name
      ? seller.adminProfile.name
      : seller?.email
      ? seller.email.split('@')[0]
      : (isSeller ? 'You (Seller)' : 'Campus Seller');

  const sellerRoleBadge = seller?.student ? 'Student' : seller?.faculty ? 'Faculty' : seller?.adminProfile ? 'Admin' : 'Seller';
  const departmentName =
    seller?.student?.department?.name || seller?.faculty?.department?.name || null;

  const activeTx = current.activeTransaction || current.transactions?.[0];
  const buyer = current.buyer || activeTx?.buyer;
  const buyerName =
    buyer?.student
      ? `${buyer.student.firstName} ${buyer.student.lastName || ''}`.trim()
      : buyer?.faculty
      ? `${buyer.faculty.firstName} ${buyer.faculty.lastName || ''}`.trim()
      : buyer?.adminProfile?.name
      ? buyer.adminProfile.name
      : buyer?.email
      ? buyer.email.split('@')[0]
      : 'Campus Buyer';

  const buyerRoleBadge = buyer?.student ? 'Student' : buyer?.faculty ? 'Faculty' : buyer?.adminProfile ? 'Admin' : 'Buyer';
  const buyerDepartmentName =
    buyer?.student?.department?.name || buyer?.faculty?.department?.name || null;

  const reputation = current.sellerReputation;
  const images = current.images || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Images Section */}
          <div className="bg-muted/40 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r">
            <div className="aspect-square rounded-xl overflow-hidden bg-background border flex items-center justify-center relative shadow-xs">
              {images.length > 0 && images[selectedImgIndex] ? (
                <img
                  src={getMarketplaceImageUrl(
                    images[selectedImgIndex].url || images[selectedImgIndex].storageKey,
                  )}
                  alt={current.title}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.detail-img-fallback');
                    if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                  }}
                  className="w-full h-full object-contain"
                />
              ) : null}

              <div
                className={`detail-img-fallback flex flex-col items-center text-muted-foreground ${
                  images.length > 0 ? 'hidden' : 'flex'
                }`}
              >
                <ShoppingBag className="size-12 stroke-[1.5]" />
                <span className="text-xs mt-2">No photo available</span>
              </div>

              {current.status === 'SOLD' && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Badge variant="destructive" className="text-base px-4 py-1 font-bold">
                    SOLD
                  </Badge>
                </div>
              )}
            </div>

            {/* Thumbnail Row */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                {images.map((img, idx) => {
                  const thumbSrc = getMarketplaceImageUrl(img.url || img.storageKey);
                  return (
                    <button
                      key={img.id || idx}
                      onClick={() => setSelectedImgIndex(idx)}
                      className={`relative size-14 shrink-0 rounded-lg overflow-hidden border-2 transition ${
                        selectedImgIndex === idx
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={thumbSrc}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Verification Shield Notice */}
            <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-2.5 text-xs text-primary">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <span>
                <strong>Campus Verified Transaction:</strong> Both parties must meet in person on
                campus and confirm handover using the 6-digit OTP code before the deal is finalized.
              </span>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="font-semibold text-xs">
                  {CATEGORY_NAMES[current.category] || current.category}
                </Badge>
                {current.visibility === 'FACULTY_ONLY' && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                    Faculty & Staff Only
                  </Badge>
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground leading-snug">
                  {current.title}
                </h2>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground">
                    ₹{current.price.toLocaleString('en-IN')}
                  </span>
                  <Badge variant="outline" className="text-xs uppercase font-medium">
                    {current.condition.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {/* Handover Spot */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border">
                <MapPin className="size-4 text-primary shrink-0" />
                <span>
                  Campus Handover:{' '}
                  <strong className="text-foreground">
                    {current.preferredLocation || 'Campus Center'}
                  </strong>
                </span>
              </div>

              {/* Profile Card: Buyer info if sold & viewed by seller, otherwise Seller info */}
              {isSeller && current.status === 'SOLD' ? (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl shadow-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="size-3.5 text-emerald-600" />
                      Buyer Information (Sold To)
                    </span>
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-semibold">
                      Verified Buyer
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10 border border-emerald-300">
                      <AvatarFallback className="font-bold bg-emerald-100 text-emerald-800">
                        {buyerName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                        {buyerName}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-400 text-emerald-800 font-semibold">
                          {buyerRoleBadge}
                        </Badge>
                      </div>
                      {buyerDepartmentName && (
                        <div className="text-xs text-muted-foreground">{buyerDepartmentName}</div>
                      )}
                      {current.soldAt && (
                        <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                          Sold on {new Date(current.soldAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-card border rounded-xl shadow-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                    <span>{isSeller ? 'Your Listing Information' : 'Seller Information'}</span>
                    {current.status === 'SOLD' && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700">
                        Sold
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 border">
                        <AvatarFallback className="font-bold bg-primary/10 text-primary">
                          {sellerName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-1.5">
                          {sellerName}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {sellerRoleBadge}
                          </Badge>
                        </div>
                        {departmentName && (
                          <div className="text-xs text-muted-foreground">{departmentName}</div>
                        )}
                      </div>
                    </div>

                    {!isSeller && reputation && (
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm font-bold text-amber-600">
                          <Star className="size-4 fill-amber-500 text-amber-500" />
                          <span>
                            {reputation.totalReviews > 0 ? reputation.averageRating : 'New'}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {reputation.completedSales} sales
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Description
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {current.description || 'No additional details provided.'}
                </p>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-6 border-t mt-6 space-y-2">
              {isSeller ? (
                <div className="space-y-2">
                  {current.status !== 'SOLD' && onMarkSold && (
                    <Button
                      onClick={() => onMarkSold(current.id)}
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="size-4" />
                      Mark as Sold
                    </Button>
                  )}
                  {onDeleteListing && (
                    <Button
                      variant="outline"
                      onClick={() => onDeleteListing(current.id)}
                      className="w-full gap-2 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                      Archive / Remove Listing
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {current.status === 'ACTIVE' || current.status === 'RESERVED' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => onOpenChat(current)}
                        className="gap-2 font-semibold"
                      >
                        <MessageSquare className="size-4 text-primary" />
                        Chat & Negotiate
                      </Button>
                      <Button
                        onClick={() => onInitiateBuy(current)}
                        className="gap-2 font-semibold shadow-xs"
                      >
                        <ShoppingBag className="size-4" />
                        Buy for ₹{current.price.toLocaleString('en-IN')}
                      </Button>
                    </div>
                  ) : (
                    <Button disabled className="w-full">
                      Item Already Sold
                    </Button>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => onReport(current)}
                      className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition"
                    >
                      <ShieldAlert className="size-3.5" />
                      Report Listing
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
