import { rejectStorageGrowth } from '@/lib/db-capacity';
import { readJson } from '@/lib/mutation-request';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createStudentSchema } from '@/lib/admin/schemas';
import { isUniqueViolation } from '@/lib/prisma-errors';
import { listAdminStudents } from '@/lib/admin/list-students';

/**
 * GET /api/admin/students?limit=100&offset=0
 * POST /api/admin/students
 *
 * Admin-only: list students (paged, capped at 200) or create one.
 */
export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  return NextResponse.json(await listAdminStudents(new URL(request.url).searchParams));
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const body = await readJson(request, 16_384);
  if (!body.ok) return body.response;
  const parsed = createStudentSchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null;

  const capacity = await rejectStorageGrowth();
  if (capacity) return capacity;

  try {
    const id = randomUUID();
    const passwordHash = await (await auth.$context).password.hash(password);
    const student = await db.studentProfile.create({
      data: {
        phone,
        user: {
          create: {
            id,
            name,
            email: email.toLowerCase(),
            role: 'student',
            accounts: {
              create: {
                id: randomUUID(),
                accountId: id,
                providerId: 'credential',
                password: passwordHash,
              },
            },
          },
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, banned: true } },
      },
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A user with this email already exists.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Failed to create student.' }, { status: 500 });
  }
}
