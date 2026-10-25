"use client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { ASSET_STATUS_META } from "@/lib/options";
import type { AssetDTO } from "@/lib/types";

export function assetStatusText(a: AssetDTO): string {
  const meta = ASSET_STATUS_META[a.status] ?? ASSET_STATUS_META.UPLOADED!;
  if (a.status === "FAILED") return a.error || a.job?.error || "Failed";
  if (a.status === "PROCESSING") return a.job?.message || a.analysisStep || "Processing";
  if (a.status === "UPLOADED") return a.job?.status === "RUNNING" ? a.job.message || "Processing" : a.job?.status === "FAILED" ? a.job.error || "Processing failed" : "Queued for processing";
  return meta.label;
}

export function AssetStatusBadge({ asset, className }: { asset: AssetDTO; className?: string }) {
  const meta = ASSET_STATUS_META[asset.status] ?? ASSET_STATUS_META.UPLOADED!;
  const text = assetStatusText(asset);
  const busy = meta.busy && !(asset.status === "UPLOADED" && asset.job?.status === "FAILED");
  const tone = asset.status === "UPLOADED" && asset.job?.status === "FAILED" ? "danger" : meta.tone;
  if (asset.status === "READY") return null;
  return (
    <Badge tone={tone} title={text} className={className}>
      {busy && <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />}
      <span className="max-w-[140px] truncate">{text}</span>
    </Badge>
  );
}
