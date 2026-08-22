import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Building2, BookOpen, DoorOpen, Layers } from 'lucide-react';
import api from '../../api/axios';

export const AcademicPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'departments' | 'programs' | 'subjects' | 'rooms'>('departments');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let endpoint = '/academic/departments';
      if (activeTab === 'programs') endpoint = '/academic/departments/programs';
      if (activeTab === 'subjects') endpoint = '/academic/departments/subjects';
      if (activeTab === 'rooms') endpoint = '/academic/departments/rooms';

      const response = await api.get(endpoint);
      setData(response.data.data || []);
    } catch (error) {
      console.error('Failed to load academic data', error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Academic Master Data</h1>
          <p className="text-sm text-slate-400">Manage departments, academic programs, subjects, and classroom allocations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 glass-panel rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab('departments')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'departments' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" /> Departments
        </button>
        <button
          onClick={() => setActiveTab('programs')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'programs' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Programs
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'subjects' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Subjects
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'rooms' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DoorOpen className="w-3.5 h-3.5" /> Rooms
        </button>
      </div>

      {/* Data Table Card */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner label={`Loading ${activeTab}...`} />
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No {activeTab} found in database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Code</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-mono text-xs font-semibold text-indigo-400">{item.code || item.shortName || '—'}</td>
                    <td className="p-4 font-medium text-slate-100">{item.name}</td>
                    <td className="p-4 text-xs text-slate-400">
                      {item.description || item.building || (item.credits ? `${item.credits} Credits` : 'Standard')}
                    </td>
                    <td className="p-4">
                      <Badge variant={item.isActive !== false ? 'success' : 'neutral'}>
                        {item.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
