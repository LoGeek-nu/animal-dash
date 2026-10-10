/* global WebSocketPair, WebSocketRequestResponsePair -- Workers runtime globals */
import { generatedCharacterExists } from "../app/api/characters/character-store.js";
import { characters } from "../app/domain/characters.js";
import { createInitialSession, createRaceId } from "../app/domain/race-session.js";
import { validSession } from "../app/features/race-session/race-session-validator.js";
import { COUNTDOWN_DURATION, RESULTS_DURATION } from "../app/features/race-session/constants.js";
import { resolveCharacter, saveRace } from "./data-store.js";
import { raceRecordFromSession } from "./race-record.js";
import { replayRace } from "./race-authority.js";

const BUILT_IN_IDS = new Set(characters.map((character) => character.id));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function acceptableSession(session, bucket) {
  if (!validSession(session, (id) => typeof id === "string")) return false;
  const ids = session.lanes.filter(Boolean).map((lane) => lane.characterId);
  if (new Set(ids).size !== ids.length) return false;
  const generated = ids.filter((id) => !BUILT_IN_IDS.has(id));
  return !generated.length || Boolean(bucket && (await Promise.all(generated.map((id) => generatedCharacterExists(bucket, id)))).every(Boolean));
}

export class RaceSessionRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.now = () => Date.now();
    this.work = Promise.resolve();
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async session() {
    const stored = await this.ctx.storage.get("session");
    if (validSession(stored, (id) => typeof id === "string")) return stored;
    // Recover legacy poisoned counters rather than reflecting them to clients.
    const initial = { ...createInitialSession(), sequence: 1, lastSync: this.now() };
    await this.ctx.storage.put("session", initial);
    await this.ctx.storage.delete("activeRace");
    return initial;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/characters-changed") {
      this.broadcast({ type: "characters-changed" });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/race-save-status") {
      return Response.json({ failed: Boolean(await this.ctx.storage.get(`failed:${url.searchParams.get("raceId")}`)) });
    }
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const role = url.searchParams.get("role") ?? "viewer";
    if (!["admin", "game", "viewer"].includes(role)) return new Response("Invalid role", { status: 400 });
    const { 0: client, 1: server } = new WebSocketPair();
    server.serializeAttachment({ role, id: crypto.randomUUID() });
    this.ctx.acceptWebSocket(server);
    await this.runExclusive(async () => {
      const current = await this.session();
      if (role === "game" && !this.reporter(await this.ctx.storage.get("gameOwner"))) {
        await this.ctx.storage.put("gameOwner", server.deserializeAttachment().id);
      }
      const race = await this.ctx.storage.get("activeRace");
      if (race && !this.reporter(race.reporterId)) {
        race.reporterId = this.reporter(await this.ctx.storage.get("gameOwner"))?.deserializeAttachment().id ?? this.gameSocket()?.deserializeAttachment().id ?? null;
        await this.ctx.storage.put("activeRace", race);
      }
      server.send(JSON.stringify({ type: "session", session: current }));
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  gameSocket() { return this.ctx.getWebSockets().find((ws) => ws.readyState === 1 && ws.deserializeAttachment()?.role === "game"); }
  reporter(id) { return this.ctx.getWebSockets().find((ws) => ws.readyState === 1 && ws.deserializeAttachment()?.id === id); }
  runExclusive(callback) {
    const work = this.work.then(callback);
    this.work = work.catch(() => {});
    return work;
  }
  webSocketMessage(socket, raw) {
    if (typeof raw !== "string" || raw.length > 16_384) return;
    const attachment = socket.deserializeAttachment() ?? {};
    const window = Math.floor(this.now() / 1000);
    attachment.messages = attachment.window === window ? (attachment.messages ?? 0) + 1 : 1;
    attachment.window = window;
    if (attachment.messages > 120) { socket.close(1008, "Too many messages"); return; }
    socket.serializeAttachment?.(attachment);
    return this.runExclusive(() => this.acceptMessage(socket, raw));
  }
  reject(socket, error, current) {
    socket.send(JSON.stringify({ type: "error", error }));
    socket.send(JSON.stringify({ type: "session", session: current }));
  }

  async acceptMessage(socket, raw) {
    if (typeof raw !== "string" || raw.length > 16_384) return;
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    const actor = socket.deserializeAttachment() ?? {};
    const current = await this.session();
    if (message.type === "input") {
      const race = await this.ctx.storage.get("activeRace");
      if (actor.role !== "game" || !race || actor.id !== race.reporterId || message.raceId !== race.raceId
        || !["COUNTDOWN", "RACING"].includes(current.phase) || this.now() < race.startedAt
        || !Number.isInteger(message.buttons) || message.buttons < 0 || message.buttons > 255) return;
      const at = Math.min(60_000, this.now() - race.startedAt);
      const last = race.inputs.at(-1);
      if (race.inputs.length >= 2048 || (last && at === last.at && message.buttons === last.buttons)) return;
      if (last && message.buttons === last.buttons) return;
      race.inputs.push({ at, buttons: message.buttons });
      await this.ctx.storage.put("activeRace", race);
      return;
    }
    if (message.type !== "session" || !await acceptableSession(message.session, this.env.CHARACTERS)) return;
    const candidate = message.session;
    // Accept only the next revision, never an arbitrary jump in the global counter.
    if (candidate.sequence !== current.sequence + 1) return this.reject(socket, "stale_sequence", current);
    const now = this.now();
    let next = { ...candidate, lastSync: now };
    let race = await this.ctx.storage.get("activeRace");
    if (candidate.phase === "RESULTS") {
      if (current.phase === "RESULTS") {
        let unchanged = false;
        try { unchanged = same(raceRecordFromSession(candidate), raceRecordFromSession(current)) && same(candidate.results, current.results); } catch { /* reject malformed results */ }
        if (!["admin", "game"].includes(actor.role) || !unchanged) {
          return this.reject(socket, "results_finalized", current);
        }
        next = { ...current, sequence: candidate.sequence, lastSync: now };
      } else {
        if (!race || candidate.raceId !== race.raceId || !same(candidate.lanes, race.lanes)
          || candidate.courseSeed !== race.courseSeed) return this.reject(socket, "race_not_started", current);
        const forced = candidate.resultsForced === true && actor.role === "admin";
        if (!forced && (current.phase !== "RACING" || actor.role !== "game" || actor.id !== race.reporterId)) {
          return this.reject(socket, "not_race_reporter", current);
        }
        if (forced && !["COUNTDOWN", "RACING"].includes(current.phase)) return this.reject(socket, "invalid_transition", current);
        const completed = forced ? null : replayRace(race, now);
        if (!forced && !completed) { socket.send(JSON.stringify({ type: "race-pending" })); return; }
        const beforeStart = forced && current.phase === "COUNTDOWN";
        next = { ...current, sequence: candidate.sequence, phase: "RESULTS", lastSync: now,
          raceStartedAt: beforeStart ? null : race.startedAt,
          raceCompletedAt: beforeStart ? null : forced ? now : completed.completedAt,
          resultsForced: forced, countdownEndsAt: null, resultsEndsAt: now + RESULTS_DURATION,
          results: forced ? race.lanes.flatMap((lane, index) => lane ? [{ ...lane, lane: index + 1, rank: index + 1, finishMs: null }] : []) : completed.results };
      }
    } else if (candidate.phase === "RACING") {
      if (current.phase !== "COUNTDOWN" || !race || candidate.raceId !== race.raceId || now < race.startedAt
        || !["admin", "game"].includes(actor.role)) return this.reject(socket, "invalid_transition", current);
      next = { ...current, sequence: candidate.sequence, lastSync: now, phase: "RACING", countdownEndsAt: null, raceStartedAt: race.startedAt };
    } else {
      // Game displays can finish their result timer, but cannot register or abort races.
      const autoReset = actor.role === "game" && current.phase === "RESULTS" && now >= current.resultsEndsAt && candidate.phase === "ATTRACT";
      if (actor.role !== "admin" && !autoReset) return this.reject(socket, "admin_required", current);
      if (!["WAITING", "ATTRACT", "COUNTDOWN"].includes(candidate.phase)) return this.reject(socket, "invalid_transition", current);
      if (candidate.phase === "COUNTDOWN") {
        if (!["WAITING", "ATTRACT"].includes(current.phase) || !candidate.lanes.some(Boolean)) return this.reject(socket, "invalid_transition", current);
        const reporter = this.reporter(await this.ctx.storage.get("gameOwner")) ?? this.gameSocket();
        if (!reporter) return this.reject(socket, "game_not_connected", current);
        const raceId = createRaceId();
        const startedAt = now + COUNTDOWN_DURATION;
        const snapshots = await Promise.all(candidate.lanes.map((lane) => lane ? resolveCharacter(this.env.DB, this.env.CHARACTERS, lane.characterId) : null));
        race = { raceId, startedAt, lanes: candidate.lanes, characters: snapshots, courseSeed: candidate.courseSeed,
          reporterId: reporter.deserializeAttachment().id, inputs: [] };
        next = { ...next, raceId, countdownEndsAt: startedAt, raceStartedAt: null, raceCompletedAt: null, results: [], resultsForced: false };
      } else {
        next = { ...next, raceId: null, raceStartedAt: null, raceCompletedAt: null, countdownEndsAt: null, resultsEndsAt: null, results: [], resultsForced: false };
        race = null;
      }
    }
    const record = raceRecordFromSession(next);
    const newResult = record && current.phase !== "RESULTS";
    await this.ctx.storage.transaction(async (txn) => {
      await txn.put("session", next);
      if (next.phase === "COUNTDOWN" || next.phase === "RACING") await txn.put("activeRace", race);
      else await txn.delete("activeRace");
      if (newResult) {
        await txn.put(`result:${record.raceId}`, record);
        await txn.setAlarm(now + 5_000);
      }
    });
    // All screens, including the sender, adopt the server's canonical result.
    this.broadcast({ type: "session", session: next });
    if (newResult) await this.flushResults();
  }

  alarm() { return this.runExclusive(() => this.flushResults()); }
  async flushResults() {
    const pending = await this.ctx.storage.list({ prefix: "result:", limit: 100 });
    let retry = false;
    for (const [key, race] of pending) {
      try {
        if (!this.env.DB) throw new Error("D1 DB binding is not configured");
        await saveRace(this.env.DB, this.env.CHARACTERS, race);
        await this.ctx.storage.delete(key);
        this.broadcast({ type: "results-saved", raceId: race.raceId });
      } catch (error) {
        const permanent = error.permanent || /(?:FOREIGN KEY|CHECK|UNIQUE|NOT NULL) constraint failed|SQLITE_CONSTRAINT/.test(error.message);
        console.error("race_save_failed", { raceId: race.raceId, code: error.code, permanent: Boolean(permanent), message: error.message });
        if (permanent) {
          await this.ctx.storage.transaction(async (txn) => {
            await txn.put(`failed:${race.raceId}`, { race, code: error.code ?? "constraint_failed", message: error.message, failedAt: this.now() });
            await txn.delete(key);
          });
          this.broadcast({ type: "results-failed", raceId: race.raceId });
        } else retry = true;
      }
    }
    if (retry) await this.ctx.storage.setAlarm(this.now() + 30_000);
    else if ((await this.ctx.storage.list({ prefix: "result:", limit: 1 })).size) await this.ctx.storage.setAlarm(this.now() + 5_000);
    else await this.ctx.storage.deleteAlarm();
  }
  webSocketClose(socket, code, reason) {
    try { socket.close(code, reason); } catch { /* already closed */ }
    return this.runExclusive(async () => {
      const id = socket.deserializeAttachment()?.id;
      const replacement = this.ctx.getWebSockets().find((ws) => ws !== socket && ws.readyState === 1 && ws.deserializeAttachment()?.role === "game");
      if (await this.ctx.storage.get("gameOwner") === id) await this.ctx.storage.put("gameOwner", replacement?.deserializeAttachment().id ?? null);
      const race = await this.ctx.storage.get("activeRace");
      if (race?.reporterId === id) {
        race.reporterId = replacement?.deserializeAttachment().id ?? null;
        race.inputs.push({ at: Math.min(60_000, Math.max(0, this.now() - race.startedAt)), buttons: 0 });
        await this.ctx.storage.put("activeRace", race);
      }
    });
  }
  broadcast(message) {
    const payload = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) { try { socket.send(payload); } catch { /* closing */ } }
  }
}
