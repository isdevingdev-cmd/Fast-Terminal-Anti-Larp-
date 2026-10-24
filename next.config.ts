import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Token images come from arbitrary IPFS gateways; we render them with <img>.
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lightweight-charts"],
  },
};

export default nextConfig;
