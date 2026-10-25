"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Folder, FolderInput, LayoutGrid, Library, List, MoreHorizontal, Pencil, Search, Sparkles, Square, Tag, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { VideoThumb } from "@/components/media/video-thumb";
import { Dropzone, FilePicker } from "@/components/upload/dropzone";
import { ConfirmDialog } from "@/components/projects/project-dialogs";
import { AssetDrawer } from "./asset-drawer";
import { AssetStatusBadge, assetStatusText } from "./asset-status";
import { uploadFiles, useUploads } from "@/lib/upload";
import { useAssets } from "@/lib/hooks";
import { api, cn, formatBytes, formatDuration, timeAgo } from "@/lib/utils";
import type { AssetDTO, ProjectDTO } from "@/lib/types";

type View = "grid" | "list";

export function AssetsView({ initial }: { initial: { assets: AssetDTO[]; folders: string[]; tags: string[]; total: number } }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState("");
  const [folder, setFolder] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [view, setView] = React.useState<View>("grid");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [open, setOpen] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<AssetDTO | null>(null);
  const [moving, setMoving] = React.useState<AssetDTO[] | null>(null);
  const [tagging, setTagging] = React.useState<AssetDTO[] | null>(null);
  const [deleting, setDeleting] = React.useState<AssetDTO[] | null>(null);
  const uploads = useUploads((s) => s.items);
  const uploadingCount = uploads.filter((u) => ["queued", "uploading", "finishing"].includes(u.status)).length;

  React.useEffect(() => {
    try {
      setView((localStorage.getItem("vibe.assetsView") as View) || "grid");
    } catch {}
  }, []);
  const setViewPersist = (v: View) => {
    setView(v);
    try {
      localStorage.setItem("vibe.assetsView", v);
    } catch {}
  };

  const { data, isLoading, mutate } = useAssets({ q: q || undefined, kind: kind || undefined, folder: folder || undefined, tag: tag || undefined, status: status || undefined }, { refreshInterval: 4000 });
  const assets = data?.assets ?? (q || kind || folder || tag || status ? [] : initial.assets);
  const folders = data?.folders ?? initial.folders;
  const tags = data?.tags ?? initial.tags;
  const total = data?.total ?? initial.total;

  const refresh = React.useCallback(() => void mutate(), [mutate]);
  // refresh when uploads finish
  const doneCount = uploads.filter((u) => u.status === "processing" || u.status === "done").length;
  React.useEffect(() => {
    refresh();
  }, [doneCount, refresh]);

  const onUpload = (files: File[]) => {
    toast.info(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}`);
    void uploadFiles(files, { folder: folder || undefined }).then(() => refresh());
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectedAssets = assets.filter((a) => selected.has(a.id));
  const allSelected = assets.length > 0 && selectedAssets.length === assets.length;

  async function patchMany(list: AssetDTO[], patch: Record<string, unknown>, label: string) {
    const ids = new Set(list.map((a) => a.id));
    mutate((cur) => (cur ? { ...cur, assets: cur.assets.map((a) => (ids.has(a.id) ? { ...a, ...patch } : a)) } : cur), { revalidate: false });
    try {
      await Promise.all(list.map((a) => api(`/api/assets/${a.id}`, { method: "PATCH", json: patch })));
      toast.success(label);
    } catch (e) {
      toast.error("Update failed", e instanceof Error ? e.message : undefined);
    } finally {
      void mutate();
    }
  }
  async function deleteMany(list: AssetDTO[]) {
    const ids = new Set(list.map((a) => a.id));
    mutate((cur) => (cur ? { ...cur, assets: cur.assets.filter((a) => !ids.has(a.id)) } : cur), { revalidate: false });
    setSelected(new Set());
    if (open && ids.has(open)) setOpen(null);
    try {
      await Promise.all(list.map((a) => api(`/api/assets/${a.id}`, { method: "DELETE" })));
      toast.success(list.length === 1 ? "Asset deleted" : `${list.length} assets deleted`);
    } catch (e) {
      toast.error("Delete failed", e instanceof Error ? e.message : undefined);
    } finally {
      void mutate();
    }
  }
  async function useInProject(list: AssetDTO[]) {
    try {
      const p = await api<ProjectDTO>("/api/projects", { method: "POST", json: { brief: "", aspect: "auto", assetIds: list.map((a) => a.id), title: list.length === 1 ? list[0]!.name.replace(/\.[^.]+$/, "") : undefined } });
      toast.success("Project created", p.title);
      router.push(`/editor/${p.id}`);
    } catch (e) {
      toast.error("Could not create project", e instanceof Error ? e.message : undefined);
    }
  }

  const ItemMenu = ({ a }: { a: AssetDTO }) => (
    <Menu
      trigger={
        <button className="rounded-md bg-black/50 p-1 text-white/80 backdrop-blur hover:bg-black/70 hover:text-white" aria-label="Asset actions">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      }
    >
      <MenuItem icon={Sparkles} onClick={() => useInProject([a])}>
        Use in new project
      </MenuItem>
      <MenuItem icon={Pencil} onClick={() => setRenaming(a)}>
        Rename
      </MenuItem>
      <MenuItem icon={FolderInput} onClick={() => setMoving([a])}>
        Move to folder
      </MenuItem>
      <MenuItem icon={Tag} onClick={() => setTagging([a])}>
        Edit tags
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={Trash2} danger onClick={() => setDeleting([a])}>
        Delete
      </MenuItem>
    </Menu>
  );

  return (
    <Dropzone onFiles={onUpload} className="min-h-full">
      <div className="px-8 py-10 md:px-12">
        <PageHeader
          eyebrow="Asset library"
          title="All your footage"
          description={`${total} asset${total === 1 ? "" : "s"} · uploads, generated media and brand assets, reusable across projects.`}
          actions={
            <>
              <FilePicker onFiles={onUpload} directory className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-white/5">
                <Folder className="h-4 w-4" /> Upload folder
              </FilePicker>
              <FilePicker onFiles={onUpload} className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-black hover:bg-accent/90">
                <Upload className="h-4 w-4" /> Upload{uploadingCount ? ` (${uploadingCount})` : ""}
              </FilePicker>
            </>
          }
        />

        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets" className="h-8 pl-9 text-xs" />
            </div>
            <Tabs
              size="sm"
              value={kind}
              onChange={setKind}
              items={[
                { value: "", label: "All" },
                { value: "VIDEO", label: "Video" },
                { value: "AUDIO", label: "Audio" },
                { value: "IMAGE", label: "Images" },
              ]}
            />
            <Select value={folder} onChange={(e) => setFolder(e.target.value)} className="h-8 text-xs">
              <option value="">All folders</option>
              <option value="__none__">No folder</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
            {tags.length > 0 && (
              <Select value={tag} onChange={(e) => setTag(e.target.value)} className="h-8 text-xs">
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </Select>
            )}
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 text-xs">
              <option value="">Any status</option>
              <option value="READY">Ready</option>
              <option value="PROCESSING">Processing</option>
              <option value="UPLOADED">Queued</option>
              <option value="UPLOADING">Uploading</option>
              <option value="FAILED">Failed</option>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSelected(allSelected ? new Set() : new Set(assets.map((a) => a.id)))} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted hover:bg-white/6 hover:text-fg">
              {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />} {allSelected ? "Clear" : "Select all"}
            </button>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button onClick={() => setViewPersist("grid")} className={cn("rounded-md p-1.5", view === "grid" ? "bg-white/10 text-fg" : "text-muted hover:text-fg")} aria-label="Grid view">
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewPersist("list")} className={cn("rounded-md p-1.5", view === "list" ? "bg-white/10 text-fg" : "text-muted hover:text-fg")} aria-label="List view">
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {isLoading && !assets.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : assets.length === 0 ? (
            q || kind || folder || tag || status ? (
              <EmptyState icon={Search} title="No matching assets" description="Try another search or clear the filters." compact />
            ) : (
              <EmptyState
                icon={Library}
                title="Your library is empty"
                description="Drop video, audio or images anywhere on this page. Whole folders work too. Everything you upload is reusable across projects."
                action={
                  <FilePicker onFiles={onUpload} className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-black hover:bg-accent/90">
                    <Upload className="h-4 w-4" /> Upload footage
                  </FilePicker>
                }
              />
            )
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              {assets.map((a) => {
                const on = selected.has(a.id);
                return (
                  <div key={a.id} className={cn("group relative", on && "rounded-xl ring-2 ring-accent ring-offset-2 ring-offset-bg")}>
                    <button type="button" onClick={() => setOpen(a.id)} className="block w-full text-left focus:outline-none">
                      <VideoThumb thumbUrl={a.thumbUrl} previewUrl={a.proxyUrl} seed={a.id} title={a.name} kind={a.kind} durationMs={a.durationMs} className="card-hover border border-transparent" badge={<AssetStatusBadge asset={a} />} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(a.id);
                      }}
                      className={cn("absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded border bg-black/50 backdrop-blur transition-opacity", on ? "border-accent bg-accent text-black opacity-100" : "border-white/50 text-transparent opacity-0 group-hover:opacity-100")}
                      aria-label="Select"
                    >
                      <CheckSquare className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-9 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <ItemMenu a={a} />
                    </div>
                    <div className="mt-2 px-0.5">
                      <button type="button" onClick={() => setOpen(a.id)} className="block w-full truncate text-left text-xs font-medium hover:underline underline-offset-4">
                        {a.name}
                      </button>
                      <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted">
                        {formatBytes(a.sizeBytes)}
                        {a.folder && (
                          <span className="inline-flex items-center gap-0.5">
                            · <Folder className="h-2.5 w-2.5" /> {a.folder}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-bg-2 text-left text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">Folder</th>
                    <th className="px-3 py-2">Added</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} className={cn("border-t border-border transition-colors hover:bg-white/3", selected.has(a.id) && "bg-accent/5")}>
                      <td className="px-3 py-2">
                        <button onClick={() => toggle(a.id)} className="text-muted hover:text-fg" aria-label="Select">
                          {selected.has(a.id) ? <CheckSquare className="h-4 w-4 text-accent" /> : <Square className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => setOpen(a.id)} className="flex items-center gap-3 text-left">
                          <div className="w-16 shrink-0">
                            <VideoThumb thumbUrl={a.thumbUrl} seed={a.id} kind={a.kind} aspect="aspect-video" className="rounded-md" hoverPlay={false} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{a.name}</div>
                            <div className="text-[11px] text-muted">
                              {a.kind.toLowerCase()}
                              {a.width && a.height ? ` · ${a.width}×${a.height}` : ""}
                              {a.tags.length ? ` · ${a.tags.map((t) => `#${t}`).join(" ")}` : ""}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-2">{a.status === "READY" ? <Badge tone="success">Ready</Badge> : <AssetStatusBadge asset={a} />}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted">{a.durationMs ? formatDuration(a.durationMs) : "–"}</td>
                      <td className="px-3 py-2 text-xs text-muted">{formatBytes(a.sizeBytes)}</td>
                      <td className="px-3 py-2 text-xs text-muted">{a.folder ?? "–"}</td>
                      <td className="px-3 py-2 text-xs text-muted">{timeAgo(a.createdAt)}</td>
                      <td className="px-3 py-2">
                        <ItemMenu a={a} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedAssets.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border bg-bg-2 px-3 py-2 shadow-2xl">
          <div className="px-2 text-sm font-medium">{selectedAssets.length} selected</div>
          <Button size="sm" variant="accent" onClick={() => useInProject(selectedAssets)}>
            <Sparkles className="h-3.5 w-3.5" /> Use in new project
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMoving(selectedAssets)}>
            <FolderInput className="h-3.5 w-3.5" /> Move
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTagging(selectedAssets)}>
            <Tag className="h-3.5 w-3.5" /> Tag
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleting(selectedAssets)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <button onClick={() => setSelected(new Set())} className="rounded-md p-1 text-muted hover:text-fg" aria-label="Clear selection">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <datalist id="asset-folders">
        {folders.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <AssetDrawer
        assetId={open}
        onClose={() => setOpen(null)}
        onChanged={(a) => mutate((cur) => (cur ? { ...cur, assets: cur.assets.map((x) => (x.id === a.id ? { ...x, ...a } : x)) } : cur), { revalidate: true })}
        onDelete={(a) => setDeleting([a])}
        onUse={(a) => useInProject([a])}
      />
      <TextDialog open={!!renaming} title="Rename asset" label="Name" initial={renaming?.name ?? ""} onClose={() => setRenaming(null)} onSubmit={(v) => renaming && patchMany([renaming], { name: v }, "Renamed")} />
      <TextDialog open={!!moving} title={`Move ${moving?.length ?? 0} asset${moving?.length === 1 ? "" : "s"} to folder`} label="Folder (leave empty for none)" initial={moving?.[0]?.folder ?? ""} list="asset-folders" onClose={() => setMoving(null)} onSubmit={(v) => moving && patchMany(moving, { folder: v || null }, v ? `Moved to ${v}` : "Removed from folder")} allowEmpty />
      <TextDialog open={!!tagging} title={`Tags for ${tagging?.length ?? 0} asset${tagging?.length === 1 ? "" : "s"}`} label="Tags, comma separated" initial={tagging?.length === 1 ? tagging[0]!.tags.join(", ") : ""} onClose={() => setTagging(null)} onSubmit={(v) => tagging && patchMany(tagging, { tags: v.split(",").map((t) => t.trim()).filter(Boolean) }, "Tags updated")} allowEmpty />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title={deleting?.length === 1 ? "Delete asset?" : `Delete ${deleting?.length} assets?`} description="The files are removed from storage. Projects that use them will lose this footage. This cannot be undone." onConfirm={async () => {
          if (deleting) await deleteMany(deleting);
        }} />
    </Dropzone>
  );
}

function TextDialog({ open, title, label, initial, list, onClose, onSubmit, allowEmpty }: { open: boolean; title: string; label: string; initial: string; list?: string; onClose: () => void; onSubmit: (v: string) => void; allowEmpty?: boolean }) {
  const [v, setV] = React.useState(initial);
  React.useEffect(() => setV(initial), [initial, open]);
  return (
    <Dialog open={open} onClose={onClose} title={title} width="max-w-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!allowEmpty && !v.trim()) return;
          onSubmit(v.trim());
          onClose();
        }}
        className="flex flex-col gap-3"
      >
        <label className="text-xs font-medium text-muted">{label}</label>
        <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} list={list} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
