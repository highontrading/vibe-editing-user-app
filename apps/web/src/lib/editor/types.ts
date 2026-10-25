/**
 * Shared (client + server) view types for the editor API. Pure types only:
 * this file must stay importable from client components.
 */
import type { EditScript, Plan, AssetAnalysis, CheckResult, EditOp } from "@vibe/edl";

export type ProjectStatus = "DRAFTING" | "ANALYZING" | "PLANNING" | "PLAN_READY" | "BUILDING" | "READY" | "EXPORTING" | "FAILED";
export type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED";
export type AssetStatus = "UPLOADING" | "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
export type VersionSource = "RECIPE" | "AGENT" | "USER" | "IMPORT";

export interface AssetView {
  id: string;
  kind: "VIDEO" | "AUDIO" | "IMAGE";
  source: string;
  name: string;
  mime: string;
  sizeBytes: number;
  status: AssetStatus;
  error: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  analysisStep: string | null;
  /** Compact health report derived from Asset.analysis */
  health: AssetHealth | null;
  url: string;
  proxyUrl: string | null;
  thumbUrl: string | null;
  waveformUrl: string | null;
  createdAt: string;
}

export interface AssetHealth {
  durationMs: number;
  silences: number;
  silenceMs: number;
  fillers: number;
  shots: number;
  shaky: number;
  dark: number;
  words: number;
  speakers: number;
  summary: string | null;
  hooks: AssetAnalysis["hooks"];
  language: string | null;
}

export interface JobView {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  message: string | null;
  error: string | null;
  assetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VersionView {
  id: string;
  parentId: string | null;
  source: VersionSource;
  summary: string;
  label: string | null;
  createdAt: string;
}

export interface VersionWithScript extends VersionView {
  script: EditScript;
}

export interface UserPlanView {
  plan: "FREE" | "CREATOR" | "PRO" | "STUDIO";
  label: string;
  maxResolution: "720p" | "1080p" | "4k";
  watermark: boolean;
  minutesQuota: number;
  minutesUsed: number;
}

export interface ProjectView {
  id: string;
  title: string;
  status: ProjectStatus;
  statusMessage: string | null;
  brief: string | null;
  aspect: string;
  platform: string;
  targetDurationMs: number | null;
  recipeId: string | null;
  plan: Plan | null;
  currentVersionId: string | null;
  thumbUrl: string | null;
  createdAt: string;
  updatedAt: string;
  assets: AssetView[];
  currentVersion: VersionWithScript | null;
  jobs: JobView[];
  user: UserPlanView;
  versionCount: number;
  exportCount: number;
}

/** Structured extras an ASSISTANT message may carry in Message.data. */
export interface AssistantMessageData {
  /** set on the pending placeholder created by POST /chat */
  userMessageId?: string;
  plan?: Plan;
  summary?: string | string[];
  checks?: CheckResult[];
  suggestions?: string[];
  ops?: EditOp[] | number;
  opsCount?: number;
  error?: string;
  /** job id while the edit runs; the UI shows its message */
  jobId?: string;
}

export interface MessageView {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  data: AssistantMessageData | null;
  versionId: string | null;
  status: "pending" | "done" | "error" | string;
  createdAt: string;
}

export interface ExportView {
  id: string;
  versionId: string;
  preset: string;
  width: number;
  height: number;
  fps: number;
  burnCaptions: boolean;
  quality: string;
  status: JobStatus;
  watermark: boolean;
  durationMs: number | null;
  sizeBytes: number | null;
  shareToken: string | null;
  shareUrl: string | null;
  url: string | null;
  downloadUrl: string | null;
  thumbUrl: string | null;
  srtUrl: string | null;
  job: JobView | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface OpsResponse {
  version: VersionView;
  script: EditScript;
}
