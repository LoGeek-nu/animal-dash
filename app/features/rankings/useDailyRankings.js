"use client";

import { useEffect, useSyncExternalStore } from "react";
import { dailyRankings } from "./ranking-client.js";

export function useDailyRankings({ limit = 10, afterRaceId = null } = {}) {
  const snapshot = useSyncExternalStore(dailyRankings.subscribe, dailyRankings.getSnapshot, dailyRankings.getServerSnapshot);
  useEffect(() => dailyRankings.observe(afterRaceId), [afterRaceId]);
  return { ...snapshot, rankings: snapshot.rankings.slice(0, limit), retry: dailyRankings.refresh };
}
