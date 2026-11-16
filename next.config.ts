import type { NextConfig } from "next";

// Extra dev origins (e.g. your phone on the same LAN) come from the
// DEV_ORIGINS env var — comma-separated hostnames, e.g.
//   DEV_ORIGINS=192.168.1.10
// Put it in .env.local (gitignored) so no IP is committed to the repo.
// For phone testing without any IP, use a tunnel instead:
//   cloudflared tunnel --url http://localhost:3000
const devOrigins = (process.env.DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
  async headers() {
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
        ],
      },
    ];
  },
};

export default nextConfig;

