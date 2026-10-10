export const INITIAL_RANKINGS = Object.freeze({ status: "loading", date: null, rankings: [] });

export function japanDate(now = Date.now()) {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validResponse(body, date, raceId) {
  return body?.mock === false && body.date === date && body.timezone === "Asia/Tokyo"
    && body.metric === "finishMs" && body.unit === "milliseconds" && body.botsIncluded === false && body.tiePolicy === "competition"
    && (!raceId || (body.afterRaceId === raceId && typeof body.raceSaved === "boolean"
      && (body.raceFailed === undefined || typeof body.raceFailed === "boolean")))
    && Array.isArray(body.rankings) && body.rankings.length <= 10
    && new Set(body.rankings.map((item) => item?.characterId)).size === body.rankings.length
    && body.rankings.every((item, index) => item && Number.isInteger(item.rank) && item.rank >= 1 && item.rank <= 10
      && Number.isSafeInteger(item.finishMs) && item.finishMs >= 0 && item.finishMs < 60000
      && typeof item.displayName === "string" && item.character?.id === item.characterId
      && typeof item.character.name === "string"
      && (index === 0 || body.rankings[index - 1].finishMs <= item.finishMs));
}

// Public ranking data is shared by the two boards. No fetch or state change runs during SSR.
export function createRankingClient({ fetcher = (...args) => fetch(...args), now = () => Date.now(),
  schedule = (fn, ms) => setTimeout(fn, ms), cancel = (timer) => clearTimeout(timer) } = {}) {
  const listeners = new Set();
  const observers = new Map();
  let state = INITIAL_RANKINGS;
  let revision = 0;
  let request = null;
  let timer = null;
  const activeRace = () => [...observers.values()].reverse().find(Boolean) ?? null;
  const publish = (next) => { state = next; listeners.forEach((listener) => listener()); };

  async function refresh() {
    if (!observers.size) return;
    request?.abort();
    cancel(timer);
    const controller = new AbortController();
    request = controller;
    const token = ++revision;
    const date = japanDate(now());
    const raceId = activeRace();
    const params = new URLSearchParams({ date, limit: "10" });
    if (raceId) params.set("afterRaceId", raceId);
    const timeout = schedule(() => controller.abort(), 10000);
    if (state.status !== "pending" || state.date !== date) publish({ status: "loading", date, rankings: [] });
    try {
      const response = await fetcher(`/api/rankings?${params}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Ranking request failed");
      const body = await response.json();
      if (controller.signal.aborted) throw new Error("Ranking request aborted");
      if (!validResponse(body, date, raceId)) throw new Error("Invalid ranking response");
      if (token !== revision || !observers.size) return;
      publish({ status: body.raceFailed ? "failed" : body.raceSaved === false ? "pending" : "ready", date: body.date,
        rankings: body.raceFailed ? [] : body.rankings });
    } catch {
      if (token !== revision || !observers.size) return;
      publish({ status: "error", date, rankings: [] });
    } finally {
      cancel(timeout);
      if (token === revision && observers.size && state.status !== "failed") {
        timer = schedule(refresh, state.status === "pending" ? 1500 : 30000);
      }
    }
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => INITIAL_RANKINGS,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    refresh,
    observe(raceId = null) {
      const key = Symbol();
      const previous = activeRace();
      observers.set(key, raceId);
      if (observers.size === 1 || activeRace() !== previous) void refresh();
      return () => {
        const previous = activeRace();
        observers.delete(key);
        if (!observers.size) { revision += 1; request?.abort(); cancel(timer); }
        else if (activeRace() !== previous) void refresh();
      };
    },
  };
}

export const dailyRankings = createRankingClient();
