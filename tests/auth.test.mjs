import assert from "node:assert/strict";
import test from "node:test";
import {
  clearedStaffCookie,
  isSameOrigin,
  isStaffRequest,
  loginRequired,
  passcodeMatches,
  STAFF_COOKIE,
  staffCookie,
} from "../worker/auth.js";
import { loginPath, logout, safeNextPath } from "../app/features/auth/useStaffAuth.js";

const env = { STAFF_PASSCODE: "kuma-dash-2026" };
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
