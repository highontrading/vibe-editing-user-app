/**
 * PUBLIC API (keep stable; other packages depend on it):
 *   - COMPOSITION_ID: the Remotion composition id that renders an EditScript
 *   - EditScriptComposition: React component <EditScriptComposition script={} watermark? />
 *       The `script.assets[*].url` values must be fetchable URLs at preview/render time.
 *       Pass `watermark: true` in inputProps (or put `[watermark]` in script.meta.notes)
 *       to draw the "Made with Vibe" badge.
 *   - getCompositionMetadata(script): { width, height, fps, durationInFrames }
 *   - captionPreviewScript(styleId): small script used by the caption style gallery
 *   - graphicPreviewScript(componentId) / transitionPreviewScript(type): gallery scripts
 */
export { COMPOSITION_ID, EditScriptComposition, getCompositionMetadata, normalizeScript, shouldWatermark } from "./EditScriptComposition";
export type { EditScriptCompositionProps } from "./EditScriptComposition";
export { captionPreviewScript, graphicPreviewScript, transitionPreviewScript, gradientImageUrl, PREVIEW_WORDS } from "./previews";
export { WATERMARK_TOKEN, WATERMARK_LABEL, Watermark } from "./Watermark";
export { groupWords, lineAt, speechActiveAt, LINE_GAP_MS } from "./captions/grouping";
export type { CaptionLine } from "./captions/grouping";
export { captionAnchorY, CAPTION_FONT_FOR_STYLE } from "./captions/Captions";
export { computeSpeechEnvelope, dbToGain, DUCK_DB, DUCK_ATTACK_MS, DUCK_RELEASE_MS } from "./audio/AudioTracks";
export { GRAPHIC_COMPONENTS } from "./graphics/Graphics";
export { FONTS, fontStack, fontStackFor, loadFontStack, ensureFont, fontKeyForFamily } from "./fonts";
export type { FontKey } from "./fonts";
export { COLOR_GRADES, gradeFor } from "./lib/colors";
export { placeClips } from "./video/VideoLayer";
