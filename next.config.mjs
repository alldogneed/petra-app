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
    // Restrict image optimization proxy to known hosts to prevent SSRF.
    // Vercel Blob storage hosts business logos and pet photos.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "vd0izwltrfibbypf.public.blob.vercel-storage.com",
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
              // Next.js dev mode needs eval for react-refresh/source maps; hydration
              // dies silently without it. Production CSP stays eval-free.
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://connect.facebook.net https://www.youtube.com https://s.ytimg.com`,
              // Sentry Replay compresses its payloads in a blob web worker;
              // without worker-src the script-src fallback blocks it on every page.
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https://*.public.blob.vercel-storage.com https://vd0izwltrfibbypf.public.blob.vercel-storage.com",
              "connect-src 'self' https://www.youtube.com https://play.google.com https://*.public.blob.vercel-storage.com https://vd0izwltrfibbypf.public.blob.vercel-storage.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://connect.facebook.net https://www.facebook.com https://graph.facebook.com",
              "frame-ancestors 'self'",
              // youtube-nocookie: recorded course lessons in the members portal (/c/[slug]).
              "frame-src 'self' blob: https://secure.cardcom.solutions https://www.facebook.com https://web.facebook.com https://www.youtube-nocookie.com https://www.youtube.com",
              "object-src 'self' blob:",  // PDF previews (contract template modal + signed-contract viewer) render via <object>/blob:
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "petra-app",
  project: "petra-app",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
