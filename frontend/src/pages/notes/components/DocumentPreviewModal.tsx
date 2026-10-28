import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import type { LearningNote } from '@/types';
import api from '@/api/axios';

interface DocumentPreviewModalProps {
  note: LearningNote | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (note: LearningNote) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  note,
  isOpen,
  onClose,
  onDownload,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  const isDocx =
    note?.originalFilename?.toLowerCase().endsWith('.docx') ||
    note?.mimeType?.includes('wordprocessingml') ||
    false;

  const isDrive = note?.sourceType === 'DRIVE';

  useEffect(() => {
    if (!isOpen || !note || isDrive) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const loadDocument = async () => {
      try {
        const response = await api.get(`/notes/${note.id}/preview`, {
          responseType: 'blob',
        });

        if (!active) return;

        const blob = response.data;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        if (isDocx && docxContainerRef.current) {
          try {
            const docxPreview = await import('docx-preview');
            const arrayBuffer = await blob.arrayBuffer();
            if (docxContainerRef.current && active) {
              docxContainerRef.current.innerHTML = '';
              await docxPreview.renderAsync(arrayBuffer, docxContainerRef.current, undefined, {
                className: 'docx-viewer-content',
                inWrapper: false,
                ignoreWidth: false,
                ignoreHeight: false,
              });
            }
          } catch (renderErr: any) {
            console.warn('DOCX direct rendering error:', renderErr);
            setError('DOCX preview rendering is limited in browser. Please use the Download button below.');
          }
        }
      } catch (err: any) {
        if (!active) return;
        setError(err.response?.data?.message || 'Failed to load document preview.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDocument();

    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [isOpen, note?.id]);

  if (!note) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[88vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold truncate text-foreground">
                {note.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[11px] font-mono uppercase">
                  {note.subject.code}
                </Badge>
                <span className="text-xs text-muted-foreground truncate">
                  {note.originalFilename || (isDrive ? 'Google Drive Link' : 'Document')}
                </span>
                {note.fileSize && (
                  <span className="text-xs text-muted-foreground">
                    • {(note.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isDrive ? (
              <Button
                size="sm"
                className="gap-2 bg-primary text-primary-foreground"
                onClick={() => window.open(note.driveUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="size-4" />
                Open in Drive
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => onDownload(note)}
              >
                <Download className="size-4" />
                Download Original
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content area */}
        <div className="flex-1 relative overflow-auto bg-muted/20">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 z-20">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Loading document preview...</p>
            </div>
          )}

          {error && (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                <AlertCircle className="size-6" />
              </div>
              <h4 className="text-base font-semibold text-foreground mb-1">Preview Unavailable</h4>
              <p className="text-sm text-muted-foreground mb-4 text-center">{error}</p>
              {!isDrive && (
                <Button onClick={() => onDownload(note)} className="gap-2">
                  <Download className="size-4" />
                  Download File Directly
                </Button>
              )}
            </div>
          )}

          {isDrive && !loading && (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
                <ExternalLink className="size-7" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">External Google Drive Document</h4>
              <p className="text-sm text-muted-foreground mb-6 text-center leading-relaxed">
                This study material is hosted on Google Drive. Click below to view the original material in a new tab.
              </p>
              <Button
                size="lg"
                onClick={() => window.open(note.driveUrl, '_blank', 'noopener,noreferrer')}
                className="gap-2 shadow-xs"
              >
                <ExternalLink className="size-4" />
                Open Document in Google Drive
              </Button>
            </div>
          )}

          {!isDrive && !loading && !error && (
            <>
              {isDocx ? (
                <div className="p-8 max-w-4xl mx-auto bg-card my-6 shadow-sm border border-border rounded-xl min-h-[500px]">
                  <div ref={docxContainerRef} className="prose prose-sm dark:prose-invert max-w-none" />
                </div>
              ) : (
                blobUrl && (
                  <iframe
                    src={`${blobUrl}#toolbar=1&navpanes=0`}
                    title={note.title}
                    className="w-full h-full border-0"
                  />
                )
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

