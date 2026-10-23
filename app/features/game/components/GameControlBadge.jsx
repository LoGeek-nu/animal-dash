"use client";

import { createContext, useContext } from "react";
import { ConnectionBadge } from "../../../components/ui/molecules/ConnectionBadge.jsx";

export const GameControlContext = createContext({ canControl: false, syncStatus: "connecting" });

export function GameControlBadge() {
  const { canControl, syncStatus } = useContext(GameControlContext);
  const connected = syncStatus === "open";
  const active = connected && canControl;
  return (
    <>
      <ConnectionBadge label={connected ? "LIVE SYNC" : syncStatus === "offline" ? "通信切断" : "接続中"}
        tone={connected ? "ok" : syncStatus === "offline" ? "offline" : "pending"} />
      <span className={`game-control-badge ${active ? "is-active" : "is-viewer"}`} role="status" aria-live="polite" aria-atomic="true">
        {active && <span aria-hidden="true">✓</span>}
        {active ? "操作可能" : connected ? "観戦中" : "操作不可"}
      </span>
    </>
  );
}
