import React from 'react';
import type { LostFoundReport } from '@/types/lost-found';
import {
  MapPin,
  Calendar,
  Sparkles,
  Laptop,
  FileText,
  BookOpen,
  Key,
  Briefcase,
  Shirt,
  Microscope,
  CreditCard,
  Package,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ItemCardProps {
  item: LostFoundReport;
  onViewDetails: (item: LostFoundReport) => void;
  onClaim?: (item: LostFoundReport) => void;
  onViewMatches?: (item: LostFoundReport) => void;
  currentUserId?: string;
}

export const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'ELECTRONICS':
      return Laptop;
    case 'DOCUMENTS_IDS':
      return FileText;
    case 'BOOKS_STATIONERY':
      return BookOpen;
    case 'KEYS':
      return Key;
    case 'BAGS_WALLETS':
      return Briefcase;
    case 'CLOTHING_ACCESSORIES':
      return Shirt;
    case 'LAB_EQUIPMENT':
      return Microscope;
    case 'CARDS':
      return CreditCard;
    default:
      return Package;
  }
};

export const formatCategoryLabel = (category: string) => {
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onViewDetails,
  onClaim,
  onViewMatches,
  currentUserId,
}) => {
  const isLost = item.type === 'LOST';
  const hasImages = item.images && item.images.length > 0;
  const primaryImage = hasImages ? item.images[0].url || item.images[0].storageKey : null;
  const CategoryIcon = getCategoryIcon(item.category);
  const isOwner = currentUserId && item.reporterId === currentUserId;
  const matchesCount = (item._count?.lostMatches || 0) + (item._count?.foundMatches || 0);

  const getStatusBadge = () => {
    switch (item.status) {
      case 'OPEN':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Open</Badge>;
      case 'CLAIM_PENDING':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Claim In Review</Badge>;
      case 'HANDED_OVER':
      case 'RESOLVED':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Handed Over / Returned</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{item.status}</Badge>;
    }
  };

  const getImageUrl = (urlOrKey: string) => {
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
      return urlOrKey;
    }
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    return `${apiUrl.replace(/\/api\/v1\/?$/, '')}/api/storage/photo/${urlOrKey}`;
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group h-full">
      {/* Image Preview / Category Fallback */}
      <div className="relative h-48 w-full bg-linear-to-br from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center">
        {primaryImage ? (
          <img
            src={getImageUrl(primaryImage)}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              // fallback if broken image
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
            <CategoryIcon className="w-12 h-12 stroke-[1.5]" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {formatCategoryLabel(item.category)}
            </span>
          </div>
        )}

        {/* Type Badge (LOST vs FOUND) */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide flex items-center gap-1.5 shadow-xs backdrop-blur-md ${
              isLost
                ? 'bg-rose-500/90 text-white'
                : 'bg-emerald-600/90 text-white'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLost ? 'bg-rose-200' : 'bg-emerald-200'
              } animate-pulse`}
            />
            {isLost ? 'Lost Item' : 'Found Item'}
          </span>
        </div>

        {/* Category Pill */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-md flex items-center gap-1 shadow-xs">
            <CategoryIcon className="w-3 h-3" />
            {formatCategoryLabel(item.category)}
          </span>
        </div>

        {/* Image count indicator if multiple */}
        {hasImages && item.images.length > 1 && (
          <div className="absolute bottom-2 left-3 bg-black/60 text-white text-[11px] font-medium px-2 py-0.5 rounded backdrop-blur-md">
            +{item.images.length} photos
          </div>
        )}

        {/* Match count indicator if AI found matches */}
        {matchesCount > 0 && (
          <div className="absolute bottom-2 right-3 bg-amber-500/90 text-white text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 shadow-xs backdrop-blur-md">
            <Sparkles className="w-3 h-3" />
            {matchesCount} {matchesCount === 1 ? 'Match' : 'Matches'}
          </div>
        )}
      </div>

      {/* Item Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3
              onClick={() => onViewDetails(item)}
              className="font-semibold text-slate-900 text-base group-hover:text-action-blue transition-colors cursor-pointer line-clamp-1"
            >
              {item.title}
            </h3>
            {getStatusBadge()}
          </div>

          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
            {item.description}
          </p>
        </div>

        <div>
          {/* Metadata: Location & Date */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500 mb-3">
            <div className="flex items-center gap-1.5 text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate font-medium">{item.location}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {new Date(item.approximateDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {item.reporterName && (
                <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                  by {item.reporterName}
                </span>
              )}
            </div>
          </div>

          {/* Card Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8 border-slate-200 hover:bg-slate-50"
              onClick={() => onViewDetails(item)}
            >
              View Details
            </Button>

            {!isLost && !isOwner && item.status === 'OPEN' && onClaim && (
              <Button
                variant="default"
                size="sm"
                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onClaim(item)}
              >
                Claim Item
              </Button>
            )}

            {matchesCount > 0 && onViewMatches && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center gap-1"
                onClick={() => onViewMatches(item)}
              >
                <Sparkles className="w-3 h-3 text-amber-600" />
                Matches
              </Button>
            )}

            {isOwner && (
              <Badge variant="secondary" className="text-[10px] text-slate-500 bg-slate-100 px-2 py-1">
                Your Report
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

