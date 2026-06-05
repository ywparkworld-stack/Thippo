import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/thippo",
  images: { unoptimized: true },
};

export default nextConfig;
