import path from "node:path";

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const env = {
  get nodeEnv() { return str("NODE_ENV", "development"); },
  get isProd() { return this.nodeEnv === "production"; },
  get appUrl() { return str("APP_URL", "http://localhost:3000").replace(/\/$/, ""); },
  get dataDir() { return path.resolve(str("DATA_DIR", "./data")); },
  get redisUrl() { return str("REDIS_URL"); },
  get s3() {
    const bucket = str("S3_BUCKET");
    if (!bucket) return null;
    return {
      endpoint: str("S3_ENDPOINT") || undefined,
      region: str("S3_REGION", "auto"),
      bucket,
      accessKeyId: str("S3_ACCESS_KEY_ID"),
      secretAccessKey: str("S3_SECRET_ACCESS_KEY"),
      publicUrl: str("S3_PUBLIC_URL").replace(/\/$/, "") || undefined,
    };
  },
  get anthropicKey() { return str("ANTHROPIC_API_KEY"); },
  get agentModel() { return str("AGENT_MODEL", "claude-opus-5-5"); },
  get agentFastModel() { return str("AGENT_FAST_MODEL", "claude-haiku-5-5"); },
  get deepgramKey() { return str("DEEPGRAM_API_KEY"); },
  get elevenLabsKey() { return str("ELEVENLABS_API_KEY"); },
  get pexelsKey() { return str("PEXELS_API_KEY"); },
  get pixabayKey() { return str("PIXABAY_API_KEY"); },
  get stripe() {
    const key = str("STRIPE_SECRET_KEY");
    if (!key) return null;
    return {
      secretKey: key,
      webhookSecret: str("STRIPE_WEBHOOK_SECRET"),
      prices: { CREATOR: str("STRIPE_PRICE_CREATOR"), PRO: str("STRIPE_PRICE_PRO"), STUDIO: str("STRIPE_PRICE_STUDIO") },
    };
  },
  get workerConcurrency() { return Number(str("WORKER_CONCURRENCY", "2")); },
  get renderConcurrency() { return Number(str("RENDER_CONCURRENCY", "1")); },
  /** true when running without an Anthropic key: the agent uses deterministic heuristics instead. */
  get mockAi() { return !str("ANTHROPIC_API_KEY"); },
};

export type Env = typeof env;
