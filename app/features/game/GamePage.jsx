"use client";

import { useRaceSession } from "../race-session/useRaceSession.js";
import { GamePhaseRenderer } from "./GamePhaseRenderer.jsx";

export function GamePage() {
  const { session, actions } = useRaceSession();
  return <GamePhaseRenderer session={session} onFinished={actions.finishRace} />;
}
