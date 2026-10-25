"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, ExternalLink, Film, Mic, Scissors, Trash2, Volume1, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { AssetStatusBadge, assetStatusText } from "./asset-status";
import { api, cn, formatBytes, formatDuration, timeAgo } from "@/lib/utils";
import useSWR from "swr";
import { fetcher } from "@/lib/utils";
import type { AssetDTO } from "@/lib/types";

export function AssetDrawer({ assetId, onClose, onChanged, onDelete, onUse }: { assetId: string | null; onClose: () => void; onChanged: (a: AssetDTO) => void; onDelete: (a: AssetDTO) => void; onUse: (a: AssetDTO) => void }) {
  const { data: asset, mutate } = useSWR<AssetDTO>(assetId ? `/api/assets/${assetId}` : null, fetcher, { refreshInterval: (d) => (d && d.status !== "READY" && d.status !== "FAILED" ? 3000 : 0) });
  const [name, setName] = React.useState("");
  const [folder, setFolder] = React.useState("");
  const [tags, setTags] = React.useState("");
  React.useEffect(() => {
    if (asset) {
      setName(asset.name);
      setFolder(asset.folder ?? "");
      setTags(asset.tags.join(", "));
    }
  }, [asset?.id, asset?.name, asset?.folder, asset?.tags.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!assetId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assetId, onClose]);

  async function save() {
    if (!asset) return;
    const patch = { name: name.trim() || asset.name, folder: folder.trim() || null, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      const updated = await api<AssetDTO>(`/api/assets/${asset.id}`, { method: "PATCH", json: patch });
      mutate({ ...asset, ...updated }, false);
      onChanged({ ...asset, ...updated });
      toast.success("Saved");
    } catch (e) {
      toast.error("Could not save", e instanceof Error ? e.message : undefined);
    }
  }
  const dirty = asset && (name.trim() !== asset.name || (folder.trim() || "") !== (asset.folder ?? "") || tags.split(",").map((t) => t.trim()).filter(Boolean).join(",") !== asset.tags.join(","));
  const an = asset?.analysis ?? null;
  const counts = an ? { silences: an.audio?.silences?.length ?? 0, fillers: an.quality?.fillers?.length ?? 0, shots: an.shots?.length ?? 0, shaky: an.quality?.shaky?.length ?? 0, dark: an.quality?.dark?.length ?? 0 } : null;

  return (
    <AnimatePresence>
      {assetId && (
        <>
          <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-40 bg-black/50 lg:bg-transparent" onClick={onClose} />
          <motion.aside key="panel" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.2 }} className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-bg-2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">Asset details</div>
              <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-white/10 hover:text-fg" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {!asset ? (
              <div className="flex flex-col gap-3 p-4">
                <Skeleton className="aspect-video w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <div className="relative aspect-video bg-black">
                  {asset.kind === "VIDEO" && (asset.proxyUrl || asset.url) ? (
                    <video src={asset.proxyUrl ?? asset.url ?? undefined} poster={asset.thumbUrl ?? undefined} controls preload="metadata" className="h-full w-full" />
                  ) : asset.kind === "IMAGE" && asset.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt={asset.name} className="h-full w-full object-contain" />
                  ) : asset.kind === "AUDIO" && asset.url ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                      <Volume1 className="h-8 w-8 text-muted" />
                      <audio src={asset.url} controls className="w-11/12" />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">
                      <Film className="h-6 w-6" />
                    </div>
                  )}
                </div>
                {asset.stripUrl && asset.kind === "VIDEO" && (
                  <div className="border-b border-border px-4 py-3">
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Thumbnail strip</div>
                    <div className="no-scrollbar overflow-x-auto rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.stripUrl} alt="" className="h-16 max-w-none" />
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-4 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{asset.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        <Badge className="px-1.5 py-0">{asset.kind.toLowerCase()}</Badge>
                        {asset.width && asset.height && <span>{asset.width}×{asset.height}</span>}
                        {asset.fps && <span>· {Math.round(asset.fps)} fps</span>}
                        {asset.durationMs ? <span>· {formatDuration(asset.durationMs)}</span> : null}
                        <span>· {formatBytes(asset.sizeBytes)}</span>
                        <span>· {timeAgo(asset.createdAt)}</span>
                      </div>
                    </div>
                    <AssetStatusBadge asset={asset} />
                  </div>
                  {asset.status !== "READY" && <div className={cn("rounded-lg border px-3 py-2 text-xs", asset.status === "FAILED" ? "border-danger/30 bg-danger/10 text-danger" : "border-border bg-bg-3 text-muted")}>{assetStatusText(asset)}</div>}

                  {an?.summary && <p className="text-sm text-muted">{an.summary}</p>}

                  {counts && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Footage health</div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Silences", value: counts.silences, icon: Volume1 },
                          { label: "Fillers", value: counts.fillers, icon: Mic },
                          { label: "Shots", value: counts.shots, icon: Scissors },
                        ].map((c) => (
                          <div key={c.label} className="rounded-lg border border-border bg-bg-3 p-2.5">
                            <div className="flex items-center gap-1 text-[11px] text-muted">
                              <c.icon className="h-3 w-3" /> {c.label}
                            </div>
                            <div className="mt-0.5 font-display text-2xl">{c.value}</div>
                          </div>
                        ))}
                      </div>
                      {(counts.shaky > 0 || counts.dark > 0) && (
                        <div className="mt-1.5 text-[11px] text-muted">
                          {counts.shaky > 0 && `${counts.shaky} shaky section${counts.shaky === 1 ? "" : "s"}`}
                          {counts.shaky > 0 && counts.dark > 0 && " · "}
                          {counts.dark > 0 && `${counts.dark} dark shot${counts.dark === 1 ? "" : "s"}`}
                        </div>
                      )}
                    </div>
                  )}

                  {an?.transcript?.text ? (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted">
                        <span>Transcript</span>
                        {an.language && <span className="normal-case tracking-normal">{an.language}</span>}
                      </div>
                      <div className="max-h-56 overflow-auto rounded-lg border border-border bg-bg-3 p-3 text-xs leading-relaxed text-fg/90">
                        {an.transcript.segments?.length ? (
                          an.transcript.segments.map((s, i) => (
                            <p key={i} className="mb-1.5">
                              <span className="mr-1.5 font-mono text-[10px] text-muted">{formatDuration(s.startMs)}</span>
                              {s.speaker && <span className="mr-1 text-accent-2">{s.speaker}:</span>}
                              {s.text}
                            </p>
                          ))
                        ) : (
                          <p>{an.transcript.text}</p>
                        )}
                      </div>
                    </div>
                  ) : asset.status === "READY" && asset.kind !== "IMAGE" ? (
                    <div className="text-xs text-muted">No speech detected.</div>
                  ) : null}

                  {an?.hooks?.length ? (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Best hook lines</div>
                      <ul className="flex flex-col gap-1">
                        {an.hooks.slice(0, 3).map((h, i) => (
                          <li key={i} className="rounded-lg border border-border bg-bg-3 px-2.5 py-1.5 text-xs">
                            <span className="mr-1.5 font-mono text-[10px] text-muted">{formatDuration(h.startMs)}</span>“{h.text}”
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <div className="flex flex-col gap-1.5">
                      <Label>Name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label>Folder</Label>
                        <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="e.g. Podcast S2" list="asset-folders" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Tags</Label>
                        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" />
                      </div>
                    </div>
                    {dirty && (
                      <Button variant="primary" size="sm" onClick={save} className="self-end">
                        <Check className="h-3.5 w-3.5" /> Save changes
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {asset && (
              <div className="flex items-center gap-2 border-t border-border p-3">
                <Button variant="accent" size="sm" onClick={() => onUse(asset)}>
                  Use in new project
                </Button>
                {asset.url && (
                  <a href={`${asset.url}${asset.url.includes("?") ? "&" : "?"}download=${encodeURIComponent(asset.name)}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-white/5">
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                )}
                {asset.projectId && (
                  <a href={`/editor/${asset.projectId}`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:text-fg">
                    <ExternalLink className="h-3.5 w-3.5" /> Project
                  </a>
                )}
                <div className="flex-1" />
                <Button variant="danger" size="sm" onClick={() => onDelete(asset)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
