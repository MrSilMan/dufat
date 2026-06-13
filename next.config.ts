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
