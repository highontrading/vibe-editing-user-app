/**
 * PUBLIC API (keep stable; other packages depend on it):
 *   - COMPOSITION_ID: the Remotion composition id that renders an EditScript
 *   - EditScriptComposition: React component <EditScriptComposition script={} />
 *       The `script.assets[*].url` values must be fetchable URLs at preview/render time.
 *   - getCompositionMetadata(script): { width, height, fps, durationInFrames }
 *   - CAPTION_PREVIEW_SCRIPT(styleId): small script used by the caption style gallery
 */
export { COMPOSITION_ID, EditScriptComposition, getCompositionMetadata } from "./EditScriptComposition.js";
export type { EditScriptCompositionProps } from "./EditScriptComposition.js";
export { captionPreviewScript } from "./previews.js";
