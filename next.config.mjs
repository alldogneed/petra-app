/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Prevent webpack from bundling Prisma (it uses native binaries — must stay external)
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
  productionBrowserSourceMaps: false,
  eslint: { ignoreDuringBuilds: true },
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
          { key: "X-Frame-Options", value: "DENY" },
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
