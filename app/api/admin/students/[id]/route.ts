import { z } from 'zod';
import { lockStudentAccount } from '@/lib/student-account-lock';
import { auth } from '@/lib/auth';
import { randomBytes } from 'node:crypto';
import { isUniqueViolation } from '@/lib/prisma-errors';
import { readJson } from '@/lib/mutation-request';
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
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson(request, 16_384);
  if (!body.ok) return body.response;
  const parsed = updateStudentSchema.safeParse(body.data);

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

  const { name, phone, status, email, expected } = parsed.data;
  const editedFields = (['name', 'phone', 'status', 'email'] as const).filter(field => parsed.data[field] !== undefined);
  if (editedFields.some(field => expected?.[field] === undefined)) {
    return NextResponse.json({ error: 'Reopen the student to obtain their current details before saving.' }, { status: 409 });
  }

  try {
    const updated = await db.$transaction(async tx => {
      const locked = await lockStudentAccount(tx, profile.userId);
      if (!locked) return null;
      const original = await tx.studentProfile.findUnique({
        where: { id },
        select: { status: true, phone: true, user: { select: { name: true, email: true } } },
      });
      if (!original) return null;
      const draft = { ...original, ...original.user };
      if (expected && (Object.keys(expected) as (keyof typeof expected)[]).some(key =>
        parsed.data[key] !== undefined && expected[key] !== draft[key]
      )) return 'stale' as const;

      if (name !== undefined || email !== undefined || status !== undefined) {
        await tx.user.update({
          where: { id: locked.id },
          data: {
            name,
            ...(email !== undefined && email !== original.user.email ? { email, emailVerified: false } : {}),
            updatedAt: new Date(Math.max(Date.now(), locked.updatedAt.getTime() + 1)),
          },
        });
      }
      if ((email !== undefined && email !== original.user.email) || (status && status !== 'ACTIVE')) {
        await tx.session.deleteMany({ where: { userId: locked.id } });
      }
      return tx.studentProfile.update({
        where: { id },
        data: { phone, status },
        include: { user: { select: { id: true, name: true, email: true, banned: true } } },
      });
    });
    if (updated === 'stale') return NextResponse.json({
      error: 'Another administrator changed one of these fields. Copy your edits, reopen the student, and try again.',
    }, { status: 409 });
    if (!updated) return NextResponse.json(NOT_FOUND, { status: 404 });
    return NextResponse.json({ student: updated });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
    if (isNotFoundError(error)) return NextResponse.json(NOT_FOUND, { status: 404 });
    throw error;
  }
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reset-password'), password: z.string().min(8).max(128).optional(), expectedCredentialRevision: z.iso.datetime() }),
  z.object({ action: z.literal('set-access'), enabled: z.boolean(), expectedCredentialRevision: z.iso.datetime() }),
  z.object({ action: z.literal('purge'), confirmName: z.string().min(1).max(100), expectedResults: z.number().int().nonnegative() }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const body = await readJson(request, 16_384);
  if (!body.ok) return body.response;
  const parsed = actionSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid confirmation or password.' }, { status: 400 });
  const { id } = await params;
  const action = parsed.data;
  if (action.action === 'purge') return removeStudent(id, action);

  const profile = await db.studentProfile.findUnique({ where: { id }, select: { userId: true } });
  if (!profile) return NextResponse.json(NOT_FOUND, { status: 404 });
  if (action.action === 'set-access') {
    const outcome = await db.$transaction(async tx => {
      const user = await lockStudentAccount(tx, profile.userId);
      if (!user || user.updatedAt.toISOString() !== action.expectedCredentialRevision) return false;
      await tx.user.update({ where: { id: user.id }, data: {
        ...(action.enabled ? { banned: false, banReason: null, banExpires: null } : {}),
        updatedAt: new Date(Math.max(Date.now(), user.updatedAt.getTime() + 1)),
      } });
      await tx.studentProfile.update({ where: { id }, data: { status: action.enabled ? 'ACTIVE' : 'SUSPENDED' } });
      if (!action.enabled) await tx.session.deleteMany({ where: { userId: user.id } });
      return true;
    });
    return outcome ? NextResponse.json({ success: true }) :
      NextResponse.json({ error: 'Student access changed. Reopen the account and review it again.' }, { status: 409 });
  }
  const password = action.password ?? randomBytes(18).toString('base64url');
  const hash = await (await auth.$context).password.hash(password);
  const outcome = await db.$transaction(async tx => {
    const user = await lockStudentAccount(tx, profile.userId);
    if (!user) return 'missing';
    if (user.updatedAt.toISOString() !== action.expectedCredentialRevision) return 'stale';
    const credentials = await tx.account.findMany({
      where: { userId: user.id, providerId: 'credential', password: { not: null } },
      select: { id: true }, take: 2,
    });
    if (credentials.length !== 1) return 'missing';
    await tx.account.update({ where: { id: credentials[0].id }, data: { password: hash } });
    await tx.user.update({ where: { id: user.id }, data: { updatedAt: new Date(Math.max(Date.now(), user.updatedAt.getTime() + 1)) } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    return 'updated';
  });
  if (outcome !== 'updated') return NextResponse.json({ error: 'Account changed or has no local credential. Reopen it before resetting.' }, { status: 409 });
  return NextResponse.json({ password }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const started = performance.now();
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const timings = [`auth;dur=${(performance.now() - started).toFixed(1)}`];
  const response = await removeStudent((await params).id, undefined, timings);
  response.headers.set('Server-Timing', timings.join(', '));
  return response;
}

async function removeStudent(id: string, confirmation?: { confirmName: string; expectedResults: number }, timings?: string[]) {
  let started = performance.now();
  function mark(label: string) {
    const now = performance.now();
    timings?.push(`${label};dur=${(now - started).toFixed(1)}`);
    started = now;
  }
  try {
    const outcome = await db.$transaction(async tx => {
      mark('transaction_start');
      // Result writers and account operations serialize on this same user
      // lock. Count results in the next statement, after the lock is held.
      const [target] = await tx.$queryRaw<{ userId: string; name: string }[]>`
        SELECT u.id AS "userId", u.name
        FROM "StudentProfile" p JOIN "user" u ON u.id = p."userId"
        WHERE p.id = ${id} AND u.role = 'student'
        FOR UPDATE OF u
      `;
      mark('account_lock');
      if (!target) return { missing: true };
      const count = await tx.typingAttempt.count({ where: { studentId: id } });
      mark('result_check');
      if (!confirmation && count) return { count };
      if (confirmation && (count !== confirmation.expectedResults || target.name !== confirmation.confirmName)) return { stale: true };
      if (confirmation) await tx.typingAttempt.deleteMany({ where: { studentId: id } });
      await tx.loginAttempt.deleteMany({ where: { userId: target.userId } });
      mark('related_cleanup');
      await tx.user.delete({ where: { id: target.userId } });
      mark('account_delete');
      return { deleted: count };
    });
    mark('commit');
    if ('deleted' in outcome) return NextResponse.json({ success: true, deletedResults: outcome.deleted });
    if ('missing' in outcome) return NextResponse.json(NOT_FOUND, { status: 404 });
    if ('stale' in outcome) return NextResponse.json({ error: 'The student or result count changed. Reload before confirming again.' }, { status: 409 });
    return NextResponse.json({ error: `This student has ${outcome.count} saved results. Suspend access to retain history.` }, { status: 409 });
  } catch (error) {
    if (isForeignKeyError(error)) return NextResponse.json({ error: 'This student is still referenced and cannot be deleted.' }, { status: 409 });
    throw error;
  }
}
