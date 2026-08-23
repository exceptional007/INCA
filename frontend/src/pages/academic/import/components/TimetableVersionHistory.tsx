import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, History, RotateCcw, Clock, User, Home, ArrowLeft } from 'lucide-react';
import api from '@/api/axios';

interface Version {
  id: string;
  sectionId: string;
  effectiveFrom: string;
  isActive: boolean;
  importBatchId: string | null;
  createdAt: string;
  slots: Array<{
    id: string;
    day: string;
    timeSlotStart: string;
    timeSlotEnd: string;
    subject: { name: string; code: string };
    faculty: { firstName: string; lastName: string | null };
    room: { code: string };
    category: string;
  }>;
}

interface TimetableVersionHistoryProps {
  sections: Array<{ id: string; name: string }>;
  onBack: () => void;
}

export const TimetableVersionHistory: React.FC<TimetableVersionHistoryProps> = ({
  sections,
  onBack,
}) => {
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  useEffect(() => {
    if (sections.length > 0) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections]);

  useEffect(() => {
    if (selectedSectionId) {
      fetchVersions();
    }
  }, [selectedSectionId]);

  const fetchVersions = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/admin/timetable-imports/sections/${selectedSectionId}/versions`);
      const data = response.data.data || [];
      setVersions(data);
      if (data.length > 0) {
        setSelectedVersion(data[0]);
      } else {
        setSelectedVersion(null);
      }
    } catch (err) {
      console.error('Failed to fetch versions', err);
      setVersions([]);
      setSelectedVersion(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!window.confirm('Are you sure you want to rollback to this timetable version? This will deactivate the currently active timetable for this section.')) {
      return;
    }
    
    try {
      await api.post(`/admin/timetable-imports/versions/${versionId}/rollback`);
      alert('Timetable rolled back successfully.');
      fetchVersions();
    } catch (err: any) {
      alert(`Rollback failed: ${err.response?.data?.message || 'Error occurred.'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="mr-2">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-primary" /> Timetable Version History & Rollback
            </h1>
            <p className="text-xs text-muted-foreground">Select a section to view historical versions, check slots, and roll back if needed.</p>
          </div>
        </div>

        {sections.length > 0 && (
          <div className="w-48">
            <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map(s => <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Version list */}
        <div className="md:col-span-4 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold">Historical Versions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 divide-y">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">Loading versions...</div>
              ) : versions.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
                  <span>No timetable versions found for this section.</span>
                </div>
              ) : (
                versions.map((ver) => (
                  <button
                    key={ver.id}
                    onClick={() => setSelectedVersion(ver)}
                    className={`w-full p-3 text-left flex flex-col gap-1.5 transition-all text-xs cursor-pointer hover:bg-secondary/40 rounded-lg my-1 ${
                      selectedVersion?.id === ver.id ? 'bg-secondary border border-primary/20' : 'border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono font-bold">Ver: {ver.id.substring(0, 8)}...</span>
                      {ver.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5 py-0">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Superseded</Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Created {new Date(ver.createdAt).toLocaleString()}
                    </div>
                    {!ver.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRollback(ver.id);
                        }}
                        className="mt-1 flex items-center gap-1 self-end text-[10px] py-1 px-2 border-primary/20 hover:bg-primary/5"
                      >
                        <RotateCcw className="w-3 h-3" /> Reactivate Version
                      </Button>
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Version preview slots */}
        <div className="md:col-span-8">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Version Slots Preview {selectedVersion && `(Ver: ${selectedVersion.id.substring(0, 8)}...)`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedVersion ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                  {selectedVersion.slots.map((slot) => (
                    <div key={slot.id} className="p-3 border rounded-lg flex flex-col justify-between bg-card text-xs shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{slot.subject.name}</span>
                          <Badge variant="outline" className="text-[9px] font-mono">{slot.day}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {slot.timeSlotStart} - {slot.timeSlotEnd}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-muted text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {slot.faculty.firstName} {slot.faculty.lastName}</span>
                        <span className="flex items-center gap-1"><Home className="w-3 h-3" /> Room {slot.room.code}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-xs text-muted-foreground">Select a version from the left panel to inspect its schedules.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
