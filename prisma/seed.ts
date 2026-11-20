import { auth } from '../lib/auth';
import { db } from '../lib/db';

// Seeds the two accounts that used to live in env vars
// (ADMIN_EMAIL / STUDENT_EMAIL). Run with:
//   npx tsx prisma/seed.ts
// (or `prisma db seed` if a seed command is configured).
//
// Passwords come from env so they are never committed.

async function ensureUser(
  email: string,
  password: string,
  name: string,
  role: 'admin' | 'student'
) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Keep the role correct without resetting the password.
    if (existing.role !== role) {
      await db.user.update({ where: { email }, data: { role } });
    }
    console.log(`  exists: ${email} (${role})`);
    return;
  }

  // Create through the admin plugin so the password is hashed in the
  // exact format Better Auth expects. `signUpEmail` would be rejected:
  // public sign-up is disabled (lib/auth-config.ts). Called without
  // request headers, createUser runs as a privileged server-side call.
  await auth.api.createUser({
    body: {
      email,
      password,
      name,
      ...(role === 'admin' ? { role: 'admin' as const } : {}),
    },
  });

  await db.user.update({ where: { email }, data: { role } });
  console.log(`  created: ${email} (${role})`);
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const studentEmail = process.env.STUDENT_EMAIL;
  const studentPassword = process.env.STUDENT_PASSWORD;

  if (!adminEmail || !adminPassword || !studentEmail || !studentPassword) {
    throw new Error(
      'ADMIN_EMAIL, ADMIN_PASSWORD, STUDENT_EMAIL and STUDENT_PASSWORD ' +
        'must be set in your environment to seed accounts.'
    );
  }

  if (adminEmail.trim().toLowerCase() === studentEmail.trim().toLowerCase()) {
    throw new Error('ADMIN_EMAIL and STUDENT_EMAIL must be different.');
  }

  console.log('Seeding accounts…');
  await ensureUser(
    adminEmail.trim().toLowerCase(),
    adminPassword,
    'Administrator',
    'admin'
  );
  await ensureUser(
    studentEmail.trim().toLowerCase(),
    studentPassword,
    'Student',
    'student'
  );

  // The student account gets a StudentProfile so attempts, fees,
  // and assignments have somewhere to attach.
  const student = await db.user.findUnique({
    where: { email: studentEmail.trim().toLowerCase() },
  });
  if (student) {
    await db.studentProfile.upsert({
      where: { userId: student.id },
      update: {},
      create: { userId: student.id },
    });
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

