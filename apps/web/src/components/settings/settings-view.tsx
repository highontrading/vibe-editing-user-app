"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/utils";
import { ASPECT_OPTIONS, LANGUAGES, PLATFORM_OPTIONS } from "@/lib/options";
import type { MeDTO, Preferences } from "@/lib/types";

export function SettingsView({ me, signOut }: { me: MeDTO; signOut: () => Promise<void> }) {
  const router = useRouter();
  const [name, setName] = React.useState(me.name ?? "");
  const [image, setImage] = React.useState(me.image);
  const [prefs, setPrefs] = React.useState<Preferences>({ defaultAspect: "auto", defaultPlatform: "auto", captions: true, music: true, removeFillers: true, language: "auto", ...me.preferences });
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [prefsSaved, setPrefsSaved] = React.useState(true);
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });
  const [pwLoading, setPwLoading] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // autosave preferences (debounced)
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPrefsSaved(false);
    const t = setTimeout(async () => {
      try {
        await api("/api/account", { method: "PATCH", json: { preferences: prefs } });
        setPrefsSaved(true);
        toast.success("Preferences saved");
      } catch (e) {
        toast.error("Could not save preferences", e instanceof Error ? e.message : undefined);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [prefs]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await api("/api/account", { method: "PATCH", json: { name: name.trim() || undefined } });
      toast.success("Profile saved");
      router.refresh();
    } catch (e) {
      toast.error("Could not save profile", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingProfile(false);
    }
  }
  async function uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/account/avatar", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload failed");
      const { image } = (await res.json()) as { image: string };
      setImage(image);
      toast.success("Avatar updated");
      router.refresh();
    } catch (e) {
      toast.error("Avatar upload failed", e instanceof Error ? e.message : undefined);
    }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords do not match");
    setPwLoading(true);
    try {
      await api("/api/account/password", { method: "POST", json: { current: pw.current || undefined, next: pw.next } });
      toast.success(me.hasPassword ? "Password changed" : "Password set");
      setPw({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error("Could not change password", err instanceof Error ? err.message : undefined);
    } finally {
      setPwLoading(false);
    }
  }
  async function deleteAccount() {
    setDeleting(true);
    try {
      await api("/api/account", { method: "DELETE", json: { confirm } });
      toast.success("Account deleted");
      await signOut();
    } catch (e) {
      toast.error("Could not delete account", e instanceof Error ? e.message : undefined);
      setDeleting(false);
    }
  }

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-6 border-b border-border/60 py-3 last:border-0">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[11px] text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );

  return (
    <div className="px-8 py-10 md:px-12">
      <PageHeader
        eyebrow="Settings"
        title="Account"
        description={me.email}
        actions={
          <form action={signOut}>
            <Button type="submit" variant="outline">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </form>
        }
      />
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => fileRef.current?.click()} className="group relative h-16 w-16 overflow-hidden rounded-full border border-border bg-bg-3" aria-label="Change avatar">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-2xl uppercase text-accent-2">{(name || me.email).slice(0, 1)}</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              <div className="flex-1">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" placeholder="Your name" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted">Used in the greeting and on end cards when no brand handle is set.</div>
              <Button size="sm" variant="primary" onClick={saveProfile} loading={savingProfile} disabled={name.trim() === (me.name ?? "")}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Editing preferences</CardTitle>
            <span className="text-[11px] text-muted">{prefsSaved ? "Saved" : "Saving…"}</span>
          </CardHeader>
          <CardContent>
            <Row label="Default aspect ratio" hint="Used when a brief doesn't say.">
              <Select value={prefs.defaultAspect ?? "auto"} onChange={(e) => setPrefs({ ...prefs, defaultAspect: e.target.value as Preferences["defaultAspect"] })} className="h-8 text-xs">
                {ASPECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Row>
            <Row label="Default platform">
              <Select value={prefs.defaultPlatform ?? "auto"} onChange={(e) => setPrefs({ ...prefs, defaultPlatform: e.target.value })} className="h-8 text-xs">
                <option value="auto">Auto</option>
                {PLATFORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Row>
            <Row label="Captions always on" hint="Word-by-word captions on every build.">
              <Switch checked={prefs.captions !== false} onChange={(v) => setPrefs({ ...prefs, captions: v })} label="Captions" />
            </Row>
            <Row label="Add background music" hint="Off means the editor never adds music unless asked.">
              <Switch checked={prefs.music !== false} onChange={(v) => setPrefs({ ...prefs, music: v })} label="Music" />
            </Row>
            <Row label="Remove filler words" hint="Cuts “um”, “uh”, “like” with natural breathing room.">
              <Switch checked={prefs.removeFillers !== false} onChange={(v) => setPrefs({ ...prefs, removeFillers: v })} label="Remove fillers" />
            </Row>
            <Row label="Spoken language" hint="For transcription and captions.">
              <Select value={prefs.language ?? "auto"} onChange={(e) => setPrefs({ ...prefs, language: e.target.value })} className="h-8 text-xs">
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{me.hasPassword ? "Change password" : "Set a password"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-3">
              {me.hasPassword && (
                <div className="flex flex-col gap-1.5">
                  <Label>Current</Label>
                  <Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>New password</Label>
                <Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={8} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Confirm</Label>
                <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <Button type="submit" size="sm" variant="primary" loading={pwLoading} disabled={!pw.next}>
                  Update password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-danger/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-danger">
              <ShieldAlert className="h-4 w-4" /> Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted">Deleting your account removes all projects, footage, exports and brand assets from storage. There is no undo.</div>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete your account" width="max-w-sm">
        <p className="text-sm text-muted">
          This permanently deletes everything. Type <span className="font-mono text-fg">{me.email}</span> to confirm.
        </p>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-3" placeholder={me.email} autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={confirm.trim().toLowerCase() !== me.email.toLowerCase()} loading={deleting} onClick={deleteAccount}>
            Delete everything
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
