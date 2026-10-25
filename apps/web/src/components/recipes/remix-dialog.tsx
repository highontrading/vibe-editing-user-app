"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Film, FolderOpen, Upload, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Chip } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { Dropzone, FilePicker } from "@/components/upload/dropzone";
import { AssetPicker } from "@/components/assets/asset-picker";
import { uploadFiles } from "@/lib/upload";
import { api, formatBytes } from "@/lib/utils";
import type { AssetDTO, ProjectDTO, RecipeDTO } from "@/lib/types";

/** Mini brief for a recipe: size, footage (upload or library), optional twist. Creates the project and goes to the editor. */
export function RemixRecipeDialog({ recipe, open, onClose }: { recipe: RecipeDTO; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [size, setSize] = React.useState(recipe.sizes[0] ?? "9:16");
  const [files, setFiles] = React.useState<File[]>([]);
  const [picked, setPicked] = React.useState<AssetDTO[]>([]);
  const [twist, setTwist] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const addFiles = (fs: File[]) => setFiles((cur) => [...cur, ...fs]);
  const hasFootage = files.length + picked.length > 0;

  async function go() {
    setLoading(true);
    try {
      const project = await api<ProjectDTO>("/api/projects", { method: "POST", json: { brief: "", aspect: size, recipeSlug: recipe.slug, twist: twist || undefined, assetIds: picked.map((a) => a.id) } });
      if (files.length) {
        toast.info(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}`);
        void uploadFiles(files, { projectId: project.id });
      }
      toast.success("Project created", project.title);
      router.push(`/editor/${project.id}`);
    } catch (e) {
      toast.error("Could not create project", e instanceof Error ? e.message : undefined);
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} title={`Remix “${recipe.title}”`} width="max-w-xl">
        <div className="flex flex-col gap-5">
          <div>
            <Label>Size</Label>
            <div className="mt-1.5 flex gap-1.5">
              {recipe.sizes.map((s) => (
                <Chip key={s} active={size === s} onClick={() => setSize(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Footage</Label>
              <span className="text-[11px] text-muted">Bring: {recipe.bring}</span>
            </div>
            <Dropzone onFiles={addFiles} className="mt-1.5 rounded-xl">
              <div className="rounded-xl border border-dashed border-border p-4">
                {hasFootage ? (
                  <div className="flex flex-wrap gap-1.5">
                    {picked.map((a) => (
                      <span key={a.id} className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-border bg-bg-3 py-1 pl-2.5 pr-1.5 text-xs">
                        <FolderOpen className="h-3 w-3 shrink-0 text-muted" />
                        <span className="truncate">{a.name}</span>
                        <button type="button" onClick={() => setPicked((p) => p.filter((x) => x.id !== a.id))} className="rounded-full p-0.5 text-muted hover:text-fg" aria-label="Remove">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {files.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-border bg-bg-3 py-1 pl-2.5 pr-1.5 text-xs">
                        <Film className="h-3 w-3 shrink-0 text-muted" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-muted">{formatBytes(f.size)}</span>
                        <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="rounded-full p-0.5 text-muted hover:text-fg" aria-label="Remove">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-xs text-muted">Drop clips here, or</div>
                )}
                <div className="mt-3 flex justify-center gap-2">
                  <FilePicker onFiles={addFiles} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-white/5">
                    <Upload className="h-3.5 w-3.5" /> Add files
                  </FilePicker>
                  <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                    <FolderOpen className="h-3.5 w-3.5" /> From library
                  </Button>
                </div>
              </div>
            </Dropzone>
          </div>
          <div>
            <Label>Optional twist</Label>
            <Textarea value={twist} onChange={(e) => setTwist(e.target.value)} placeholder="make it moodier, open with the coffee shot, keep it under 30s…" className="mt-1.5 min-h-[64px]" />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-muted">{hasFootage ? "" : "You can also add footage later in the editor."}</div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="accent" loading={loading} onClick={go}>
                Create project
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
      <AssetPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(a) => setPicked((p) => [...p, ...a.filter((x) => !p.some((y) => y.id === x.id))])} initial={picked.map((p) => p.id)} />
    </>
  );
}

export function RemixButton({ recipe, size = "lg", className, children }: { recipe: RecipeDTO; size?: "sm" | "md" | "lg"; className?: string; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="accent" size={size} className={className} onClick={() => setOpen(true)}>
        {children ?? "Remix with my footage"}
      </Button>
      <RemixRecipeDialog recipe={recipe} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
