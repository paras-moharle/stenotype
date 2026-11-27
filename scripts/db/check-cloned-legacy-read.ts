import assert from 'node:assert/strict';
import { db } from '@/lib/db';
import { dictationAttemptsWhere } from '@/lib/dictation-history';

async function main() {
  assert.equal(process.env.STENO_DISPOSABLE_DB, 'YES');
  assert.equal(process.env.DATABASE_URL, process.env.STENO_BRANCH_URL);
  assert.ok(process.env.DATABASE_URL);
  assert.equal(new URL(process.env.DATABASE_URL).hostname, process.env.STENO_BRANCH_HOST);
  try {
    const rows = await db.typingAttempt.findMany({
      where: dictationAttemptsWhere,
      select: { id: true, dictation: { select: { title: true } } },
    });
    assert.equal(rows.length, 1);
    assert.ok(rows[0].dictation);
    console.log('PASS: legacy null-dictation row excluded before relation hydration.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Legacy read failed.');
  process.exitCode = 1;
});
