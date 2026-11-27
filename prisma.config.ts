import { defineConfig, env } from "prisma/config";

import { loadEnvironment } from "./scripts/load-environment.mjs";

loadEnvironment();

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

