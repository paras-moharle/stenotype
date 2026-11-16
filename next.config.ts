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
};

export default nextConfig;

