import type { NextConfig } from "next";

// This runs in the Next.js server process (dev server / standalone server),
// never in the browser, so a plain (non-NEXT_PUBLIC_) env var is fine and
// correct here — it configures where the SERVER proxies "/api/*" to, it
// does not need to be exposed to client-side JS.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
