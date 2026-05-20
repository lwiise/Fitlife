import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  transpilePackages: ["@fitlife/ui", "@fitlife/config", "@fitlife/plan-engine"],

  // @react-pdf/renderer is loaded dynamically (ssr:false) by DownloadPDFButton,
  // but Turbopack still tries to resolve its imports during SSR compilation.
  // Marking it server-external tells Next.js not to bundle it for the server.
  serverExternalPackages: ["@react-pdf/renderer"],

  images: {
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

export default nextConfig;
