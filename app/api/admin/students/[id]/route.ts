import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * PUT /api/admin/students/[id]
 * DELETE /api/admin/students/[id]
 *
 * Admin-only: update or delete a student.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { name, phone, status } = body ?? {};

  const profile = await db.studentProfile.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!profile) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Update user name if provided.
  if (name) {
    await db.user.update({
      where: { id: profile.userId },
      data: { name },
    });
  }

  // Update profile fields.
  const updated = await db.studentProfile.update({
    where: { id },
    data: {
      phone: phone !== undefined ? phone : undefined,
      status: status ?? undefined,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, banned: true },
      },
    },
  });

  return NextResponse.json({ student: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const profile = await db.studentProfile.findUnique({
    where: { id },
  });
  if (!profile) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Delete the user (cascades to profile, sessions, accounts).
  await db.user.delete({
    where: { id: profile.userId },
  });

  return NextResponse.json({ success: true });
}

