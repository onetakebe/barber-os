import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray package-lock.json in the home directory
  // makes Turbopack infer the wrong root and break module resolution.
  turbopack: { root: path.resolve(__dirname) },
  // The dev filesystem cache (default on in Next 16) kept serving stale
  // globals.css under the same chunk URL after edits; only `rm -rf .next`
  // fixed it. Trading warm-start speed for CSS edits that actually show up.
  experimental: { turbopackFileSystemCacheForDev: false },
};

export default nextConfig;
