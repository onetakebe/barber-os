import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray package-lock.json in the home directory
  // makes Turbopack infer the wrong root and break module resolution.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
