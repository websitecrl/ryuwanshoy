import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  serverExternalPackages:["sharp", "@img/sharp-wasm32",  "@aws-sdk/client-s3"],
  images: {
    // TEMPORARY STOPGAP: unoptimized in all environments, not just dev.
    // Next's built-in optimizer on Cloudflare Workers (via OpenNext) routes
    // through the same env.IMAGES binding that's currently broken (platform
    // bug, ticket open — see src/lib/image-processing.ts for full history).
    // This serves images at their original size/format directly from R2
    // instead of failing with "upstream response is invalid".
    unoptimized: true,
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
              "img-src 'self' blob: data: https://pub-5657faa0f50f468797255fb5df45f6ae.r2.dev https://storage.ko-fi.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.us.sentry.io",
              "frame-src https://www.google.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
  poweredByHeader: false,
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true
    }
    return config
  }
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