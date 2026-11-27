import { rejectStorageGrowth } from '@/lib/db-capacity';
import { readJson } from '@/lib/mutation-request';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createStudentSchema } from '@/lib/admin/schemas';
import { isUniqueViolation } from '@/lib/prisma-errors';
import { pageSlice, parsePageParams } from '@/lib/pagination';

/**
 * GET /api/admin/students?limit=100&offset=0
 * POST /api/admin/students
 *
 * Admin-only: list students (paged, capped at 200) or create one.
 */
export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const page = parsePageParams(request);
  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 200);

  const rows = await db.studentProfile.findMany({
    where: query ? {
      user: { OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ] },
    } : undefined,
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
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.take + 1,
    skip: page.skip,
  });

  const students = pageSlice(rows, page);

  return NextResponse.json({
    students,
    page: { limit: page.limit, offset: page.offset, hasMore: page.hasMore(rows) },
  });
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
