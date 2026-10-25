import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@vibe/edl", "@vibe/core", "@vibe/db", "@vibe/compositions", "@vibe/agent", "@vibe/pipeline", "@vibe/media"],
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler", "@remotion/compositor-linux-x64-gnu", "@remotion/compositor-linux-x64-musl", "bullmq", "ioredis", "execa", "@prisma/client", "prisma", "@aws-sdk/client-s3"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
