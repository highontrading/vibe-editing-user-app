/**
 * Client-safe DTO types returned by the JSON API routes. Keep these free of
 * Prisma/BigInt/Date so client components can import them.
 */
export type AssetDTO = {
  id: string;
  name: string;
  kind: "VIDEO" | "AUDIO" | "IMAGE";
  source: string;
  status: "UPLOADING" | "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  mime: string;
  sizeBytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  folder: string | null;
  tags: string[];
  projectId: string | null;
  error: string | null;
  analysisStep: string | null;
  createdAt: string;
  updatedAt: string;
  url: string | null;
  thumbUrl: string | null;
  proxyUrl: string | null;
  waveformUrl: string | null;
  job?: { status: string; message: string | null; progress: number; error: string | null } | null;
  analysis?: AssetAnalysisDTO | null;
};

export type AssetAnalysisDTO = {
  durationMs?: number;
  summary?: string;
  language?: string;
  transcript?: { text?: string; segments?: { startMs: number; endMs: number; text: string; speaker?: string }[]; speakers?: string[] };
  shots?: { startMs: number; endMs: number; description?: string }[];
  audio?: { silences?: { startMs: number; endMs: number }[]; loudnessLufs?: number };
  quality?: { fillers?: { startMs: number; endMs: number; text: string }[]; shaky?: unknown[]; dark?: unknown[] };
  hooks?: { startMs: number; endMs: number; text: string; score: number }[];
};

export type ProjectDTO = {
  id: string;
  title: string;
  status: "DRAFTING" | "ANALYZING" | "PLANNING" | "PLAN_READY" | "BUILDING" | "READY" | "EXPORTING" | "FAILED";
  statusMessage: string | null;
  brief: string | null;
  aspect: string;
  platform: string;
  targetDurationMs: number | null;
  recipeId: string | null;
  recipe: { slug: string; title: string; category: string } | null;
  thumbUrl: string | null;
  durationMs: number | null;
  archived: boolean;
  assetCount: number;
  exportCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RecipeDTO = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  bring: string;
  sizes: string[];
  prompt: string;
  defaults: Record<string, unknown>;
  previewUrl: string | null;
  tags: string[];
  usesGenerative: boolean;
  isPublic: boolean;
  isFeatured: boolean;
  ownerId: string | null;
  usageCount: number;
  createdAt: string;
};

export type BrandKitDTO = {
  name: string;
  handle: string | null;
  fonts: string[];
  colors: string[];
  logoAssetId: string | null;
  introAssetId: string | null;
  outroAssetId: string | null;
  defaultCaptionStyle: string | null;
  defaultMusicMood: string | null;
  voice: string | null;
};

export type Preferences = {
  defaultAspect?: "auto" | "9:16" | "16:9" | "1:1" | "4:5";
  defaultPlatform?: string;
  captions?: boolean;
  music?: boolean;
  removeFillers?: boolean;
  language?: string;
};

export type MeDTO = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  plan: "FREE" | "CREATOR" | "PRO" | "STUDIO";
  minutesQuota: number;
  minutesUsed: number;
  cycleStartedAt: string;
  planRenewsAt: string | null;
  onboarded: boolean;
  preferences: Preferences;
  hasPassword: boolean;
  stripeCustomerId: string | null;
  createdAt: string;
};

export type JobDTO = {
  id: string;
  type: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED";
  progress: number;
  message: string | null;
  error: string | null;
  assetId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};
