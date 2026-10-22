"use client";

import { useStaffAuth } from "../auth/useStaffAuth.js";
import { StaffLoginNotice } from "../auth/StaffLoginNotice.jsx";
import { useRaceSession } from "../race-session/useRaceSession.js";
import { GamePhaseRenderer } from "./GamePhaseRenderer.jsx";

export function GamePage() {
  const auth = useStaffAuth();
  const role = auth === null ? null : auth.authenticated ? "game" : "viewer";
  const { session, actions, ready, syncStatus, canControl, raceFeed } = useRaceSession(role);
  return (
    <>
      {ready ? <GamePhaseRenderer session={session} onFinished={actions.finishRace} onInput={actions.reportInput}
        canControl={canControl} raceFeed={raceFeed} connected={syncStatus === "open"} />
        : <main className="game-stage"><div className="game-logo"><strong>アニマルダッシュ！</strong></div><p role="status">現在のゲームに接続しています…</p></main>}
      <StaffLoginNotice returnTo="/game" auth={auth} />
    </>
  );
}
