export { RACE_TIMEOUT } from "../../../domain/race-results.js";
export const MAX_FRAME_DELTA = .04;
export const PAINT_INTERVAL = 32;
// Inputs one race may record. The room enforces it and spectators reject longer histories.
export const MAX_RACE_INPUTS = 2048;

export const JUMP_KEY_MAP = { " ": 0, ArrowUp: 1, w: 2, W: 2, i: 3, I: 3 };
export const BOOST_KEY_MAP = { Shift: 0, Enter: 1, e: 2, E: 2, o: 3, O: 3 };
