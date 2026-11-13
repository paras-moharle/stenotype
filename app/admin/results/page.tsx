'use client';

import { AdminHeader } from '@/components/admin/admin-header';
import { BarChart3 } from 'lucide-react';

export default function AdminResultsPage() {
  return (
    <div className="space-y-8">
      <AdminHeader
        title="Results"
        description="Recent practice results and performance data."
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800 font-medium">
          🚧 Under progress — results are not stored yet.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Student scores are shown only for the current test session. Saved
          history will appear here once the database backend is connected.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-surface/30 px-6 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <BarChart3 className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">
          No results yet
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Results are not persisted yet, so there is nothing to show. This page
          will populate once the database is connected.
        </p>
      </div>
    </div>
  );
}
