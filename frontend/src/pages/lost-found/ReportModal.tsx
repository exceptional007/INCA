import React, { useState, useRef } from 'react';
import type { LostFoundCategory, LostFoundType, LostFoundReport } from '@/types/lost-found';
import { lostFoundApi } from '@/services/lost-found';
import {
  X,
  UploadCloud,
  Sparkles,
  MapPin,
  Calendar,
  AlertCircle,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newReport: LostFoundReport) => void;
  defaultType?: LostFoundType;
}

const CATEGORIES: { value: LostFoundCategory; label: string }[] = [
  { value: 'ELECTRONICS', label: 'Electronics & Gadgets' },
  { value: 'DOCUMENTS_IDS', label: 'Student IDs & Government Docs' },
  { value: 'KEYS', label: 'Keys & Keychains' },
  { value: 'BOOKS_STATIONERY', label: 'Books & Class Notes' },
  { value: 'BAGS_WALLETS', label: 'Bags & Wallets' },
  { value: 'CLOTHING_ACCESSORIES', label: 'Clothing & Wearables' },
  { value: 'LAB_EQUIPMENT', label: 'Lab & Engineering Equipment' },
  { value: 'CARDS', label: 'ATM / Library Cards' },
  { value: 'OTHER', label: 'Other Miscellaneous' },
];

const COMMON_LOCATIONS = [
  'Central Library',
  'Campus Canteen',
  'Main Auditorium',
  'Block A 2nd Floor',
  'Block B Ground Floor',
  'Computer Lab 3',
  'Sports Complex',
  'Mechanical Workshop',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'LOST',
}) => {
  const [type, setType] = useState<LostFoundType>(defaultType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LostFoundCategory>('ELECTRONICS');
  const [location, setLocation] = useState('');
  const [approximateDate, setApproximateDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [approximateTime, setApproximateTime] = useState('');
  const [description, setDescription] = useState('');
  const [distinguishingFeatures, setDistinguishingFeatures] = useState('');
  const [contactPreference, setContactPreference] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const combined = [...selectedFiles, ...files].slice(0, 5); // max 5
    setSelectedFiles(combined);

    // generate preview URLs
    const newPreviews = combined.map((file) => URL.createObjectURL(file));
    setPreviews(newPreviews);
  };

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    setPreviews(updatedPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide a descriptive title for the item');
      return;
    }
    if (!location.trim()) {
      setError('Please specify where the item was lost or found');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a clear description of the item');
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('type', type);
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('location', location.trim());
      formData.append('approximateDate', approximateDate);
      if (approximateTime.trim()) {
        formData.append('approximateTime', approximateTime.trim());
      }
      formData.append('description', description.trim());
      if (distinguishingFeatures.trim()) {
        formData.append('distinguishingFeatures', distinguishingFeatures.trim());
      }
      if (contactPreference.trim()) {
        formData.append('contactPreference', contactPreference.trim());
      }

      for (const file of selectedFiles) {
        formData.append('images', file);
      }

      const created = await lostFoundApi.createReport(formData);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-border shadow-xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                type === 'LOST'
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {type === 'LOST' ? 'Report a Lost Item' : 'Report a Found Item'}
              </h2>
              <p className="text-xs text-slate-500">
                {type === 'LOST'
                  ? 'Our AI matching engine will scan campus reports to locate your item'
                  : 'Earn +10 community points for returning items to peers'}
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector (LOST vs FOUND) */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('LOST')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                type === 'LOST'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              I Lost Something
            </button>
            <button
              type="button"
              onClick={() => setType('FOUND')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                type === 'FOUND'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              I Found Something (+10 Pts)
            </button>
          </div>

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Item Title <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. Blue Dell Laptop Bag with Stickers"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs h-9 bg-slate-50 border-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LostFoundCategory)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-md px-3 h-9 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-action-blue"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location & Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Campus Location <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Where was it lost/found?</span>
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                required
                placeholder="e.g. Central Library 2nd Floor Study Cubicle"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-9 text-xs h-9 bg-slate-50 border-slate-200"
              />
            </div>
            {/* Quick location chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 mr-1">Quick:</span>
              {COMMON_LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Approximate Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="date"
                  required
                  value={approximateDate}
                  onChange={(e) => setApproximateDate(e.target.value)}
                  className="pl-9 text-xs h-9 bg-slate-50 border-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Approximate Time (Optional)
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="e.g. Between 2:00 PM - 3:30 PM"
                  value={approximateTime}
                  onChange={(e) => setApproximateTime(e.target.value)}
                  className="pl-9 text-xs h-9 bg-slate-50 border-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Public Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe visible characteristics, color, brand, condition, or circumstances..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-action-blue"
            />
          </div>

          {/* Private Distinguishing Features */}
          <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <label className="text-xs font-bold text-amber-900">
                Private Distinguishing Features (Kept Hidden for Claim Verification)
              </label>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              {type === 'FOUND'
                ? 'Details only the real owner should know (e.g. lockscreen wallpaper, engravings, secret scratches, exact serial number). We hide this so fake claimants cannot copy it.'
                : 'Secret marks or serial numbers that prove you own this item when you claim it.'}
            </p>
            <textarea
              rows={2}
              placeholder="e.g. Serial # ends in 4821, lockscreen is a picture of a golden retriever, small scratch near volume rocker."
              value={distinguishingFeatures}
              onChange={(e) => setDistinguishingFeatures(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-amber-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Photos Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Photos (Optional, up to 5)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*"
              className="hidden"
            />

            {previews.length > 0 && (
              <div className="grid grid-cols-5 gap-2 mb-3">
                {previews.map((preview, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                    <img src={preview} alt="upload preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white p-1 rounded-full opacity-90 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedFiles.length < 5 && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-action-blue rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <UploadCloud className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">
                  Click to upload photos or drag & drop
                </span>
                <span className="text-[10px] text-slate-400">PNG, JPG, WEBP up to 10MB</span>
              </div>
            )}
          </div>

          {/* Contact Preference */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Preferred Handover Contact / Note (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Leave message via INCA chat or WhatsApp: +91 98765 43210"
              value={contactPreference}
              onChange={(e) => setContactPreference(e.target.value)}
              className="text-xs h-9 bg-slate-50 border-slate-200"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
              className={`text-xs h-9 text-white font-semibold flex items-center gap-1.5 ${
                type === 'LOST'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? (
                <>Submitting...</>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  {type === 'LOST' ? 'Publish Lost Report' : 'Publish Found Item'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

