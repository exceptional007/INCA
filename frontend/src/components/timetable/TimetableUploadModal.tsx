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
import { Upload, FileText, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '@/api/axios';

interface TimetableUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionId?: string;
  sectionDetails?: any;
  onSuccess: () => void;
}

export const TimetableUploadModal: React.FC<TimetableUploadModalProps> = ({
  isOpen,
  onClose,
  sectionId: _sectionId,
  sectionDetails,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedBatch, setParsedBatch] = useState<any | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith('.pdf')) {
        setErrorMsg('Please select a valid PDF file.');
        return;
      }
      setFile(selected);
      setErrorMsg(null);
    }
  };

  const handleUploadAndParse = async () => {
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/admin/timetable-imports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const batchId = res.data.batchId;

      // Poll batch details until extraction completes or fails
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const detailRes = await api.get(`/admin/timetable-imports/${batchId}`);
          const batch = detailRes.data.data;

          if (batch.status === 'PENDING_REVIEW') {
            clearInterval(pollInterval);
            setParsedBatch(batch);
            setIsUploading(false);
          } else if (batch.status === 'EXTRACTION_FAILED') {
            clearInterval(pollInterval);
            setIsUploading(false);
            setErrorMsg(batch.notes || 'PDF extraction failed.');
          } else if (attempts > 30) {
            clearInterval(pollInterval);
            setIsUploading(false);
            setErrorMsg('Parsing timed out. Please try again.');
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          setIsUploading(false);
          setErrorMsg('Error checking parsing progress.');
        }
      }, 1500);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      setErrorMsg(err.response?.data?.message || 'Failed to upload PDF file.');
    }
  };

  const handleApproveAndSave = async () => {
    if (!parsedBatch) return;

    setIsCommitting(true);
    try {
      const res = await api.post(`/admin/timetable-imports/${parsedBatch.id}/approve`);
      if (res.data.success !== false) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data.message || 'Validation or conflict error committing timetable.');
      }
    } catch (err: any) {
      console.error('Commit failed:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to save timetable template.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedBatch(null);
    setErrorMsg(null);
    setIsUploading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Upload & Parse Timetable PDF
          </DialogTitle>
          <DialogDescription>
            {sectionDetails
              ? `Upload a timetable PDF to generate reusable template for Section ${sectionDetails.name}`
              : 'Select a timetable PDF to extract lectures using Gemini AI / Text engine.'}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {!parsedBatch ? (
          <div className="space-y-4 pt-2">
            {/* File Dropzone */}
            <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center bg-muted/30 transition-all duration-200 flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  {file ? file.name : 'Drag & drop timetable PDF here'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document`
                    : 'Supports academic timetable PDFs up to 20MB'}
                </p>
              </div>

              <input
                type="file"
                id="pdf-input"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              <label htmlFor="pdf-input">
                <Button type="button" variant="outline" size="sm" className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  {file ? 'Change PDF File' : 'Browse File'}
                </Button>
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!file || isUploading}
                onClick={handleUploadAndParse}
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Parsing PDF with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Parse & Extract Timetable
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Parsed Preview Step */
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs">
              <span className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Parsed {parsedBatch.slots?.length || 0} lecture slots successfully!
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReset}>
                Upload Different File
              </Button>
            </div>

            {/* Extracted Slots Table Preview */}
            <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2 font-semibold">Day</th>
                    <th className="p-2 font-semibold">Time</th>
                    <th className="p-2 font-semibold">Subject</th>
                    <th className="p-2 font-semibold">Faculty</th>
                    <th className="p-2 font-semibold">Room</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {parsedBatch.slots?.map((slot: any) => (
                    <tr key={slot.id} className="hover:bg-muted/50">
                      <td className="p-2 font-bold text-primary">{slot.day}</td>
                      <td className="p-2">{slot.timeSlotStart} - {slot.timeSlotEnd}</td>
                      <td className="p-2 font-sans font-medium">{slot.subjectRaw}</td>
                      <td className="p-2 font-sans">{slot.facultyRaw}</td>
                      <td className="p-2 font-sans font-bold">{slot.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                Re-upload
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isCommitting}
                onClick={handleApproveAndSave}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isCommitting ? 'Saving Template...' : 'Save as Reusable Template'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
