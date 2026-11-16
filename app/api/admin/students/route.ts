import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const createStudentSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().max(20).optional(),
});
import { db } from '@/lib/db';

/**
 * GET /api/admin/students
 * POST /api/admin/students
 *
 * Admin-only: list students or create a new student account.
 */
export async function GET() {
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

  const students = await db.studentProfile.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          banned: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          typingAttempts: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ students });
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const parsed = createStudentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { name, email, password, phone } = parsed.data;

  // Create the user via Better Auth (hashes password properly).
  try {
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
      headers: await headers(),
    });

    const userId = result.user.id;

    // Create the student profile.
    const profile = await db.studentProfile.create({
      data: {
        userId,
        phone: phone ?? null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, banned: true },
        },
      },
    });

    return NextResponse.json({ student: profile }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create student';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

