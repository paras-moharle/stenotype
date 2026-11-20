import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createStudentSchema } from '@/lib/admin/schemas';
import { isUniqueViolation } from '@/lib/prisma-errors';

/**
 * GET /api/admin/students
 * POST /api/admin/students
 *
 * Admin-only: list students or create a new student account.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

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
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => null);
  const parsed = createStudentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null;

  // `admin.createUser` creates the account WITHOUT signing it in — unlike
  // `signUpEmail`, which used to leave a ghost session and a fake
  // "successful login" audit row for every student the admin created.
  let createdUserId: string | null = null;

  try {
    // No explicit role: the admin plugin's `defaultRole` is already
    // "student", and the typed API only allows the plugin's known roles.
    const created = await auth.api.createUser({
      body: { email, password, name },
      headers: await headers(),
    });

    createdUserId = created.user.id;

    const profile = await db.studentProfile.create({
      data: {
        userId: createdUserId,
        phone,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, banned: true },
        },
      },
    });

    return NextResponse.json({ student: profile }, { status: 201 });
  } catch (error) {
    // Never leave a user without a profile behind.
    if (createdUserId) {
      await db.user
        .delete({ where: { id: createdUserId } })
        .catch(() => undefined);
    }

    const message =
      error instanceof Error ? error.message : 'Failed to create student';

    if (isUniqueViolation(error) || /already exists/i.test(message)) {
      return NextResponse.json(
        { error: 'A user with this email already exists.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
