import { requireAdminPage } from '@/lib/admin/require-admin';
import { listAdminStudents } from '@/lib/admin/list-students';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';
import { AdminStudentsClient } from './students-client';

export default async function AdminStudentsPage() {
  await requireAdminPage();
  const result = await listAdminStudents(new URLSearchParams({ limit: String(ADMIN_PAGE_SIZE) }));
  return <AdminStudentsClient initial={{ rows: result.students, more: result.page.hasMore }} />;
}
