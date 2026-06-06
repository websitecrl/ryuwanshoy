import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images:  {
    dangerouslyAllowSVG: true,
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-5657faa0f50f468797255fb5df45f6ae.r2.dev',
      }
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
