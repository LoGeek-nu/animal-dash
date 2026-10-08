// Staff authentication: a shared passcode (STAFF_PASSCODE secret) exchanged at /api/auth
// for an HttpOnly cookie. Cookies ride along on fetch and WebSocket handshakes automatically,
// so screens need no token plumbing.
export const STAFF_COOKIE = "animal_dash_staff";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;
const TOKEN_LABEL = "animal-dash-staff-v1";

// Local `npm run dev` without a passcode stays open so the setup guide's "no .dev.vars needed"
// still holds. Built bundles (production) refuse everything until the secret is set.
function authDisabled(env) {
  return !env.STAFF_PASSCODE && import.meta.env?.DEV === true;
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

// The cookie holds an HMAC of the passcode, never the passcode itself.
async function staffToken(passcode) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(passcode), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(TOKEN_LABEL));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCookie(request, name) {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export async function isStaffRequest(request, env) {
  if (authDisabled(env)) return true;
  if (!env.STAFF_PASSCODE) return false;
  return constantTimeEqual(readCookie(request, STAFF_COOKIE), await staffToken(env.STAFF_PASSCODE));
}

export function passcodeMatches(input, env) {
  return Boolean(env.STAFF_PASSCODE) && constantTimeEqual(input, env.STAFF_PASSCODE);
}

function cookieAttributes(request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function staffCookie(request, env) {
  return `${STAFF_COOKIE}=${await staffToken(env.STAFF_PASSCODE)}; ${cookieAttributes(request, COOKIE_MAX_AGE)}`;
}

export function clearedStaffCookie(request) {
  return `${STAFF_COOKIE}=; ${cookieAttributes(request, 0)}`;
}

// Browsers always send Origin on WebSocket handshakes; reject ones started by other sites.
export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === null || origin === new URL(request.url).origin;
}

export function unauthorizedResponse() {
  return Response.json({ error: "unauthorized", detail: "スタッフログインが必要です。/login で合言葉を入力してください。", retryable: false }, { status: 401 });
}
