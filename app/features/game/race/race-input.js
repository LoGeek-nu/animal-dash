import { getBotInput } from "./bot-controller.js";

// BOT lanes are controlled only by the simulation, including on the game screen.
// Mixing keyboard/gamepad input into a BOT changes its displayed finish but not the server replay.
export function getRaceInput({ lane, laneIndex, runner, now, obstacles, manualInput }) {
  return lane.isBot
    ? getBotInput({ laneIndex, runner, now, obstacles })
    : manualInput;
}
