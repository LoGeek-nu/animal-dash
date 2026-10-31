import assert from "node:assert/strict";
import test from "node:test";
import {
  clearedRoleCookies,
  GAME_COOKIE,
  gameCookie,
  isGameRequest,
  isSameOrigin,
  isStaffRequest,
  loginAttemptAllowed,
  loginRequired,
  passcodeRole,
  STAFF_COOKIE,
  staffCookie,
} from "../worker/auth.js";
import { authRetryDelay, fetchStaffAuth, loginPath, logout, safeNextPath } from "../app/features/auth/useStaffAuth.js";

const env = { STAFF_PASSCODE: "kuma-dash-2026", GAME_PASSCODE: "usagi-run-2026" };
const request = (headers = {}, url = "https://animaldash.logeek.tech/api/sync") => new Request(url, { headers });
const cookieValue = (setCookie) => setCookie.split(";")[0];

test("the issued cookie authenticates later requests without containing the passcode", async () => {
  const setCookie = await staffCookie(request(), env);

  assert.match(setCookie, new RegExp(`^${STAFF_COOKIE}=[0-9a-f]{64}; Path=/; HttpOnly; SameSite=Strict; Max-Age=\\d+; Secure$`));
  assert.doesNotMatch(setCookie, /kuma-dash-2026/);
  assert.equal(await isStaffRequest(request({ Cookie: `other=1; ${cookieValue(setCookie)}` }), env), true);
});

test("missing, forged, or stale cookies are refused", async () => {
  const setCookie = await staffCookie(request(), env);

  assert.equal(await isStaffRequest(request(), env), false);
  assert.equal(await isStaffRequest(request({ Cookie: `${STAFF_COOKIE}=${"0".repeat(64)}` }), env), false);
  assert.equal(await isStaffRequest(request({ Cookie: cookieValue(setCookie) }), { STAFF_PASSCODE: "changed" }), false);
  const cleared = clearedRoleCookies(request());
  assert.deepEqual(cleared.map((cookie) => cookie.split("=")[0]), [STAFF_COOKIE, GAME_COOKIE]);
  for (const cookie of cleared) assert.match(cookie, /Max-Age=0/);
});

test("the admin and game passcodes each open only their own screen", async () => {
  assert.equal(passcodeRole("kuma-dash-2026", env), "staff");
  assert.equal(passcodeRole("usagi-run-2026", env), "game");
  const staff = request({ Cookie: cookieValue(await staffCookie(request(), env)) });
  const game = request({ Cookie: cookieValue(await gameCookie(request(), env)) });
  assert.match(await gameCookie(request(), env), new RegExp(`^${GAME_COOKIE}=[0-9a-f]{64};`));
  assert.deepEqual([await isStaffRequest(staff, env), await isGameRequest(staff, env)], [true, false]);
  assert.deepEqual([await isStaffRequest(game, env), await isGameRequest(game, env)], [false, true]);
  // A game cookie copied into the staff cookie's name does not open the admin screen, and vice versa.
  const swapped = request({ Cookie: `${STAFF_COOKIE}=${cookieValue(await gameCookie(request(), env)).split("=")[1]}` });
  assert.equal(await isStaffRequest(swapped, env), false);
  // Without GAME_PASSCODE nobody can control the game, not even staff.
  assert.equal(await isGameRequest(staff, { STAFF_PASSCODE: env.STAFF_PASSCODE }), false);
});

test("without a configured passcode nothing is accepted outside vite dev", async () => {
  assert.equal(loginRequired({}), true);
  assert.equal(loginRequired(env), true);
  assert.equal(await isStaffRequest(request({ Cookie: `${STAFF_COOKIE}=x` }), {}), false);
  assert.equal(await isGameRequest(request({ Cookie: `${GAME_COOKIE}=x` }), {}), false);
  assert.equal(passcodeRole("", {}), null);
  assert.equal(passcodeRole("kuma-dash-2027", env), null);
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

test("public sync accepts only viewer upgrades; admin and game sockets each require their own cookie", async () => {
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
  const game = cookieValue(await gameCookie(request(), env));
  // The admin passcode only watches the game; the game passcode cannot open the admin socket.
  assert.deepEqual([(await sync("admin", { Cookie: cookie })).status, (await sync("game", { Cookie: cookie })).status], [200, 401]);
  assert.deepEqual([(await sync("admin", { Cookie: game })).status, (await sync("game", { Cookie: game })).status], [401, 200]);
  assert.equal((await sync("viewer", { Origin: "https://evil.test" })).status, 403);
  assert.equal((await sync("owner")).status, 400);
  assert.deepEqual(forwarded, ["viewer", "viewer", "admin", "game"]);
});

test("a failed auth check is reported as unknown rather than signed out, and is retried with backoff", async () => {
  const reply = (status, body = {}) => async () => new Response(JSON.stringify(body), { status });
  assert.deepEqual(await fetchStaffAuth(reply(200, { authenticated: true, loginRequired: true })), { authenticated: true, game: false, loginRequired: true });
  assert.deepEqual(await fetchStaffAuth(reply(200, { authenticated: false, game: true, loginRequired: false })), { authenticated: false, game: true, loginRequired: false });
  await assert.rejects(fetchStaffAuth(reply(503)));
  await assert.rejects(fetchStaffAuth(async () => { throw new TypeError("Failed to fetch"); }));
  assert.deepEqual([0, 1, 2, 3, 4, 50].map(authRetryDelay), [1000, 2000, 5000, 10_000, 10_000, 10_000]);
});
