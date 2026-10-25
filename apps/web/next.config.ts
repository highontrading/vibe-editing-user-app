import type { NextConfig } from "next";

/**
 * Packages that must never be bundled into the server build (native binaries,
 * webpack/rspack toolchains, queue clients). `serverExternalPackages` covers the
 * common case, but pnpm can resolve a package to two different instances (peer
 * dependency variants) in which case Next falls back to bundling; the explicit
 * externals rule below forces them external regardless.
 */
const FORCE_EXTERNAL = /^(@remotion\/(bundler|renderer|compositor-[\w-]+)|@rspack\/[\w-]+|webpack|esbuild|bullmq|ioredis|@prisma\/client|prisma|@aws-sdk\/[\w-]+)(\/|$)/;

const nextConfig: NextConfig = {
  output: "standalone",
  /** Lets several dev servers / builds coexist on one checkout (NEXT_DIST_DIR=.next-xyz). */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@vibe/edl", "@vibe/core", "@vibe/db", "@vibe/compositions", "@vibe/agent", "@vibe/pipeline", "@vibe/media"],
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler", "@remotion/compositor-linux-x64-gnu", "@remotion/compositor-linux-x64-musl", "bullmq", "ioredis", "execa", "@prisma/client", "prisma", "@aws-sdk/client-s3"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const prev = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : [];
      config.externals = [
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request && FORCE_EXTERNAL.test(request)) return callback(null, `commonjs ${request}`);
          return callback();
        },
        ...prev,
      ];
    }
    return config;
  },
};

export default nextConfig;
