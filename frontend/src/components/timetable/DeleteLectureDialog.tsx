import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { LectureData } from './LectureCard';

interface DeleteLectureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  lecture?: LectureData | null;
}

export const DeleteLectureDialog: React.FC<DeleteLectureDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  lecture,
}) => {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Delete Lecture Slot</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong className="text-foreground">{lecture?.subjectName}</strong> ({lecture?.startTime} - {lecture?.endTime}) from the timetable? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" disabled={isDeleting} onClick={handleConfirm}>
            {isDeleting ? 'Deleting...' : 'Delete Lecture'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
