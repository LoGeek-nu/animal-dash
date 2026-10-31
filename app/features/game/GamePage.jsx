"use client";

import { useState } from "react";
import { TitleLogo } from "../../components/ui/atoms/TitleLogo.jsx";
import { getRaceId } from "../../domain/race-session.js";
import { useStaffAuth } from "../auth/useStaffAuth.js";
import { StaffLoginNotice } from "../auth/StaffLoginNotice.jsx";
import { useRaceSession } from "../race-session/useRaceSession.js";
import { GameControlContext } from "./components/GameControlBadge.jsx";
import { GamePhaseRenderer } from "./GamePhaseRenderer.jsx";
import { useCountdownSound } from "./useCountdownSound.js";
import { MUSIC, useMusic } from "./useMusic.js";

export function GamePage() {
  const auth = useStaffAuth();
  const role = auth === null ? null : auth.authenticated ? "game" : "viewer";
  const { session, actions, ready, syncStatus, canControl, raceFeed, muted } = useRaceSession(role);
  useCountdownSound(session.phase, session.countdownEndsAt, muted);
  // The race song fades out at the last goal, so the results song starts after a short pause instead of on top of it.
  const [finishedRaceId, setFinishedRaceId] = useState(null);
  const phase = ready ? session.phase : null;
  useMusic(MUSIC.lobby, phase === "ATTRACT" || phase === "WAITING", muted);
  useMusic(MUSIC.race, phase === "RACING" && finishedRaceId !== getRaceId(session), muted);
  useMusic(MUSIC.results, phase === "RESULTS", muted);
  return (
    <GameControlContext.Provider value={{ canControl, syncStatus }}>
      {ready ? <GamePhaseRenderer session={session} onFinished={actions.finishRace} onInput={actions.reportInput}
        canControl={canControl} raceFeed={raceFeed} connected={syncStatus === "open"} muted={muted} onAllFinished={setFinishedRaceId} />
        : <main className="game-stage"><div className="game-logo"><TitleLogo /></div><p role="status">現在のゲームに接続しています…</p></main>}
      <StaffLoginNotice returnTo="/game" auth={auth} />
    </GameControlContext.Provider>
  );
}
