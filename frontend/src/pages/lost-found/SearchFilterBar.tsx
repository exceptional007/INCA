import React from 'react';
import type { LostFoundCategory, LostFoundType, LostFoundStatus } from '@/types/lost-found';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedType: LostFoundType | 'ALL';
  onTypeChange: (type: LostFoundType | 'ALL') => void;
  selectedCategory: LostFoundCategory | 'ALL';
  onCategoryChange: (category: LostFoundCategory | 'ALL') => void;
  selectedStatus: LostFoundStatus | 'ALL';
  onStatusChange: (status: LostFoundStatus | 'ALL') => void;
  onReset: () => void;
  totalResults: number;
}

const CATEGORIES: { value: LostFoundCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'ELECTRONICS', label: 'Electronics & Gadgets' },
  { value: 'DOCUMENTS_IDS', label: 'IDs & Documents' },
  { value: 'KEYS', label: 'Keys & Keychains' },
  { value: 'BOOKS_STATIONERY', label: 'Books & Notes' },
  { value: 'BAGS_WALLETS', label: 'Bags & Wallets' },
  { value: 'CLOTHING_ACCESSORIES', label: 'Clothing & Accessories' },
  { value: 'LAB_EQUIPMENT', label: 'Lab & Campus Equipment' },
  { value: 'CARDS', label: 'Cards & Passes' },
  { value: 'OTHER', label: 'Other Items' },
];

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedCategory,
  onCategoryChange,
  selectedStatus,
  onStatusChange,
  onReset,
  totalResults,
}) => {
  const hasActiveFilters =
    searchQuery !== '' ||
    selectedType !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedStatus !== 'ALL';

  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-xs space-y-4">
      {/* Top row: Search input + Type Toggles */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by title, location (e.g. Library, Canteen), or description..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-8 text-sm h-10 w-full bg-slate-50 border-slate-200 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type Toggle Pills */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => onTypeChange('ALL')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              selectedType === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Items
          </button>
          <button
            type="button"
            onClick={() => onTypeChange('LOST')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              selectedType === 'LOST'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-rose-700 hover:text-rose-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Lost Only
          </button>
          <button
            type="button"
            onClick={() => onTypeChange('FOUND')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              selectedType === 'FOUND'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:text-emerald-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Found Only
          </button>
        </div>
      </div>

      {/* Bottom row: Category Dropdown + Status Dropdown + Results Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Filters:
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value as LostFoundCategory | 'ALL')}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-action-blue"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as LostFoundStatus | 'ALL')}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-action-blue"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open (Active)</option>
            <option value="CLAIM_PENDING">Claim In Review</option>
            <option value="HANDED_OVER">Handed Over / Returned</option>
          </select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-xs h-7 text-slate-500 hover:text-slate-800 px-2 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </Button>
          )}
        </div>

        {/* Total results info */}
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900 font-bold">{totalResults}</span> {totalResults === 1 ? 'item' : 'items'}
        </div>
      </div>
    </div>
  );
};

