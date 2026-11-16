import { defineConfig, env } from "prisma/config";

// Next.js keeps secrets in .env.local, but Prisma does not load that
// file on its own. Load it (and .env, if present) into process.env
// first so env("DATABASE_URL") below can resolve it. Missing files
// are ignored. process.loadEnvFile is built into Node 22+.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // File does not exist — that's fine.
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `npx prisma db seed` runs this with the CLI's env loading,
    // so .env.local is already loaded when the seed runs.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

