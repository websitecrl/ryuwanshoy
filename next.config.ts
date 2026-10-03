import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

// Public R2 image hosts. Must match the origin in R2_PUBLIC_URL.
// LEGACY_R2_HOST stays allowed while rows, cached pages and open tabs still
// carry r2.dev URLs — remove it (here and in src/lib/r2.ts) once the
// 20261003130000_rewrite_r2_public_urls migration has run and r2.dev public access is disabled.
const R2_HOST        = 'img.ryuwanshoy.com';
const LEGACY_R2_HOST = 'pub-5657faa0f50f468797255fb5df45f6ae.r2.dev';

const nextConfig: NextConfig = {
  serverExternalPackages:["sharp", "@img/sharp-wasm32"],
  images: {
    // TEMPORARY STOPGAP: unoptimized in all environments, not just dev.
    // Next's built-in optimizer on Cloudflare Workers (via OpenNext) routes
    // through the same env.IMAGES binding that's currently broken (platform
    // bug, ticket open — see src/lib/image-processing.ts for full history).
    // This serves images at their original size/format directly from R2
    // instead of failing with "upstream response is invalid".
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: R2_HOST },
      { protocol: 'https', hostname: LEGACY_R2_HOST },
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options',         value: 'DENY' },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              `img-src 'self' blob: data: https://${R2_HOST} https://${LEGACY_R2_HOST} https://storage.ko-fi.com`,
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.us.sentry.io",
              "frame-src https://www.google.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
  poweredByHeader: false,
};

export default withSentryConfig(nextConfig, {
  org: "ryuwanshoy",
  project: "javascript-nextjs",
  silent: true,
  disableLogger: true,
  sourcemaps: {
    disable: true,
  },
    webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    autoInstrumentAppDirectory: false,
  },
});