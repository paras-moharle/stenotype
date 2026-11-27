import type { NextConfig } from "next";

import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { developmentOrigins } from "./lib/auth-origins";
import { verificationHost } from "./scripts/dev-config.mjs";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Do not advertise the framework/version.
  poweredByHeader: false,
  async headers() {
    // Report-Only: nothing is blocked yet. This catches accidental
    // external scripts/iframes and lets us tighten the policy from real
    // console reports before enforcing it. `unsafe-inline` is required
    // because Next injects inline bootstrap/flight scripts without a
    // nonce; a nonce policy would force every page to be dynamic and
    // would lose the static home page.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ];
  },
};

export default function config(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return nextConfig;
  if (process.env.STENO_DEV_PREFLIGHT !== verificationHost) {
    throw new Error('Start StenoType with pnpm dev so the disposable database and origin are checked first.');
  }
  const origins = [process.env.BETTER_AUTH_URL, ...developmentOrigins()].filter(Boolean);
  return { ...nextConfig, allowedDevOrigins: origins.map(origin => new URL(origin!).hostname) };
}

