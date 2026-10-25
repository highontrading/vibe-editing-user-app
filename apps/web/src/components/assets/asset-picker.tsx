"use client";
import * as React from "react";
import { Check, Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { VideoThumb } from "@/components/media/video-thumb";
import { EmptyState } from "@/components/empty-state";
import { useAssets } from "@/lib/hooks";
import { cn, formatBytes } from "@/lib/utils";
import type { AssetDTO } from "@/lib/types";

/** Pick one or many assets from the library. */
export function AssetPicker({ open, onClose, onPick, multiple = true, kind, title = "Pick from your library", initial = [] }: { open: boolean; onClose: () => void; onPick: (assets: AssetDTO[]) => void; multiple?: boolean; kind?: "VIDEO" | "AUDIO" | "IMAGE"; title?: string; initial?: string[] }) {
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set(initial));
  const { data, isLoading } = useAssets({ kind, q: q || undefined });
  React.useEffect(() => {
    if (open) setSelected(new Set(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const assets = (data?.assets ?? []).filter((a) => a.status !== "FAILED");
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(multiple ? s : []);
      if (s.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <Dialog open={open} onClose={onClose} title={title} width="max-w-3xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your assets" className="pl-9" />
      </div>
      <div className="mt-4 max-h-[55vh] overflow-auto pr-1">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : assets.length ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {assets.map((a) => {
              const on = selected.has(a.id);
              return (
                <button key={a.id} type="button" onClick={() => toggle(a.id)} className={cn("group relative rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60", on && "ring-2 ring-accent")}>
                  <VideoThumb thumbUrl={a.thumbUrl} previewUrl={a.proxyUrl ?? a.url} seed={a.id} title={a.name} kind={a.kind} durationMs={a.durationMs} />
                  <div className={cn("absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border", on ? "border-accent bg-accent text-black" : "border-white/40 bg-black/40 text-transparent group-hover:border-white")}>
                    <Check className="h-3 w-3" />
                  </div>
                  <div className="mt-1.5 truncate text-xs">{a.name}</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted">
                    {formatBytes(a.sizeBytes)}
                    {a.status !== "READY" && <Badge className="px-1 py-0 text-[9px]">{a.status.toLowerCase()}</Badge>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nothing here yet" description={q ? "No assets match your search." : "Upload footage from Home or the Asset library."} compact />
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-muted">{selected.size ? `${selected.size} selected` : "Select assets"}</div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selected.size}
            onClick={() => {
              onPick(assets.filter((a) => selected.has(a.id)));
              onClose();
            }}
          >
            Use {selected.size || ""}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
