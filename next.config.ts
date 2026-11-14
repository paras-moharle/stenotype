import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.29.252", "localhost", "127.0.0.1"],
};

export default nextConfig;
