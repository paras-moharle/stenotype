import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/require-admin';
import { listLoginHistory } from '@/lib/admin/list-login-history';

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  return NextResponse.json(await listLoginHistory(new URL(request.url).searchParams));
}
