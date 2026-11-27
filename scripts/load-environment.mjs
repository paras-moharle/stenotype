import { createRequire } from 'node:module';

// Resolve Next's own dotenv loader so the CLI uses the same precedence.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const { loadEnvConfig } = nextRequire('@next/env');

export function loadEnvironment(development = process.env.NODE_ENV !== 'production') {
  loadEnvConfig(process.cwd(), development, {
    info() {},
    error() { throw new Error('An environment file could not be loaded. Check dotenv syntax and permissions.'); },
  });
}
