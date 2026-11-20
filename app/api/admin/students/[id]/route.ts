import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { updateStudentSchema } from '@/lib/admin/schemas';
import {
  isForeignKeyError,
  isNotFoundError,
} from '@/lib/prisma-errors';

/**
 * PUT /api/admin/students/[id]
 * DELETE /api/admin/students/[id]
 *
 * Admin-only: update or delete a student.
 */

const NOT_FOUND = { error: 'Student not found' };

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateStudentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const profile = await db.studentProfile.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!profile) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const { name, phone, status } = parsed.data;

  try {
    // One transaction: a failed profile update must not leave the name
    // already changed.
    const updated = await db.$transaction(async (tx) => {
      if (name !== undefined) {
        await tx.user.update({
          where: { id: profile.userId },
          data: { name },
        });
      }

      return tx.studentProfile.update({
        where: { id },
        data: {
          ...(phone !== undefined ? { phone } : {}),
          ...(status !== undefined ? { status } : {}),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, banned: true },
          },
        },
      });
    });

    return NextResponse.json({ student: updated });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const profile = await db.studentProfile.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!profile) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  // Attempts reference the profile with ON DELETE RESTRICT, so deleting
  // would fail with a raw 500. Say what is actually happening instead.
  const results = await db.typingAttempt.count({
    where: { studentId: id },
  });
  if (results > 0) {
    return NextResponse.json(
      {
        error: `This student has ${results} saved result${results === 1 ? '' : 's'}. Set them to Inactive instead of deleting, or remove their results first.`,
      },
      { status: 409 }
    );
  }

  try {
    await db.user.delete({ where: { id: profile.userId } });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    if (isForeignKeyError(error)) {
      return NextResponse.json(
        { error: 'This student is still referenced and cannot be deleted.' },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
