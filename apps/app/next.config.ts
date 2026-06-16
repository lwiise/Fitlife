import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  transpilePackages: ["@fitlife/ui", "@fitlife/config", "@fitlife/plan-engine"],

  // @react-pdf/renderer is loaded dynamically (ssr:false) by DownloadPDFButton,
  // but Turbopack still tries to resolve its imports during SSR compilation.
  // Marking it server-external tells Next.js not to bundle it for the server.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Tree-shake heavy barrel-style imports so only the icons/components actually
  // used reach the client bundle (motion/react is eagerly imported across ~22
  // marketing components). lucide-react is optimized by default; listed for clarity.
  experimental: {
    optimizePackageImports: ["motion/react", "lucide-react"],
  },

  images: {
    // Serve AVIF (smallest) with a WebP fallback. Cache optimized variants for a
    // year — source assets are content-addressed/immutable, so revalidation churn
    // is pure waste.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Quiet (and skip source-map upload) when there's no auth token — keeps the
  // build clean locally and on deploys where the token isn't set.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
