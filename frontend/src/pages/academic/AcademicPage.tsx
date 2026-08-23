import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, BookOpen, DoorOpen, Layers, Plus } from 'lucide-react';
import api from '../../api/axios';
import { DataTable } from '@/components/ui/data-table';
import { type ColumnDef } from '@tanstack/react-table';
import { FormDialog } from '@/components/ui/form-dialog';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { z } from 'zod';

// --- Zod schemas ----------------------------------------------------------

const departmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(10, 'Code must be ≤10 chars').toUpperCase(),
  description: z.string().optional(),
})

type DepartmentValues = z.infer<typeof departmentSchema>

// --- Page component -------------------------------------------------------

export const AcademicPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'departments' | 'programs' | 'subjects' | 'rooms'>('departments');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const handleCreateDepartment = async (values: DepartmentValues) => {
    await api.post('/academic/departments', values);
    fetchData();
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }) => {
        const value = row.getValue('code') || row.original.shortName || '—';
        return <span className="font-mono text-xs font-semibold">{String(value)}</span>;
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
    },
    {
      id: 'details',
      header: 'Details',
      cell: ({ row }) => {
        const item = row.original;
        const details = item.description || item.building || (item.credits ? `${item.credits} Credits` : 'Standard');
        return <span className="text-muted-foreground">{details}</span>;
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.original.isActive !== false;
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Master Data</h1>
          <p className="text-sm text-muted-foreground">Manage departments, academic programs, subjects, and classroom allocations</p>
        </div>
        {activeTab === 'departments' && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Department
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-muted rounded-xl max-w-2xl">
        {(
          [
            { key: 'departments', label: 'Departments', icon: Building2 },
            { key: 'programs', label: 'Programs', icon: Layers },
            { key: 'subjects', label: 'Subjects', icon: BookOpen },
            { key: 'rooms', label: 'Rooms', icon: DoorOpen },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 min-w-[120px] py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{activeTab}</CardTitle>
          <CardDescription>View and manage all {activeTab} in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data} isLoading={isLoading} searchKey="name" />
        </CardContent>
      </Card>

      {/* Create Department Dialog */}
      <FormDialog<typeof departmentSchema>
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Create Department"
        description="Add a new academic department to the institution."
        schema={departmentSchema}
        defaultValues={{ name: '', code: '', description: '' }}
        onSubmit={handleCreateDepartment}
        submitLabel="Create Department"
      >
        {(form) => (
          <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Computer Science & Engineering" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. CSE" {...field} className="uppercase" />
                  </FormControl>
                  <FormDescription>Short code used for identification (max 10 chars).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Brief description of the department..."
                      rows={3}
                      className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </FormDialog>
    </div>
  );
};
