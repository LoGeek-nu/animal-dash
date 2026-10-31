import assert from "node:assert/strict";
import test from "node:test";
import {
  clearedStaffCookie,
  isSameOrigin,
  isStaffRequest,
  loginAttemptAllowed,
  loginRequired,
  passcodeMatches,
  STAFF_COOKIE,
  staffCookie,
} from "../worker/auth.js";
import { authRetryDelay, fetchStaffAuth, loginPath, logout, safeNextPath } from "../app/features/auth/useStaffAuth.js";

function sessionDb() {
  const sessions = new Map();
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              if (sql.startsWith("DELETE FROM staff_sessions WHERE expires_at <=")) {
                for (const [hash, session] of sessions) if (session.expires_at <= values[0]) sessions.delete(hash);
              } else if (sql.startsWith("INSERT INTO staff_sessions")) {
                sessions.set(values[0], { expires_at: values[2] });
              } else if (sql.startsWith("DELETE FROM staff_sessions WHERE session_hash")) {
                sessions.delete(values[0]);
              }
              return { success: true };
            },
            async first() {
              const session = sessions.get(values[0]);
              return session?.expires_at > values[1] ? { expires_at: session.expires_at } : null;
            },
          };
        },
      };
    },
  };
}

const env = { STAFF_PASSCODE: "kuma-dash-2026", DB: sessionDb() };
const request = (headers = {}, url = "https://animaldash.logeek.tech/api/sync") => new Request(url, { headers });
const cookieValue = (setCookie) => setCookie.split(";")[0];

test("the issued cookie authenticates later requests without containing the passcode", async () => {
  const setCookie = await staffCookie(request(), env);

  assert.match(setCookie, new RegExp(`^${STAFF_COOKIE}=[A-Za-z0-9_-]{43}\\.[0-9a-f]{64}; Path=/; HttpOnly; SameSite=Strict; Max-Age=\\d+; Secure$`));
  assert.doesNotMatch(setCookie, /kuma-dash-2026/);
  assert.equal(await isStaffRequest(request({ Cookie: `other=1; ${cookieValue(setCookie)}` }), env), true);
});

test("missing, forged, or stale cookies are refused", async () => {
  const setCookie = await staffCookie(request(), env);

  assert.equal(await isStaffRequest(request(), env), false);
  assert.equal(await isStaffRequest(request({ Cookie: `${STAFF_COOKIE}=${"0".repeat(64)}` }), env), false);
  assert.equal(await isStaffRequest(request({ Cookie: cookieValue(setCookie) }), { STAFF_PASSCODE: "changed" }), false);
  assert.match(clearedStaffCookie(request()), /Max-Age=0/);
});

test("without a configured passcode nothing is accepted outside vite dev", async () => {
  assert.equal(loginRequired({}), true);
  assert.equal(loginRequired(env), true);
  assert.equal(await isStaffRequest(request({ Cookie: `${STAFF_COOKIE}=x` }), {}), false);
  assert.equal(passcodeMatches("", {}), false);
  assert.equal(passcodeMatches("kuma-dash-2026", env), true);
  assert.equal(passcodeMatches("kuma-dash-2027", env), false);
});

test("cookies are not marked Secure on plain http (local dev over LAN)", async () => {
  assert.doesNotMatch(await staffCookie(request({}, "http://192.168.0.5:3000/api/auth"), env), /Secure/);
});

test("WebSocket handshakes from other sites are rejected", () => {
  assert.equal(isSameOrigin(request({ Origin: "https://animaldash.logeek.tech" })), true);
  assert.equal(isSameOrigin(request({ Origin: "https://evil.example" })), false);
  assert.equal(isSameOrigin(request()), true);
});

