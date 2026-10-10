import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Separate verification builds from an already running local game.
  distDir: process.env.MYOWNDEX_BUILD_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
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
