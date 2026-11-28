import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

/**
 * End-to-end auth smoke test against a running server.
 *
 * Skipped by default. Run it against a production build:
 *
 *   NODE_ENV=production pnpm build
 *   NODE_ENV=production pnpm start &
 *   SMOKE_BASE_URL=http://localhost:3000 \
 *   SMOKE_EMAIL=you@example.com \
 *   SMOKE_PASSWORD=your-password \
 *   pnpm test:smoke
 *
 * It signs in, checks the session, signs out, and asserts the session
 * is actually dead afterwards. That last assertion is the one that
 * would have caught the P2028 sign-out outage: a failed sign-out
 * leaves the session alive even though the UI redirects to /login.
 */
const base = process.env.SMOKE_BASE_URL?.replace(/\/+$/, '');
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

const skip =
  !base || !email || !password
    ? 'set SMOKE_BASE_URL, SMOKE_EMAIL and SMOKE_PASSWORD to run'
    : false;

// Better Auth allows three sign-ins in a ten-second window per IP.
async function waitForSignInWindow(response) {
  if (response.status !== 429) return false;
  const seconds = Number(response.headers.get('x-retry-after') ?? NaN);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 10) return false;
  await delay(seconds * 1000 + 150);
  return true;
}

const cookieHeader = (headers) =>
  headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');

// Better Auth rejects state-changing requests that arrive without an
// Origin header (CSRF protection). Browsers always send one, so the
// test must too.
const jsonHeaders = {
  'Content-Type': 'application/json',
  Origin: base,
};

test('sign-out clears the cookie and kills the session', { skip }, async () => {
  // 1. Sign in.
  const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  });
  assert.equal(signIn.status, 200, `sign-in returned ${signIn.status}`);

  const cookie = cookieHeader(signIn.headers);
  assert.match(cookie, /better-auth\.session_token=/, 'no session cookie set');

  // 2. The session is alive.
  const before = await fetch(`${base}/api/auth/get-session`, {
    headers: { cookie },
  });
  assert.equal(before.status, 200, 'get-session failed');
  assert.ok((await before.json())?.user, 'session should exist after sign-in');

  // 3. Sign out the same way the browser does (JSON body + header).
  const signOut = await fetch(`${base}/api/auth/sign-out`, {
    method: 'POST',
    headers: { ...jsonHeaders, cookie },
    body: '{}',
  });
  assert.equal(
    signOut.status,
    200,
    'sign-out must not return 415 (missing Content-Type) or 500 (P2028)'
  );
  assert.match(
    signOut.headers.getSetCookie().join('\n'),
    /better-auth\.session_token=;/,
    'sign-out must send a Set-Cookie that clears the session token'
  );

  // 4. The session is dead — this is what "logout is broken" means.
  const after = await fetch(`${base}/api/auth/get-session`, {
    headers: { cookie },
  });
  assert.equal(after.status, 200, 'get-session failed after sign-out');
  assert.equal(await after.json(), null, 'session survived sign-out');
});

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const localSuite = !skip && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname);