test("login only redirects back to paths on this site", () => {
  assert.equal(safeNextPath("/game"), "/game");
  assert.equal(safeNextPath("https://evil.example"), "/admin");
  assert.equal(safeNextPath("//evil.example"), "/admin");
  assert.equal(safeNextPath("/\\evil.example"), "/admin");
  assert.equal(safeNextPath(null), "/admin");
  // The browser drops tabs/newlines when it parses a URL, which would turn these into "//evil.example".
  assert.equal(safeNextPath("/\t/evil.example"), "/admin");
  assert.equal(safeNextPath("/\n/evil.example"), "/admin");
  assert.equal(safeNextPath("/admin?tab=lanes#top"), "/admin?tab=lanes#top");
});

test("signed-out screens are sent to /login with a way back", () => {
  assert.equal(loginPath("/admin"), "/login?next=%2Fadmin");
  assert.equal(safeNextPath(new URLSearchParams(loginPath("/admin").split("?")[1]).get("next")), "/admin");
});

test("logging out clears the cookie on the server and opens the login page", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push([url, init.method]);
    return new Response(null, { status: 204 });
  });
  const assigned = [];
  globalThis.window = { location: { assign: (path) => assigned.push(path) } };
  t.after(() => delete globalThis.window);

  await logout("/admin");

  assert.deepEqual(calls, [["/api/auth", "DELETE"]]);
  assert.deepEqual(assigned, ["/login?next=%2Fadmin"]);
});

test("login attempts are counted per IP, and unlimited where the limiter binding is absent", async () => {
  const keys = [];
  const limiter = { limit: async ({ key }) => ({ success: keys.push(key) <= 1 }) };
  const from = (ip) => request({ "CF-Connecting-IP": ip }, "https://animaldash.logeek.tech/api/auth");

  assert.equal(await loginAttemptAllowed(from("203.0.113.7"), { AUTH_LIMITER: limiter }), true);
  assert.equal(await loginAttemptAllowed(from("203.0.113.7"), { AUTH_LIMITER: limiter }), false);
  assert.deepEqual(keys, ["203.0.113.7", "203.0.113.7"]);
  assert.equal(await loginAttemptAllowed(from("203.0.113.7"), {}), true);
});

test("public sync accepts only viewer upgrades; writing roles require the staff cookie", async () => {
  const { syncResponse } = await import("../worker/sync-access.js");
  const forwarded = [];
  const bindings = { ...env, RACE_SESSION: { getByName: () => ({ fetch: async (request) => {
    forwarded.push(new URL(request.url).searchParams.get("role"));
    return new Response("upgraded");
  } }) } };
  const sync = (role, headers = {}) => syncResponse(new Request(`https://game.test/api/sync${role ? `?role=${role}` : ""}`,
    { headers: { Upgrade: "websocket", ...headers } }), bindings);
  for (const role of ["", "viewer"]) assert.equal((await sync(role)).status, 200);
  for (const role of ["admin", "game"]) assert.equal((await sync(role)).status, 401);
  assert.equal((await sync("game", { Cookie: `${STAFF_COOKIE}=forged` })).status, 401);
  const cookie = cookieValue(await staffCookie(request(), env));
  for (const role of ["admin", "game"]) assert.equal((await sync(role, { Cookie: cookie })).status, 200);
  assert.equal((await sync("viewer", { Origin: "https://evil.test" })).status, 403);
  assert.equal((await sync("owner")).status, 400);
  assert.deepEqual(forwarded, ["viewer", "viewer", "admin", "game"]);
});

test("a failed auth check is reported as unknown rather than signed out, and is retried with backoff", async () => {
  const reply = (status, body = {}) => async () => new Response(JSON.stringify(body), { status });
  assert.deepEqual(await fetchStaffAuth(reply(200, { authenticated: true, loginRequired: true })), { authenticated: true, loginRequired: true });
  assert.deepEqual(await fetchStaffAuth(reply(200, { authenticated: false, loginRequired: false })), { authenticated: false, loginRequired: false });
  await assert.rejects(fetchStaffAuth(reply(503)));
  await assert.rejects(fetchStaffAuth(async () => { throw new TypeError("Failed to fetch"); }));
  assert.deepEqual([0, 1, 2, 3, 4, 50].map(authRetryDelay), [1000, 2000, 5000, 10_000, 10_000, 10_000]);
});
