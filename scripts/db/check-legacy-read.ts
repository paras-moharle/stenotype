import assert from 'node:assert/strict';
import { db } from '@/lib/db';
import { dictationAttemptsWhere } from '@/lib/dictation-history';

async function main() {
  assert.equal(process.env.STENO_DISPOSABLE_DB, 'YES', 'Set the disposable database acknowledgement first.');
  assert.ok(process.env.DATABASE_URL, 'Requires an explicit disposable database URL.');

  try {
    const attempts = await db.typingAttempt.findMany({
      where: { ...dictationAttemptsWhere, studentId: 'legacy-fixture-student' },
      select: { id: true, dictation: { select: { title: true } } },
    });
    assert.deepEqual(attempts, [{
      id: 'legacy-fixture-valid-attempt',
      dictation: { title: 'Legacy fixture' },
    }]);
    console.log('PASS: current Prisma query safely excludes the legacy null relation.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Legacy read check failed.');
  process.exitCode = 1;
});
