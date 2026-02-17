import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["socket.io"],
  webpack: (config) => {
    // Excalidraw needs this for proper bundling
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

export default nextConfig;
