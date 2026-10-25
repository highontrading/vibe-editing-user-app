"use client";
import * as React from "react";
import { AtSign, Film, ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import { CAPTION_STYLES, MUSIC_MOOD_INFO } from "@vibe/edl";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { AssetPicker } from "@/components/assets/asset-picker";
import { FilePicker } from "@/components/upload/dropzone";
import { VideoThumb } from "@/components/media/video-thumb";
import { CaptionStyleCard } from "./caption-style-card";
import { uploadFiles } from "@/lib/upload";
import { api, cn } from "@/lib/utils";
import { BRAND_FONTS } from "@/lib/options";
import type { AssetDTO, BrandKitDTO } from "@/lib/types";

const DEFAULT_COLORS = ["#FFD400", "#0B0B0F", "#F2F2F5"];

export function BrandForm({ initial, assets }: { initial: BrandKitDTO; assets: Record<string, AssetDTO | null> }) {
  const [kit, setKit] = React.useState<BrandKitDTO>(initial);
  const [saved, setSaved] = React.useState<BrandKitDTO>(initial);
  const [refs, setRefs] = React.useState<Record<string, AssetDTO | null>>(assets);
  const [saving, setSaving] = React.useState(false);
  const [picker, setPicker] = React.useState<"introAssetId" | "outroAssetId" | "logoAssetId" | null>(null);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const dirty = JSON.stringify(kit) !== JSON.stringify(saved);

  async function save() {
    setSaving(true);
    try {
      const res = await api<BrandKitDTO>("/api/brand", { method: "PUT", json: kit });
      setKit(res);
      setSaved(res);
      toast.success("Brand kit saved", "It will be applied to every new project.");
    } catch (e) {
      toast.error("Could not save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }
  async function uploadLogo(files: File[]) {
    const f = files[0];
    if (!f) return;
    setUploadingLogo(true);
    try {
      const [id] = await uploadFiles([f], { folder: "Brand" });
      if (!id) throw new Error("Upload failed");
      const a = await api<AssetDTO>(`/api/assets/${id}`);
      setRefs((r) => ({ ...r, [id]: a }));
      setKit((k) => ({ ...k, logoAssetId: id }));
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error("Logo upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setUploadingLogo(false);
    }
  }
  const setColor = (i: number, v: string) => setKit((k) => ({ ...k, colors: k.colors.map((c, j) => (j === i ? v : c)) }));
  const logo = kit.logoAssetId ? refs[kit.logoAssetId] : null;
  const intro = kit.introAssetId ? refs[kit.introAssetId] : null;
  const outro = kit.outroAssetId ? refs[kit.outroAssetId] : null;

  return (
    <div className="px-8 py-10 md:px-12">
      <PageHeader
        eyebrow="Brand kit"
        title="Make every video yours"
        description="Logo, fonts, colours, handle, intro and outro, default captions and music. Applied automatically to new projects; change anything per project in the editor."
        actions={
          <Button variant="accent" onClick={save} loading={saving} disabled={!dirty}>
            {dirty ? "Save brand kit" : "Saved"}
          </Button>
        }
      />
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Brand name</Label>
                <Input value={kit.name} onChange={(e) => setKit({ ...kit, name: e.target.value })} placeholder="Acme Studio" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Handle</Label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <Input value={kit.handle ?? ""} onChange={(e) => setKit({ ...kit, handle: e.target.value.replace(/^@/, "") })} placeholder="yourhandle" className="pl-8" />
                </div>
                <div className="text-[11px] text-muted">Shown on end cards and lower thirds.</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border border-border bg-[conic-gradient(#1a1a22_25%,#121218_0_50%,#1a1a22_0_75%,#121218_0)] bg-[length:16px_16px]">
                  {logo?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo.url} alt="Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <FilePicker onFiles={uploadLogo} multiple={false} accept="image/*" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-white/5">
                    <Upload className="h-3.5 w-3.5" /> {uploadingLogo ? "Uploading…" : "Upload PNG / SVG"}
                  </FilePicker>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setPicker("logoAssetId")}>
                      From library
                    </Button>
                    {kit.logoAssetId && (
                      <Button size="sm" variant="ghost" onClick={() => setKit({ ...kit, logoAssetId: null })}>
                        <X className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Colours & fonts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div>
              <Label>Colours (up to 5)</Label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {kit.colors.map((c, i) => (
                  <div key={i} className="group relative">
                    <label className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/15 shadow-inner" style={{ background: c }} title={c}>
                      <input type="color" value={c} onChange={(e) => setColor(i, e.target.value)} className="h-0 w-0 opacity-0" />
                    </label>
                    <button type="button" onClick={() => setKit({ ...kit, colors: kit.colors.filter((_, j) => j !== i) })} className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-bg-3 text-muted group-hover:flex hover:text-fg" aria-label="Remove colour">
                      <X className="h-2.5 w-2.5" />
                    </button>
                    <div className="mt-1 text-center font-mono text-[9px] uppercase text-muted">{c.replace("#", "")}</div>
                  </div>
                ))}
                {kit.colors.length < 5 && (
                  <button type="button" onClick={() => setKit({ ...kit, colors: [...kit.colors, DEFAULT_COLORS[kit.colors.length] ?? "#7CF0FF"] })} className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border text-muted hover:border-white/30 hover:text-fg" aria-label="Add colour">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-1.5 text-[11px] text-muted">First colour is the accent used for highlights, bars and titles.</div>
            </div>
            <div>
              <Label>Fonts (display, body, optional accent)</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Select key={i} value={kit.fonts[i] ?? ""} onChange={(e) => setKit({ ...kit, fonts: Object.assign([...kit.fonts], { [i]: e.target.value }).filter((f: string) => f !== undefined) })} className="w-full">
                    <option value="">{i === 0 ? "Display font" : i === 1 ? "Body font" : "Accent font"}</option>
                    {BRAND_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-border bg-bg-3 p-3">
                <div className="text-2xl leading-tight" style={{ fontFamily: kit.fonts[0] ? `"${kit.fonts[0]}", Inter, sans-serif` : undefined, color: kit.colors[0] }}>
                  {kit.name || "Your brand"}
                </div>
                <div className="mt-1 text-sm text-muted" style={{ fontFamily: kit.fonts[1] ? `"${kit.fonts[1]}", Inter, sans-serif` : undefined }}>
                  Three pricing mistakes most founders make · {kit.handle ? `@${kit.handle}` : "@handle"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Intro & outro clips</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["introAssetId", "Intro", intro],
                ["outroAssetId", "Outro", outro],
              ] as const
            ).map(([key, label, asset]) => (
              <div key={key}>
                <Label>{label}</Label>
                <div className="mt-1.5">
                  {asset ? (
                    <div className="relative">
                      <VideoThumb thumbUrl={asset.thumbUrl} previewUrl={asset.proxyUrl} seed={asset.id} title={asset.name} kind={asset.kind} durationMs={asset.durationMs} />
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="truncate text-xs">{asset.name}</div>
                        <button type="button" onClick={() => setKit({ ...kit, [key]: null })} className="text-muted hover:text-fg" aria-label="Remove">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPicker(key)} className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-muted hover:border-white/30 hover:text-fg">
                      <Film className="h-4 w-4" />
                      <span className="text-xs">Pick from library</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="text-[11px] text-muted sm:col-span-2">Added to the start and end of every build. Keep them under 3 seconds for short-form.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default music mood</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MUSIC_MOOD_INFO.map((m) => (
                <button key={m.id} type="button" onClick={() => setKit({ ...kit, defaultMusicMood: kit.defaultMusicMood === m.id ? null : m.id })} className={cn("rounded-lg border px-3 py-2 text-left transition-colors", kit.defaultMusicMood === m.id ? "border-accent bg-accent/10" : "border-border hover:border-white/25")}>
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-[11px] text-muted">
                    {m.description} · {m.bpm[0]}–{m.bpm[1]} bpm
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-muted">Recipes may override this; say “no music” in any brief to skip it.</div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Default caption style</CardTitle>
            {kit.defaultCaptionStyle && (
              <button className="text-xs text-muted hover:text-fg" onClick={() => setKit({ ...kit, defaultCaptionStyle: null })}>
                Let recipes decide
              </button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {CAPTION_STYLES.map((s) => (
                <CaptionStyleCard key={s.id} id={s.id} name={s.name} description={s.description} selected={kit.defaultCaptionStyle === s.id} onSelect={() => setKit({ ...kit, defaultCaptionStyle: s.id })} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {dirty && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-bg-2 px-4 py-2 shadow-2xl">
          <span className="text-sm text-muted">Unsaved changes</span>
          <Button size="sm" variant="ghost" onClick={() => setKit(saved)}>
            Discard
          </Button>
          <Button size="sm" variant="accent" onClick={save} loading={saving}>
            Save brand kit
          </Button>
        </div>
      )}

      <AssetPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        multiple={false}
        kind={picker === "logoAssetId" ? "IMAGE" : "VIDEO"}
        title={picker === "logoAssetId" ? "Pick a logo" : picker === "introAssetId" ? "Pick an intro clip" : "Pick an outro clip"}
        onPick={(list) => {
          const a = list[0];
          if (!a || !picker) return;
          setRefs((r) => ({ ...r, [a.id]: a }));
          setKit((k) => ({ ...k, [picker]: a.id }));
        }}
      />
    </div>
  );
}
