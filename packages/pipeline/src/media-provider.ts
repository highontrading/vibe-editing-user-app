import type { MediaProvider } from "@vibe/agent";
export const media: MediaProvider = {
  async getMusic() { throw new Error("not implemented"); },
  async getSfx() { throw new Error("not implemented"); },
  async searchStock() { return []; },
};