test('local admin policy, provisioning and idempotent dictation history', {
  skip: !localSuite || !adminEmail || !adminPassword ? 'requires seeded loopback CI credentials' : false,
}, async () => {
  async function call(path, { method = 'GET', cookie, body, headers = {} } = {}) {
    return fetch(`${base}${path}`, {
      method,
      redirect: 'manual',
      headers: { ...(method === 'GET' ? {} : jsonHeaders), ...(cookie ? { cookie } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  async function signInResponse(email, password) {
    const request = () => call('/api/auth/sign-in/email', { method: 'POST', body: { email, password } });
    let response = await request();
    if (await waitForSignInWindow(response)) response = await request();
    return response;
  }

  async function signIn(email, password) {
    const response = await signInResponse(email, password);
    assert.equal(response.status, 200);
    return cookieHeader(response.headers);
  }

  const wrongOrigin = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST', headers: { ...jsonHeaders, Origin: 'https://invalid.example' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await signInResponse(adminEmail, 'incorrect-ci-password')).status, 401);
  const admin = await signIn(adminEmail, adminPassword);
  assert.equal((await call('/admin', { cookie: admin })).status, 200);
  assert.equal((await call('/api/auth/admin/list-users', { cookie: admin })).status, 404);

  const adminSession = await call('/api/auth/get-session', { cookie: admin });
  const adminIdentity = (await adminSession.json()).user;
  assert.equal((await call(`/api/admin/users/${adminIdentity.id}/ban`, {
    method: 'POST', cookie: admin, body: { banned: true },
  })).status, 400);

  const email = `practice-${crypto.randomUUID()}@example.test`;
  const password = 'local-only-test-password';
  const created = await call('/api/admin/students', {
    method: 'POST', cookie: admin, body: { email, password, name: 'Practice Test' },
  });
  assert.equal(created.status, 201);
  const { student } = await created.json();
  const duplicateStudent = await call('/api/admin/students', {
    method: 'POST', cookie: admin, body: { email, password, name: 'Practice Test' },
  });
  assert.equal(duplicateStudent.status, 409);
  const studentCookie = await signIn(email, password);
  assert.equal((await call('/api/admin/students', { cookie: studentCookie })).status, 403);
  assert.equal((await call('/student/dashboard', { cookie: studentCookie })).status, 200);

  const transcript = 'Alpha beta gamma delta.';
  const published = await call('/api/admin/dictations', {
    method: 'POST',
    cookie: admin,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: { title: 'CI dictation', category: 'GENERAL', referenceTranscript: transcript, status: 'PUBLISHED', youtubeId: 'dQw4w9WgXcQ', durationSeconds: 198 },
  });
  assert.equal(published.status, 201);
  const { dictation } = await published.json();
  const metadata = await call(`/api/dictations?id=${dictation.id}`, { cookie: studentCookie });
  assert.equal(metadata.status, 200);
  const { dictation: selected, practice: ticket } = await metadata.json();
  assert.match(metadata.headers.get('cache-control'), /no-store/);
  assert.ok(ticket.practiceTicket);
  assert.equal(selected.id, dictation.id);
  assert.equal(Object.hasOwn(selected, 'referenceTranscript'), false);
  const catalog = await call('/student/dictations?q=CI+dictation', { cookie: studentCookie });
  assert.equal(catalog.status, 200);
  const catalogHtml = await catalog.text();
  assert.ok(catalogHtml.includes(`/student/results?dictationId=${dictation.id}`));
  assert.match(catalogHtml, /youtube\.com\/watch\?v=dQw4w9WgXcQ/);
  assert.match(catalogHtml, /View dictation/);
  assert.ok(catalogHtml.includes(`/student/typing?mode=dictation&amp;dictationId=${dictation.id}`));
  assert.ok(!catalogHtml.includes(transcript));
  const practice = await call(`/student/typing?mode=dictation&dictationId=${dictation.id}`, { cookie: studentCookie });
  assert.equal(practice.status, 200);
  const practiceHtml = await practice.text();
  // The browser suite checks the selected title after client hydration.
  assert.ok(!practiceHtml.includes(transcript));
  const studyPath = `/api/dictations/${dictation.id}/study`;
  assert.equal((await call(studyPath)).status, 401);
  const study = await call(studyPath, { cookie: studentCookie });
  assert.equal(study.status, 200);
  assert.match(study.headers.get('cache-control'), /no-store/);
  const studyData = await study.json();
  assert.equal(studyData.transcript, transcript);
  assert.deepEqual(studyData.dictation, selected);

  // Edit before any attempt exists. The previous revision must come from
  // the admin edit transaction, not from an already persisted result.
  const transcriptEdit = await call(`/api/admin/dictations/${dictation.id}`, {
    method: 'PUT', cookie: admin, body: { referenceTranscript: 'An updated practice passage.' },
  });
  assert.equal(transcriptEdit.status, 200);
  const body = { ...ticket, passageId: dictation.id, typed: transcript, elapsedMs: 60_000 };
  const posts = await Promise.all([1, 2].map(() =>
    call('/api/attempts', { method: 'POST', cookie: studentCookie, body })
  ));
  assert.deepEqual(posts.map((response) => response.status), [200, 200]);
  const [result, duplicate] = await Promise.all(posts.map((response) => response.json()));
  assert.equal(result.attemptId, duplicate.attemptId);
  assert.equal(result.score.accuracy, 100);
  assert.equal(result.reference, transcript);

  const editorRead = await call(`/api/admin/dictations/${dictation.id}`, { cookie: admin });
  const editorVersion = (await editorRead.json()).dictation.updatedAt;
  const recordingTicket = (await (await call(`/api/dictations?id=${dictation.id}`, { cookie: studentCookie })).json()).practice;
  const edit = await call(`/api/admin/dictations/${dictation.id}`, {
    method: 'PUT', cookie: admin, body: { youtubeId: 'abcdefghijk' },
  });
  assert.equal(edit.status, 200);
  assert.equal((await edit.json()).dictation.durationSeconds, null);
  const stale = await call(`/api/admin/dictations/${dictation.id}`, {
    method: 'PUT', cookie: admin, body: { title: 'Stale draft', expectedUpdatedAt: editorVersion },
  });
  assert.equal(stale.status, 409);
  const supersededRecording = await call('/api/attempts', {
    method: 'POST', cookie: studentCookie, body: { ...body, ...recordingTicket },
  });
  assert.equal(supersededRecording.status, 409);
  assert.equal((await supersededRecording.json()).code, 'PRACTICE_UNAVAILABLE');
  for (const status of ['ARCHIVED', 'PUBLISHED']) {
    assert.equal((await call(`/api/admin/dictations/${dictation.id}`, {
      method: 'PUT', cookie: admin, body: { status },
    })).status, 200);
  }
  const retry = await call('/api/attempts', { method: 'POST', cookie: studentCookie, body });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).reference, transcript, 'saved results survive archiving and republishing');
  // Two commits/replays, one recovery, and one rejected recording used
  // four slots. Saturate the remaining per-process budget.
  for (let index = 0; index < 26; index++) {
    const replay = await call('/api/attempts', { method: 'POST', cookie: studentCookie, body });
    assert.equal(replay.status, 200);
  }
  const limited = await call('/api/attempts', {
    method: 'POST', cookie: studentCookie, body: { ...body, submissionKey: crypto.randomUUID() },
  });
  assert.equal(limited.status, 429);
  for (let index = 0; index < 3; index++) {
    const recovered = await call('/api/attempts', { method: 'POST', cookie: studentCookie, body });
    assert.equal(recovered.status, 200);
    assert.equal((await recovered.json()).attemptId, result.attemptId);
  }
  assert.equal((await call('/api/attempts', { method: 'POST', cookie: studentCookie, body })).status, 429);

  const otherStudent = await signIn(process.env.SMOKE_EMAIL, process.env.SMOKE_PASSWORD);
  const otherHistory = await call(`/api/student/attempts?dictationId=${dictation.id}`, { cookie: otherStudent });
  assert.deepEqual((await otherHistory.json()).attempts, []);
  const otherDetail = await call(`/student/results/${result.attemptId}`, { cookie: otherStudent });
  if (otherDetail.status === 200) {
    // Next.js can stream the not-found boundary after sending HTTP 200.
    assert.match(await otherDetail.text(), /Page not found/);
  } else {
    assert.equal(otherDetail.status, 404);
  }

  const history = await call(`/api/student/attempts?dictationId=${dictation.id}`, { cookie: studentCookie });
  assert.equal((await history.json()).attempts.length, 1);

  const post = (input) => call('/api/attempts', { method: 'POST', cookie: otherStudent, body: input });
  assert.equal((await post(body)).status, 409, 'another student cannot use the signed ticket');
  const fresh = (await (await call(`/api/dictations?id=${dictation.id}`, { cookie: otherStudent })).json()).practice;
  const unsaved = { ...body, ...fresh };
  assert.equal((await post({ ...unsaved, practiceTicket: fresh.practiceTicket + 'x' })).status, 409);
  assert.equal((await post({ ...unsaved, submissionKey: crypto.randomUUID() })).status, 409);
  assert.equal((await post({ ...unsaved, passageId: 'different-dictation' })).status, 409);

  const unpublish = await call(`/api/admin/dictations/${dictation.id}`, {
    method: 'PUT', cookie: admin, body: { status: 'DRAFT' },
  });
  assert.equal(unpublish.status, 200);
  assert.equal((await call(studyPath, { cookie: studentCookie })).status, 404);
  assert.equal((await call(`/api/dictations?id=${dictation.id}`, { cookie: studentCookie })).status, 404);

  assert.equal((await post(unsaved)).status, 409);
  assert.equal((await call(`/api/admin/dictations/${dictation.id}`, {
    method: 'PUT', cookie: admin, body: { status: 'PUBLISHED' },
  })).status, 200);
  assert.equal((await post(unsaved)).status, 409, 'a prior publication cannot be reused after republishing');

  const disappearing = await call('/api/admin/dictations', {
    method: 'POST', cookie: admin, headers: { 'Idempotency-Key': crypto.randomUUID() }, body: { title: 'Disposable deletion test', category: 'LEGAL', referenceTranscript: transcript, status: 'PUBLISHED' },
  });
  assert.equal(disappearing.status, 201);
  const disappearingId = (await disappearing.json()).dictation.id;
  const loadDisappearing = async () =>
    (await (await call(`/api/dictations?id=${disappearingId}`, { cookie: otherStudent })).json()).practice;
  const beforeArchive = await loadDisappearing();
  const changeStatus = (status) => call(`/api/admin/dictations/${disappearingId}`, { method: 'PUT', cookie: admin, body: { status } });
  assert.equal((await changeStatus('ARCHIVED')).status, 200);
  assert.equal((await post({ ...body, ...beforeArchive, passageId: disappearingId })).status, 409);
  assert.equal((await changeStatus('PUBLISHED')).status, 200);
  assert.equal((await post({ ...body, ...beforeArchive, passageId: disappearingId })).status, 409);
  const beforeDelete = await loadDisappearing();
  assert.equal((await call(`/api/admin/dictations/${disappearingId}`, { method: 'DELETE', cookie: admin })).status, 200);
  assert.equal((await post({ ...body, ...beforeDelete, passageId: disappearingId })).status, 409);
  const emptyHistory = await call('/api/student/attempts', { cookie: otherStudent });
  assert.deepEqual((await emptyHistory.json()).attempts, []);

  const issue = async () => {
    const response = await call(`/api/dictations?id=${dictation.id}`, { cookie: otherStudent });
    assert.equal(response.status, 200);
    return { ...body, ...(await response.json()).practice, typed: 'An updated practice passage.' };
  };
  const first = await issue();
  const initialResult = await post(first);
  assert.equal(initialResult.status, 200);
  const savedId = (await initialResult.json()).attemptId;
  const older = await issue();
  const newer = await issue();
  const replacementAttempt = { ...newer, typed: 'An updated practice passage!' };
  const [oldWrite, newWrite] = await Promise.all([post(older), post(replacementAttempt)]);
  assert.ok([200, 409].includes(oldWrite.status));
  assert.equal(newWrite.status, 200);
  assert.equal((await newWrite.json()).attemptId, savedId);
  assert.equal((await post(first)).status, 409, 'an accepted older submission cannot replace the new result');
  assert.equal((await post(older)).status, 409, 'an older ticket cannot replace the current result');
  const retryReplacement = await post(replacementAttempt);
  assert.equal(retryReplacement.status, 200);
  assert.equal((await retryReplacement.json()).attemptId, savedId);
  const rejected = await issue();
  assert.equal((await post({ ...rejected, typed: '' })).status, 400);
  assert.equal((await post(replacementAttempt)).status, 200, 'failed replacementAttempt did not change the accepted result');
  const currentResults = await call(`/api/student/attempts?dictationId=${dictation.id}`, { cookie: otherStudent });
  assert.deepEqual((await currentResults.json()).attempts.map(result => result.id), [savedId]);
  const detail = await call(`/student/results?dictationId=${dictation.id}`, { cookie: otherStudent });
  assert.ok(detail.headers.get('location')?.endsWith(savedId) || (await detail.text()).includes(savedId));


  const studentAccount = `/api/admin/users/${student.user.id}`;
  const status = await call(`/api/admin/students/${student.id}`, {
    method: 'PUT', cookie: admin, body: { status: 'INACTIVE', expected: { status: 'ACTIVE' } },
  });
  assert.equal(status.status, 200);
  assert.equal((await call('/api/dictations', { cookie: studentCookie })).status, 401);
  assert.equal((await call('/api/student/attempts', { cookie: studentCookie })).status, 401);
  assert.equal((await signInResponse(email, password)).status, 403);

  const activation = await call(`/api/admin/students/${student.id}`, {
    method: 'PUT', cookie: admin, body: { status: 'ACTIVE', expected: { status: 'INACTIVE' } },
  });
  assert.equal(activation.status, 200);
  const activatedCookie = await signIn(email, password);
  assert.equal((await call('/api/student/attempts', { cookie: activatedCookie })).status, 200);

  const revoked = await call(`${studentAccount}/revoke-sessions`, { method: 'POST', cookie: admin });
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).revoked, 1);
  assert.equal((await call('/api/dictations', { cookie: activatedCookie })).status, 401);

  const newCookie = await signIn(email, password);
  const ban = await call(`${studentAccount}/ban`, { method: 'POST', cookie: admin, body: { banned: true } });
  assert.equal(ban.status, 200);
  assert.equal((await call('/api/dictations', { cookie: newCookie })).status, 401);
  const blockedSignIn = await signInResponse(email, password);
  assert.equal(blockedSignIn.status, 403);
  const unban = await call(`${studentAccount}/ban`, { method: 'POST', cookie: admin, body: { banned: false } });
  assert.equal(unban.status, 200);
  const restoredCookie = await signIn(email, password);
  const studentPath = `/api/admin/students/${student.id}`;
  const changeStudent = (body) => call(studentPath, { method: 'PUT', cookie: admin, body });
  assert.equal((await changeStudent({ name: 'Newer Name', expected: { name: student.user.name } })).status, 200);
  const phoneEdit = await changeStudent({ phone: '12345', expected: { phone: null } });
  assert.equal((await phoneEdit.json()).student.user.name, 'Newer Name');
  assert.equal((await changeStudent({ name: 'Old tab', expected: { name: student.user.name } })).status, 409);
  assert.equal((await changeStudent({ email: process.env.SMOKE_EMAIL, expected: { email } })).status, 409);
  const nextEmail = `changed-${crypto.randomUUID()}@example.test`;
  assert.equal((await changeStudent({ email: nextEmail.toUpperCase(), expected: { email } })).status, 200);
  assert.equal((await call('/api/student/attempts', { cookie: restoredCookie })).status, 401);
  assert.equal((await signInResponse(email, password)).status, 401);
  const updatedLogin = await signIn(nextEmail, password);

  const listResult = await call(`/api/admin/students?q=${encodeURIComponent(nextEmail)}`, { cookie: admin });
  const managed = (await listResult.json()).students[0];
  assert.equal(managed.user.email, nextEmail);
  const reset = { action: 'reset-password', expectedCredentialRevision: managed.user.updatedAt };
  const resetCalls = await Promise.all([1, 2].map(() => call(studentPath, { method: 'POST', cookie: admin, body: reset })));
  assert.deepEqual(resetCalls.map(value => value.status).sort(), [200, 409]);
  const resetResponse = resetCalls.find(value => value.status === 200);
  assert.match(resetResponse.headers.get('cache-control'), /no-store/);
  const replacement = (await resetResponse.json()).password;
  assert.equal(typeof replacement, 'string');
  assert.equal((await call('/api/student/attempts', { cookie: updatedLogin })).status, 401);
  assert.equal((await signInResponse(nextEmail, password)).status, 401);
  const replacementCookie = await signIn(nextEmail, replacement);
  const finalPassword = 'different-local-password';
  const changedPassword = await call('/api/student/password', {
    method: 'POST', cookie: replacementCookie, body: { currentPassword: replacement, newPassword: finalPassword },
  });
  assert.equal(changedPassword.status, 200);
  assert.equal((await call('/api/student/attempts', { cookie: replacementCookie })).status, 401);
  assert.equal((await signInResponse(nextEmail, replacement)).status, 401);
  const finalCookie = await signIn(nextEmail, finalPassword);

  const key = crypto.randomUUID();
  const content = { title: 'Idempotency test', category: 'LEGAL', referenceTranscript: 'A swifter witness reached the bench.', status: 'PUBLISHED' };
  const upload = (body = content) => call('/api/admin/dictations', {
    method: 'POST', cookie: admin, headers: { 'Idempotency-Key': key }, body,
  });
  const concurrentCreate = await Promise.all([upload(), upload()]);
  assert.deepEqual(concurrentCreate.map(value => value.status), [201, 201]);
  const receipts = await Promise.all(concurrentCreate.map(value => value.json()));
  assert.deepEqual(receipts[0], receipts[1]);
  assert.equal((await upload({ ...content, title: 'Different content' })).status, 409);
  const purgeId = receipts[0].dictation.id;
  const practiceTicket = (await (await call(`/api/dictations?id=${purgeId}`, { cookie: otherStudent })).json()).practice;
  const purgeAttempt = { ...practiceTicket, passageId: purgeId, typed: content.referenceTranscript, elapsedMs: 60_000 };
  assert.equal((await call('/api/attempts', { method: 'POST', cookie: otherStudent, body: purgeAttempt })).status, 200);
  const purgeDictation = (expectedResults) => call(`/api/admin/dictations/${purgeId}`, {
    method: 'POST', cookie: admin, body: { confirmTitle: content.title, expectedResults },
  });
  assert.equal((await purgeDictation(0)).status, 409);
  assert.equal((await purgeDictation(1)).status, 200);
  assert.equal((await call('/api/attempts', { method: 'POST', cookie: otherStudent, body: purgeAttempt })).status, 409);
  assert.deepEqual(await (await upload()).json(), receipts[0]);
  assert.equal((await call(`/api/admin/dictations/${purgeId}`, { cookie: admin })).status, 404);

  const purgeStudent = (expectedResults) => call(studentPath, {
    method: 'POST', cookie: admin, body: { action: 'purge', confirmName: 'Newer Name', expectedResults },
  });
  assert.equal((await purgeStudent(0)).status, 409);
  assert.equal((await purgeStudent(1)).status, 200);
  assert.equal((await call('/api/student/attempts', { cookie: finalCookie })).status, 401);
  const loginAudit = await call(`/api/admin/login-history?student=${student.user.id}`, { cookie: admin });
  assert.deepEqual((await loginAudit.json()).attempts, [], "purge removes the student's linked audit events");
});

test('concurrent local sign-ins leave one usable session', { skip: !localSuite ? 'requires a loopback URL and seeded student credentials' : false }, async () => {
  const requestPair = () => Promise.all([1, 2].map(() => fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  })));
  let attempts = await requestPair();
  const limited = attempts.find(response => response.status === 429);
  if (limited && await waitForSignInWindow(limited)) {
    attempts = await requestPair();
  }
  const cookies = attempts.filter((response) => response.ok).map((response) => cookieHeader(response.headers));
  assert.equal(cookies.length, 2);
  const sessions = await Promise.all(cookies.map(async (cookie) => {
    const response = await fetch(`${base}/api/auth/get-session`, { headers: { cookie } });
    assert.equal(response.status, 200);
    return (await response.json())?.user;
  }));
  assert.equal(sessions.filter(Boolean).length, 1);
});
