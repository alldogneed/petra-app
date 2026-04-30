// @ts-check
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Ensure font + icon are bundled into the consent PDF serverless function on Vercel
  outputFileTracingIncludes: {
    "/api/owner/consents/pdf": ["./public/fonts/*.ttf", "./public/icon.png"],
  },
  // Prevent webpack from bundling Prisma (it uses native binaries — must stay external)
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    instrumentationHook: true,
  },
  productionBrowserSourceMaps: false,
  eslint: { ignoreDuringBuilds: true },
  // Dev-only: disable webpack persistent file-system cache. Hebrew characters
  // in the project path break PackFileCacheStrategy snapshotting on macOS,
  // which causes /dashboard to stall mid-compile. Memory cache works fine.
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  },
  images: {
    // Allow Next.js Image component to optimize images from any HTTPS source
    // Business logos and pet photos can be hosted anywhere
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // SVGs are served as-is (no raster optimization)
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https://*.public.blob.vercel-storage.com https://vd0izwltrfibbypf.public.blob.vercel-storage.com",
              "connect-src 'self' https://*.public.blob.vercel-storage.com https://vd0izwltrfibbypf.public.blob.vercel-storage.com https://*.ingest.sentry.io",
              "frame-ancestors 'self'",
              "frame-src 'self' blob: https:",
              "object-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "petra-app",
  project: "petra-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
