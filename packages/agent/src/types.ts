import type { AssetAnalysis, AssetRef, EditOp, EditScript, Plan, CheckResult } from "@vibe/edl";

/** Everything the agent knows about one uploaded asset. */
export interface AgentAsset {
  ref: AssetRef;
  analysis: AssetAnalysis | null;
}

export interface BrandContext {
  handle?: string | null;
  fonts?: string[];
  colors?: string[];
  logoAssetId?: string | null;
  introAssetId?: string | null;
  outroAssetId?: string | null;
  defaultCaptionStyle?: string | null;
  defaultMusicMood?: string | null;
}

export interface RecipeContext {
  slug: string;
  title: string;
  category: string;
  prompt: string;
  defaults: Record<string, unknown>;
}

export interface ProjectContext {
  projectId: string;
  brief: string;
  aspect: string;
  platform: string;
  targetDurationMs?: number | null;
  assets: AgentAsset[];
  recipe?: RecipeContext | null;
  brand?: BrandContext | null;
  preferences?: Record<string, unknown>;
  /** Analysis of a reference video, if any. */
  reference?: AgentAsset | null;
}

export interface PlanResult {
  plan: Plan;
  /** Conversational message shown in chat above the plan. */
  message: string;
}

export interface BuildResult {
  script: EditScript;
  /** Plain-words summary of what was done, bullet-ish. */
  summary: string;
  checks: CheckResult[];
  suggestions: string[];
}

export interface EditResult {
  script: EditScript;
  ops: EditOp[];
  /** What changed, e.g. "Trimmed 3 clips, replaced music, added lower third". */
  summary: string;
  /** Assistant reply text */
  message: string;
  suggestions: string[];
  checks: CheckResult[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Media the agent may request during build/edit; the pipeline fulfils it. */
export interface MediaProvider {
  /** Returns an AssetRef (registered in storage) for a music track of the mood. */
  getMusic(opts: { mood: string; durationMs: number; projectId: string }): Promise<AssetRef>;
  getSfx(opts: { sfxId: string; projectId: string }): Promise<AssetRef>;
  searchStock(opts: { query: string; kind: "video" | "image"; orientation: "portrait" | "landscape" | "square"; projectId: string; limit?: number }): Promise<AssetRef[]>;
  generateVoice?(opts: { text: string; voice?: string; projectId: string }): Promise<AssetRef>;
  generateImage?(opts: { prompt: string; aspect: string; projectId: string }): Promise<AssetRef>;
}
