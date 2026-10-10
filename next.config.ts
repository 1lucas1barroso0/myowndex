import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Separate verification builds from an already running local game.
  distDir: process.env.MYOWNDEX_BUILD_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  // Mirror production freshness guarantees under next start, previews and
  // alternate hosts, not only in Vercel-specific headers.
  async headers() {
    return [
      { source: "/", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/icons/:path*", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] },
      { source: "/sprites/:path*", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] },
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] },
    ];
  },
  // Sprite ZIPs are verified and unpacked only at build time. Exclude them
  // from every serverless function trace: only the resulting public art is
  // needed at runtime. Never exclude the resulting static sprites.
  outputFileTracingExcludes: {
    "/*": [
      "./assets/sprites-2d/**/*",
      "./tests/**/*",
      "./docs/**/*",
      "./coverage/**/*",
    ],
  },
};

export default nextConfig;
