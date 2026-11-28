import { z } from 'zod';
import { auth } from '@/lib/auth';
import { requireStudent } from '@/lib/api-guard';
import { db } from '@/lib/db';
import { readJson, rejectCrossOriginMutation } from '@/lib/mutation-request';
import { takeSharedQuota } from '@/lib/shared-rate-limit';
import { lockStudentAccount } from '@/lib/student-account-lock';

const passwordChange = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
}).refine(({ currentPassword, newPassword }) => currentPassword !== newPassword);

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const gate = await requireStudent();
  if (!gate.ok) return gate.response;
  const body = await readJson(request, 4_096);
  if (!body.ok) return body.response;
  const parsed = passwordChange.safeParse(body.data);
  if (!parsed.success) return Response.json({ error: 'Choose a different password with 8–128 characters.' }, { status: 400 });
  if (!await takeSharedQuota('password-change:' + gate.userId, 5, 15 * 60 * 1000)) {
    return Response.json({ error: 'Too many password attempts. Try again later.' }, { status: 429 });
  }

  const credentials = await db.account.findMany({
    where: { userId: gate.userId, providerId: 'credential' },
    select: { id: true, password: true }, take: 2,
  });
  const credential = credentials.length === 1 ? credentials[0] : null;
  const password = (await auth.$context).password;
  if (!credential?.password || !await password.verify({ hash: credential.password, password: parsed.data.currentPassword })) {
    return Response.json({ error: 'Current password is incorrect.' }, { status: 400 });
  }
  const hash = await password.hash(parsed.data.newPassword);
  const changed = await db.$transaction(async tx => {
    const user = await lockStudentAccount(tx, gate.userId);
    if (!user || user.banned || !await tx.studentProfile.findFirst({
      where: { id: gate.profileId, status: 'ACTIVE', user: { sessions: { some: {
        id: gate.sessionId, expiresAt: { gt: new Date() },
      } } } }, select: { id: true },
    })) return false;
    const matched = await tx.account.updateMany({
      where: { id: credential.id, password: credential.password }, data: { password: hash },
    });
    if (!matched.count) return false;
    await tx.user.update({ where: { id: user.id }, data: { updatedAt: new Date(Math.max(Date.now(), user.updatedAt.getTime() + 1)) } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    return true;
  });
  if (!changed) return Response.json({ error: 'Your credentials or session changed. Sign in and try again.' }, { status: 409 });
  return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
