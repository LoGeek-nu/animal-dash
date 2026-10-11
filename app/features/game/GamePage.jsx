"use client";

import { StaffLoginNotice } from "../auth/StaffLoginNotice.jsx";
import { useRaceSession } from "../race-session/useRaceSession.js";
import { GamePhaseRenderer } from "./GamePhaseRenderer.jsx";

export function GamePage() {
  const { session, actions } = useRaceSession("game");
  return (
    <>
      <GamePhaseRenderer session={session} onFinished={actions.finishRace} onInput={actions.reportInput} />
      <StaffLoginNotice returnTo="/game" />
    </>
  );
}
