export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureJobRunner } = await import("./lib/jobs");
    await ensureJobRunner();
  }
}
