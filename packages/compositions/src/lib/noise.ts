import { random } from "remotion";

/**
 * Cheap deterministic 1-D value noise (smooth, periodic-free) built from
 * Remotion's seeded `random`, so results are identical in the Player and the
 * renderer and across threads.
 */
export function valueNoise1D(seed: string, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = random(`${seed}:${i}`) * 2 - 1;
  const b = random(`${seed}:${i + 1}`) * 2 - 1;
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}

/** Layered noise in [-1, 1] with a handheld feel: slow drift + faster jitter. */
export function handheldNoise(seed: string, timeSec: number): number {
  return (
    valueNoise1D(seed + "a", timeSec * 1.1) * 0.6 +
    valueNoise1D(seed + "b", timeSec * 3.7) * 0.3 +
    valueNoise1D(seed + "c", timeSec * 11) * 0.1
  );
}

/** Quick hash to a stable 0..1 number (for per-clip variation). */
export function seeded(seed: string, salt = ""): number {
  return random(`${seed}|${salt}`);
}
