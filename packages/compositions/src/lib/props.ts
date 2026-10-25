/**
 * Defensive readers for the untyped `props` records of graphics items and the
 * `params` records of effects. Every reader returns the default when the value
 * is missing or has the wrong shape, so a malformed script never crashes a render.
 */
export type Rec = Record<string, unknown>;

export function str(rec: Rec | undefined, key: string, def: string): string;
export function str(rec: Rec | undefined, key: string): string | undefined;
export function str(rec: Rec | undefined, key: string, def?: string): string | undefined {
  const v = rec?.[key];
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return def;
}

export function num(rec: Rec | undefined, key: string, def: number, lo = -Infinity, hi = Infinity): number {
  const v = rec?.[key];
  let n: number | undefined;
  if (typeof v === "number" && Number.isFinite(v)) n = v;
  else if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) n = Number(v);
  if (n === undefined) return def;
  return Math.min(hi, Math.max(lo, n));
}

export function bool(rec: Rec | undefined, key: string, def: boolean): boolean {
  const v = rec?.[key];
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return def;
}

export function oneOf<T extends string>(rec: Rec | undefined, key: string, options: readonly T[], def: T): T {
  const v = rec?.[key];
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : def;
}

const COLOR_RE = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(.+\)|hsla?\(.+\)|[a-z]+)$/i;

/** Accepts hex/rgb/hsl/named CSS colours; anything else falls back to the default. */
export function color(rec: Rec | undefined, key: string, def: string): string {
  const v = rec?.[key];
  if (typeof v === "string" && COLOR_RE.test(v.trim())) return v.trim();
  return def;
}

export function safeColor(v: string | undefined, def: string): string {
  return v && COLOR_RE.test(v.trim()) ? v.trim() : def;
}

/** Parse a CSS colour into rgb components (best effort; hex and rgb() only). */
export function parseRgb(c: string): { r: number; g: number; b: number } | null {
  const s = c.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((ch) => ch + ch).join("");
    if (h.length >= 6) {
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    }
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  return null;
}

/** Relative luminance 0..1 (used to pick readable text colours on coloured boxes). */
export function luminance(c: string): number {
  const rgb = parseRgb(c);
  if (!rgb) return 0.5;
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

export function withAlpha(c: string, alpha: number): string {
  const rgb = parseRgb(c);
  if (!rgb) return c;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
