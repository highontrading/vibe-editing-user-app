/**
 * PUBLIC API (stable):
 *   runJob(job)        -> executes one job (ingest | analyze | plan | build | edit | render | thumbnail | generate | cleanup)
 *                         and updates the Job row + related rows (Asset/Project/Export/Message).
 *   media              -> MediaProvider implementation for the agent (music, sfx, stock, voice)
 *   resolveScriptAssets(script) -> script with asset URLs refreshed (signed URLs / local routes)
 */
export { runJob } from "./runner.js";
export { media } from "./media-provider.js";
export { resolveScriptAssets } from "./assets.js";
