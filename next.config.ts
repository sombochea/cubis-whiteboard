import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["socket.io"],
  turbopack: {},
};

export default nextConfig;
