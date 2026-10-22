// Generated characters race against the built-ins (stats 6–10, totals 21–24), so AI output is
// fitted to the same scale before it is saved. The model cannot be trusted to hit the total exactly.
export const GENERATED_STAT_MIN = 4;
export const GENERATED_STAT_MAX = 10;
export const GENERATED_STAT_TOTAL = 22;

const KEYS = ["speed", "acceleration", "stamina"];
const clamp = (value) => Math.min(GENERATED_STAT_MAX, Math.max(GENERATED_STAT_MIN, value));

// image-poc named the last two stats jump/power before its prompt matched the game; accept both until it is redeployed.
export function readGeneratedStats(stats) {
  const raw = { speed: stats?.speed, acceleration: stats?.acceleration ?? stats?.jump, stamina: stats?.stamina ?? stats?.power };
  if (!KEYS.every((key) => Number.isFinite(raw[key]) && raw[key] > 0)) return null;
  return fitGeneratedStats(raw);
}

// Scale to the total keeping the AI's proportions, then settle rounding on the stat that drifted furthest.
export function fitGeneratedStats(raw) {
  const sum = KEYS.reduce((total, key) => total + raw[key], 0);
  const exact = Object.fromEntries(KEYS.map((key) => [key, clamp(raw[key] * GENERATED_STAT_TOTAL / sum)]));
  const fitted = Object.fromEntries(KEYS.map((key) => [key, Math.round(exact[key])]));
  let remaining = GENERATED_STAT_TOTAL - KEYS.reduce((total, key) => total + fitted[key], 0);
  while (remaining !== 0) {
    const step = Math.sign(remaining);
    const [key] = KEYS
      .filter((candidate) => step > 0 ? fitted[candidate] < GENERATED_STAT_MAX : fitted[candidate] > GENERATED_STAT_MIN)
      .sort((a, b) => step * ((exact[b] - fitted[b]) - (exact[a] - fitted[a])));
    fitted[key] += step;
    remaining -= step;
  }
  return fitted;
}
