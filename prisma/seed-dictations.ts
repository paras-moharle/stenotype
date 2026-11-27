/**
 * Seed dictations into the database.
 * Run: node --env-file=.env.local --import tsx prisma/seed-dictations.ts
 *
 * This migrates the hardcoded mockDictations into the DB so the
 * API can serve them. Transcripts live in the DB only — never
 * sent to the client until scoring.
 */

import { loadEnvironment } from '../scripts/load-environment.mjs';

loadEnvironment();

async function main() {
  const { db } = await import('../lib/db');

  const dictations = [
    {
      title: 'Court Proceedings — Verdict',
      category: 'LEGAL' as const,
      referenceTranscript:
        'The court shall proceed with the examination of the witness in accordance with the provisions of law and all parties shall be given a fair opportunity to present their arguments before the honorable judge delivers the final verdict.',
      youtubeId: null,
      durationSeconds: 272,
    },
    {
      title: 'Business Meeting — Q3 Review',
      category: 'PROFESSIONAL' as const,
      referenceTranscript:
        'The quarterly review meeting will commence at ten in the morning and all department heads are requested to submit their performance reports by the end of this week. The agenda includes budget allocation for the upcoming fiscal year and discussion of the new project timelines.',
      youtubeId: null,
      durationSeconds: 198,
    },
    {
      title: 'Medical Consultation — Symptoms',
      category: 'GENERAL' as const,
      referenceTranscript:
        'The patient reported experiencing persistent headaches and mild fever for the past three days. Upon examination the doctor prescribed medication and advised the patient to rest and maintain adequate hydration throughout the recovery period.',
      youtubeId: null,
      durationSeconds: 156,
    },
  ];

  // Find the admin user (created by the main seed).
  const admin = await db.user.findFirst({
    where: { role: 'admin' },
  });

  if (!admin) {
    console.error('No admin user found. Run the main seed first.');
    process.exit(1);
  }

  for (const d of dictations) {
    const existing = await db.dictation.findFirst({
      where: { title: d.title },
    });

    if (existing) {
      console.log(`exists: ${d.title}`);
      continue;
    }

    await db.dictation.create({
      data: {
        ...d,
        status: 'PUBLISHED',
        createdById: admin.id,
      },
    });
    console.log(`created: ${d.title}`);
  }

  console.log('Done.');
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

