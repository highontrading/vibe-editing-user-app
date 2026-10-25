import { emptyScript, type CaptionStyleId, type EditScript, CAPTION_STYLES, CaptionSettingsSchema } from "@vibe/edl";

/** A tiny script that shows a caption style on a dark background, for galleries. */
export function captionPreviewScript(style: CaptionStyleId): EditScript {
  const s = emptyScript({ aspect: "9:16" });
  const info = CAPTION_STYLES.find((c) => c.id === style);
  const text = "this is how your captions look".split(" ");
  const words = text.map((w, i) => ({ t: i * 350, d: 330, text: w, emphasis: i === 3 }));
  const cap = s.tracks.find((t) => t.kind === "captions");
  if (cap && cap.kind === "captions") {
    cap.style = style;
    cap.settings = CaptionSettingsSchema.parse({ ...info?.defaults });
    cap.words = words;
  }
  s.output.durationMs = text.length * 350 + 400;
  return s;
}
