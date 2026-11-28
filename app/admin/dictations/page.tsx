import { requireAdminPage } from '@/lib/admin/require-admin';
import { listAdminDictations } from '@/lib/admin/list-dictations';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';
import { AdminDictationsClient } from './dictations-client';

export default async function AdminDictationsPage() {
  await requireAdminPage();
  const result = await listAdminDictations(new URLSearchParams({ limit: String(ADMIN_PAGE_SIZE) }));
  return <AdminDictationsClient initial={{ rows: result.dictations, more: result.page.hasMore }} />;
}
