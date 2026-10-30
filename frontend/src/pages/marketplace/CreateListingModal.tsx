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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MarketplaceCategory, ProductCondition, ListingVisibility } from '@/types/marketplace';
import { marketplaceApi } from '@/services/marketplace';
import { X, Image as ImageIcon, Loader2 } from 'lucide-react';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  userRole?: string;
}

const CATEGORIES: { label: string; value: MarketplaceCategory }[] = [
  { label: 'Textbooks & Academic Notes', value: 'BOOKS_AND_STUDY' },
  { label: 'Electronics & Gadgets', value: 'ELECTRONICS' },
  { label: 'Lab & Engineering Equipment', value: 'LAB_EQUIPMENT' },
  { label: 'Hostel & Dorm Essentials', value: 'HOSTEL_DORM' },
  { label: 'Furniture & Chairs', value: 'FURNITURE' },
  { label: 'Stationery & Drafting Tools', value: 'STATIONERY' },
  { label: 'Sports & Fitness Gear', value: 'SPORTS_FITNESS' },
  { label: 'Clothing & Accessories', value: 'CLOTHING_ACCESSORIES' },
  { label: 'Other Campus Goods', value: 'OTHER' },
];

const CONDITIONS: { label: string; value: ProductCondition }[] = [
  { label: 'Brand New (Unopened/Unused)', value: 'NEW' },
  { label: 'Like New (Mint Condition)', value: 'LIKE_NEW' },
  { label: 'Good (Gently Used)', value: 'GOOD' },
  { label: 'Fair (Visible Wear, Fully Functional)', value: 'FAIR' },
  { label: 'For Parts / DIY Fix', value: 'FOR_PARTS' },
];

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  userRole = 'STUDENT',
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('BOOKS_AND_STUDY');
  const [condition, setCondition] = useState<ProductCondition>('GOOD');
  const [visibility, setVisibility] = useState<ListingVisibility>('ALL');
  const [pickupLocation, setPickupLocation] = useState('Campus Center / Library');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFacultyOrAdmin = ['FACULTY', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(
    userRole.toUpperCase(),
  );

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    if (selectedFiles.length + newFiles.length > 6) {
      setError('You can upload at most 6 images per listing');
      return;
    }

    // Validate type and size
    for (const file of newFiles) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError(`File "${file.name}" has an unsupported format. Please upload JPEG, PNG, WEBP, or GIF.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`File "${file.name}" exceeds the 10MB file size limit.`);
        return;
      }
    }

    setError(null);
    const updatedFiles = [...selectedFiles, ...newFiles];
    setSelectedFiles(updatedFiles);

    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);

    if (previews[index]) {
      URL.revokeObjectURL(previews[index]);
    }
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPreviews([]);
    setSelectedFiles([]);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please provide a valid price (>= 0)');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const listing = await marketplaceApi.createListing({
        title: title.trim(),
        description: description.trim(),
        price: numPrice,
        category,
        condition,
        visibility: isFacultyOrAdmin ? visibility : 'ALL',
        pickupLocation: pickupLocation.trim(),
      });

      if (selectedFiles.length > 0) {
        try {
          await marketplaceApi.uploadListingImages(listing.id, selectedFiles);
        } catch (uploadErr: any) {
          setError(
            uploadErr?.response?.data?.message ||
              uploadErr.message ||
              'Item created, but photos failed to upload. Please try re-uploading from your listing.',
          );
          setLoading(false);
          return;
        }
      }

      setTitle('');
      setDescription('');
      setPrice('');
      setSelectedFiles([]);
      setPreviews([]);
      onCreated();
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span>List an Item on Campus Marketplace</span>
          </DialogTitle>
          <DialogDescription>
            Post items for sale to verified students and faculty on campus. Hand-to-hand delivery
            only.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="title" className="font-semibold text-xs uppercase text-muted-foreground">
              Item Title *
            </Label>
            <Input
              id="title"
              placeholder="e.g. CASIO FX-991EX Scientific Calculator"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold text-xs uppercase text-muted-foreground">
                Category *
              </Label>
              <select
                className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:ring-1 focus:ring-primary"
                value={category}
                onChange={(e) => setCategory(e.target.value as MarketplaceCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="font-semibold text-xs uppercase text-muted-foreground">
                Condition *
              </Label>
              <select
                className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:ring-1 focus:ring-primary"
                value={condition}
                onChange={(e) => setCondition(e.target.value as ProductCondition)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price" className="font-semibold text-xs uppercase text-muted-foreground">
                Price (₹ INR) *
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-sm text-muted-foreground font-semibold">
                  ₹
                </span>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="250"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="pickup" className="font-semibold text-xs uppercase text-muted-foreground">
                Preferred Campus Handover Spot
              </Label>
              <Input
                id="pickup"
                placeholder="e.g. Central Library, Dorm Block B"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {isFacultyOrAdmin && (
            <div className="p-3 bg-muted/40 border rounded-lg">
              <Label className="font-semibold text-xs uppercase text-muted-foreground">
                Audience Visibility
              </Label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="ALL"
                    checked={visibility === 'ALL'}
                    onChange={() => setVisibility('ALL')}
                  />
                  <span>Campus-Wide (Students & Faculty)</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="FACULTY_ONLY"
                    checked={visibility === 'FACULTY_ONLY'}
                    onChange={() => setVisibility('FACULTY_ONLY')}
                  />
                  <span className="font-medium text-amber-700">Faculty & Staff Only</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="description" className="font-semibold text-xs uppercase text-muted-foreground">
              Description & Details
            </Label>
            <textarea
              id="description"
              rows={3}
              placeholder="Describe condition, reason for selling, accessories included..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-sm shadow-xs focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <Label className="font-semibold text-xs uppercase text-muted-foreground">
              Photos (Up to 6)
            </Label>
            <div className="mt-2 flex flex-wrap gap-3 items-center">
              {previews.map((src, i) => (
                <div
                  key={i}
                  className="relative size-20 rounded-lg border overflow-hidden bg-muted flex items-center justify-center group shadow-xs"
                >
                  <img src={src} alt="Preview" className="w-full h-full object-cover" />
                  {i === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-primary-foreground text-[9px] text-center font-bold py-0.5">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white rounded-full p-1 transition"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}

              {selectedFiles.length < 6 && (
                <label className="size-20 border-2 border-dashed border-muted-foreground/30 hover:border-primary rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:text-primary cursor-pointer transition">
                  <ImageIcon className="size-5" />
                  <span className="text-[10px] mt-1 font-medium">Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Publish Listing
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
