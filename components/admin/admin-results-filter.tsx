'use client';

import Form from "next/form";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChoiceMenu } from '@/components/ui/choice-menu';
import { AdminFilterToolbar } from './admin-filter-toolbar';

export function AdminResultsFilter({ query, completion, studentId }: {
  query: string;
  completion: '' | 'yes' | 'no';
  studentId?: string;
}) {
  const [coverage, setCoverage] = useState<string>(completion || 'all');
  return (
    <Form action="/admin/results" prefetch={false}>
      {studentId && <input name="student" type="hidden" value={studentId} />}
      <AdminFilterToolbar>
        <input name="q" type="search" defaultValue={query} maxLength={120}
          className="field" placeholder="Search student or dictation…" aria-label="Search student or dictation" />
        <ChoiceMenu name="completed" label="Passage coverage" value={coverage} onChange={setCoverage}
          options={[
            { value: 'all', label: 'All results' },
            { value: 'yes', label: 'Fully covered' },
            { value: 'no', label: 'Partially covered' },
          ]} />
        <Button type="submit" className="min-h-[46px]">Apply filters</Button>
      </AdminFilterToolbar>
    </Form>
  );
}
