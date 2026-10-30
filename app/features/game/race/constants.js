export { RACE_TIMEOUT } from "../../../domain/race-results.js";
export const MAX_FRAME_DELTA = .04;
export const PAINT_INTERVAL = 32;
// Let everyone see the finish before the screen moves on to the results.
export const RESULTS_HOLD_MS = 3_000;
// Inputs one race may record. The room enforces it and spectators reject longer histories.
export const MAX_RACE_INPUTS = 2048;
// How far behind server time an input may be stamped with the game screen's own race time.
// Covers venue Wi-Fi jitter; anything older is clamped so a press cannot be moved far into the past.
export const MAX_INPUT_LAG_MS = 2_000;

export const JUMP_KEY_MAP = { " ": 0, ArrowUp: 1, w: 2, W: 2, i: 3, I: 3 };
export const BOOST_KEY_MAP = { Shift: 0, Enter: 1, e: 2, E: 2, o: 3, O: 3 };
