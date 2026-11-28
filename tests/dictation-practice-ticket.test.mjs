import test from 'node:test';
import assert from 'node:assert/strict';
import { dictationReferenceDigest, issuePracticeTicket, verifyPracticeTicket } from '../lib/dictation-practice-ticket.ts';

const key = 'local artificial signing value for unit tests';
const claims = {
  profileId: 'profile-one',
  passageId: 'dictation-one',
  digest: dictationReferenceDigest('Original private reference.'),
  youtubeId: null,
  publishedAt: '2026-11-28T00:00:00.000Z',
};

test('practice ticket binds the exact revision, publication, owner and one submission key', () => {
  const { submissionKey, practiceTicket } = issuePracticeTicket(claims, key, 42);
  const scope = { profileId: claims.profileId, passageId: claims.passageId, submissionKey };
  assert.deepEqual(verifyPracticeTicket(practiceTicket, scope, key), { ...claims, submissionKey, expiresAt: 42 + 8 * 60 * 60 * 1000 });
  assert.notEqual(issuePracticeTicket(claims, key, 42).submissionKey, submissionKey);
  for (const field of Object.keys(scope)) {
    assert.equal(verifyPracticeTicket(practiceTicket, { ...scope, [field]: 'another-value' }, key), null);
  }
  const [payload, mac] = practiceTicket.split('.');
  const changed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  assert.equal(Object.hasOwn(changed, 'transcript'), false);
  changed.digest = dictationReferenceDigest('A forged reference.');
  assert.equal(verifyPracticeTicket(Buffer.from(JSON.stringify(changed)).toString('base64url') + '.' + mac, scope, key), null);
  assert.equal(verifyPracticeTicket(practiceTicket, scope, 'different key'), null);
  assert.equal(verifyPracticeTicket('x'.repeat(1601), scope, key), null);
});
