import { requireAdminPage } from '@/lib/admin/require-admin';
import { listLoginHistory } from '@/lib/admin/list-login-history';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';
import { LoginHistoryClient } from './login-history-client';

export default async function LoginHistoryPage({
  searchParams,
}: { searchParams: Promise<{ student?: string | string[] }> }) {
  await requireAdminPage();
  const { student: rawStudent } = await searchParams;
  const student = typeof rawStudent === 'string' ? rawStudent.slice(0, 128) : undefined;
  const params = new URLSearchParams();
  if (student) params.set('student', student);
  const { attempts, pagination } = await listLoginHistory(params, ADMIN_PAGE_SIZE);
  const rows = attempts.map(({ id, email, createdAt, success, ipAddress }) => ({
    id, email, createdAt: createdAt.toISOString(), success, ipAddress,
  }));
  return <LoginHistoryClient key={student ?? ''} student={student} initial={{ rows, more: pagination.totalPages > 1 }} />;
}
