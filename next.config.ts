import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Separate verification builds from an already running local game.
  distDir: process.env.MYOWNDEX_BUILD_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
