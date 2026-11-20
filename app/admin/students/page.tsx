'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Ban, CheckCircle, Trash2 } from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminSearch } from '@/components/admin/admin-search';
import { Button } from '@/components/ui/button';

type Student = {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    banned: boolean;
  };
  phone: string | null;
  status: string;

  _count: {
    typingAttempts: number;
    fees: number;
  };
  createdAt: string;
};

type FormState = {
  name: string;
  email: string;
  password: string;
  phone: string;
};

const blankForm: FormState = {
  name: '',
  email: '',
  password: '',
  phone: '',
};

export default function AdminStudentsPage() {
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/students');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);
      }
    } catch {
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = students.filter(
    (s) =>
      s.user.name.toLowerCase().includes(query.toLowerCase()) ||
      s.user.email.toLowerCase().includes(query.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create student');
      }

      setToast('Student created successfully');
      setShowForm(false);
      setForm(blankForm);
      fetchStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create student');
    }
  };

  const handleBan = async (student: Student) => {
    const newBanned = !student.user.banned;
    try {
      const res = await fetch(`/api/admin/users/${student.user.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banned: newBanned }),
      });

      if (!res.ok) throw new Error('Failed to update');

      setToast(newBanned ? 'Student blocked' : 'Student unblocked');
      fetchStudents();
    } catch {
      setError('Failed to update student status');
    }
  };

  const handleDelete = async (student: Student) => {
    if (!confirm(`Delete ${student.user.name}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to delete student');
      }

      setToast('Student deleted');
      fetchStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (s: Student) => (
        <div>
          <div className="font-medium">{s.user.name}</div>
          <div className="text-sm text-muted-foreground">{s.user.email}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (s: Student) => s.phone ?? '—',
    },
    {
      key: 'attempts',
      header: 'Attempts',
      render: (s: Student) => s._count.typingAttempts,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s: Student) => (
        <span
          className={
            s.user.banned
              ? 'text-red-500 font-medium'
              : 'text-green-500 font-medium'
          }
        >
          {s.user.banned ? 'Blocked' : 'Active'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s: Student) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBan(s)}
            title={s.user.banned ? 'Unblock' : 'Block'}
          >
            {s.user.banned ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDelete(s)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Students"
        description="Manage student accounts"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        }
      />

      <AdminSearch
        value={query}
        onChange={setQuery}
        placeholder="Search students..."
      />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-500">
          {error}
        </div>
      )}

      {toast && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-500">
          {toast}
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-green-500 hover:text-green-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading students...
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={filtered}
          rowKey={(s) => s.id}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Student</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="student-name" className="mb-1 block text-sm font-medium">Name</label>
                <input
                  id="student-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                />
              </div>

              <div>
                <label htmlFor="student-email" className="mb-1 block text-sm font-medium">Email</label>
                <input
                  id="student-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                />
              </div>

              <div>
                <label htmlFor="student-password" className="mb-1 block text-sm font-medium">Password</label>
                <input
                  id="student-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                  minLength={8}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Minimum 8 characters
                </p>
              </div>

              <div>
                <label htmlFor="student-phone" className="mb-1 block text-sm font-medium">Phone (optional)</label>
                <input
                  id="student-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">
                  Create Student
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

