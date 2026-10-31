// Staff authentication: shared passcodes exchanged at /api/auth for HttpOnly cookies. Cookies ride
// along on fetch and WebSocket handshakes automatically, so screens need no token plumbing.
// Two roles with separate passcodes, so staff who open /game just to watch cannot take its controls:
// - staff (STAFF_PASSCODE): the admin screen and staff APIs
// - game (GAME_PASSCODE): controlling the game screen
export const STAFF_COOKIE = "animal_dash_staff";
export const GAME_COOKIE = "animal_dash_game";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;
const ROLES = {
  staff: { cookie: STAFF_COOKIE, secret: "STAFF_PASSCODE", label: "animal-dash-staff-v1" },
  game: { cookie: GAME_COOKIE, secret: "GAME_PASSCODE", label: "animal-dash-game-v1" },
};

// Local `npm run dev` without passcodes stays open so the setup guide's "no .dev.vars needed"
// still holds. Built bundles (production) refuse everything until the secrets are set.
export function loginRequired(env) {
  return Boolean(env.STAFF_PASSCODE || env.GAME_PASSCODE) || import.meta.env?.DEV !== true;
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

// The cookie holds an HMAC of the passcode, never the passcode itself.
async function roleToken(passcode, label) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(passcode), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(label));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCookie(request, name) {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function hasRole(request, env, role) {
  if (!loginRequired(env)) return true;
  const { cookie, secret, label } = ROLES[role];
  if (!env[secret]) return false;
  return constantTimeEqual(readCookie(request, cookie), await roleToken(env[secret], label));
}

export function isStaffRequest(request, env) {
  return hasRole(request, env, "staff");
}

export function isGameRequest(request, env) {
  return hasRole(request, env, "game");
}

// "staff", "game" or null. The passcodes must differ; a shared one would only ever sign in as staff.
export function passcodeRole(input, env) {
  return Object.keys(ROLES).find((role) => {
    const secret = env[ROLES[role].secret];
    return Boolean(secret) && constantTimeEqual(input, secret);
  }) ?? null;
}

function cookieAttributes(request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function roleCookie(request, env, role) {
  const { cookie, secret, label } = ROLES[role];
  return `${cookie}=${await roleToken(env[secret], label)}; ${cookieAttributes(request, COOKIE_MAX_AGE)}`;
}

export function staffCookie(request, env) {
  return roleCookie(request, env, "staff");
}

export function gameCookie(request, env) {
  return roleCookie(request, env, "game");
}

// Logging out signs the device out of both roles.
export function clearedRoleCookies(request) {
  return Object.values(ROLES).map(({ cookie }) => `${cookie}=; ${cookieAttributes(request, 0)}`);
}

// Browsers always send Origin on WebSocket handshakes; reject ones started by other sites.
export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === null || origin === new URL(request.url).origin;
}

// Slows down passcode guessing: AUTH_LIMITER allows a set number of logins per IP per minute.
// Unlimited when the binding is absent.
export async function loginAttemptAllowed(request, env) {
  if (!env.AUTH_LIMITER) return true;
  const { success } = await env.AUTH_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
  return success;
}

export function unauthorizedResponse() {
  return Response.json({ error: "unauthorized", detail: "スタッフログインが必要です。/login で合言葉を入力してください。", retryable: false }, { status: 401 });
}
