'use client';

import { useEffect, useOptimistic, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { catalogCategories } from '@/lib/dictation-catalog';
import { ChoiceMenu } from '@/components/ui/choice-menu';

const categoryOptions = [
  { value: 'all', label: 'All categories' },
  ...catalogCategories.map(value => ({ value, label: value[0] + value.slice(1).toLowerCase() })),
];
const sortOptions = [{ value: 'newest', label: 'Newest' }, { value: 'title', label: 'Title A–Z' }];

type Filters = { q: string; category: string; sort: string };

export function DictationFilters({ q, category, sort }: Filters) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selection, select] = useOptimistic({ category, sort });
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pending && timer.current === null && input.current) input.current.value = q;
  }, [q, pending]);

  useEffect(() => {
    const cancel = () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
    window.addEventListener('popstate', cancel);
    return () => {
      cancel();
      window.removeEventListener('popstate', cancel);
    };
  }, []);

  function apply(next: Pick<Filters, 'category' | 'sort'>) {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    const search = input.current?.value.trim() ?? '';
    if (search === q && next.category === category && next.sort === sort && !pending) return;
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (next.category) params.set('category', next.category);
    if (next.sort !== 'newest') params.set('sort', next.sort);
    const query = params.toString();
    startTransition(() => {
      select(next);
      router.replace(query ? `/student/dictations?${query}` : '/student/dictations', { scroll: false });
    });
  }

  return (
    <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_minmax(0,10rem)]">
      <label className="col-span-2 min-w-0 lg:col-span-1">
        <span className="field-label">Search titles</span>
        <input
          ref={input}
          type="search"
          defaultValue={q}
          maxLength={120}
          placeholder="Find a dictation"
          className="field h-[46px]"
          onChange={() => {
            if (timer.current !== null) clearTimeout(timer.current);
            timer.current = setTimeout(() => apply(selection), 350);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) apply(selection);
          }}
        />
      </label>
      <div className="min-w-0">
        <span className="field-label">Category</span>
        <ChoiceMenu label="Category" value={selection.category || 'all'} options={categoryOptions}
          onChange={value => apply({ ...selection, category: value === 'all' ? '' : value })} />
      </div>
      <div className="min-w-0">
        <span className="field-label">Sort by</span>
        <ChoiceMenu label="Sort by" value={selection.sort} options={sortOptions}
          onChange={value => apply({ ...selection, sort: value })} />
      </div>
      <span role="status" className="sr-only">{pending ? 'Updating dictations…' : ''}</span>
    </div>
  );
}
