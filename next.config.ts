import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  // Node-only packages must not be bundled into server chunks.
  serverExternalPackages: [
    "winston",
    "winston-daily-rotate-file",
    "winston-transport",
    "ioredis",
    "pg",
    "@prisma/adapter-pg",
  ],
  async headers() {
    return [
      {
        // The 3D assets are the page's largest downloads (0.6–1.5 MB after
        // scripts/optimize-glb.mjs) and only change when the designer
        // re-delivers — cache them hard so repeat visits skip the download.
        // NOTE: a re-delivered GLB must get a new filename (or the URL a
        // version suffix) to bust this cache.
        source: "/dufat-3d-assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // The placeholder catalog art is SVG; serve it safely through next/image.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Only attempt a source map upload when credentials are configured.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  disableLogger: true,
  widenClientFileUpload: true,
});
