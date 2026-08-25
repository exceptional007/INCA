import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, Calendar, FileText, ArrowRight } from 'lucide-react';

interface Batch {
  id: string;
  uploadedByUserId: string;
  sourceFileR2Key: string;
  status: 'UPLOADED' | 'EXTRACTED' | 'PENDING_REVIEW' | 'COMMITTED' | 'ROLLED_BACK' | 'EXTRACTION_FAILED' | 'DISCARDED';
  createdAt: string;
  committedAt: string | null;
  notes: string | null;
}

interface TimetableBatchListProps {
  batches: Batch[];
  onSelectBatch: (id: string) => void;
  onDiscardBatch: (id: string) => void;
}

export const TimetableBatchList: React.FC<TimetableBatchListProps> = ({
  batches,
  onSelectBatch,
  onDiscardBatch,
}) => {
  const getStatusBadge = (status: Batch['status']) => {
    switch (status) {
      case 'UPLOADED':
        return <Badge variant="secondary">Uploaded</Badge>;
      case 'EXTRACTED':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Extracted</Badge>;
      case 'PENDING_REVIEW':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 animate-pulse">Pending Review</Badge>;
      case 'COMMITTED':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Committed</Badge>;
      case 'EXTRACTION_FAILED':
        return <Badge variant="destructive">Extraction Failed</Badge>;
      case 'DISCARDED':
        return <Badge variant="outline">Discarded</Badge>;
      case 'ROLLED_BACK':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Rolled Back</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (batches.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
          <FileText className="w-10 h-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No timetable imports found.</p>
          <p className="text-xs">Upload a timetable PDF to begin the automated import pipeline.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {batches.map((batch) => (
        <Card key={batch.id} className="hover:border-primary/50 transition-all shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm font-mono font-bold text-foreground">
                    Batch: {batch.id.substring(0, 8)}...
                  </CardTitle>
                  {getStatusBadge(batch.status)}
                  {batch.notes === 'DUPLICATE_WARNING' && (
                    <Badge variant="outline" className="border-amber-300 text-amber-600 bg-amber-50">
                      Duplicate File
                    </Badge>
                  )}
                </div>
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5" />
                  Uploaded on {new Date(batch.createdAt).toLocaleString()}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {batch.status === 'PENDING_REVIEW' ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onSelectBatch(batch.id)}
                      className="bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-2"
                    >
                      <span>Review Grid</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDiscardBatch(batch.id)}
                      className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectBatch(batch.id)}
                    className="flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Details</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
};
