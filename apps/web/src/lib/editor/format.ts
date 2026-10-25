/** Time formatting helpers for the editor (client-safe). */
export function fmtTime(ms: number, opts: { frames?: boolean; fps?: number } = {}): string {
  const total = Math.max(0, ms);
  const s = Math.floor(total / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const base = `${m}:${r.toString().padStart(2, "0")}`;
  if (opts.frames) {
    const fps = opts.fps ?? 30;
    const f = Math.floor(((total % 1000) / 1000) * fps);
    return `${base}.${f.toString().padStart(2, "0")}`;
  }
  const tenths = Math.floor((total % 1000) / 100);
  return `${base}.${tenths}`;
}

export function fmtShort(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function fmtDb(db: number): string {
  return `${db > 0 ? "+" : ""}${db.toFixed(0)} dB`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Stable hue for an asset id (used for clip colours). */
export function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function assetColor(id: string, alpha = 1): string {
  return `hsla(${hueFor(id)}, 55%, 45%, ${alpha})`;
}
