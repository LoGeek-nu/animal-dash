// Staff authentication: a shared passcode is exchanged for an individually
// revocable, signed session cookie. D1 stores only a hash of each session ID.
export const STAFF_COOKIE = "animal_dash_staff";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;
const TOKEN_LABEL = "animal-dash-staff-v1";
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Local `npm run dev` without a passcode stays open so the setup guide's "no .dev.vars needed"
// still holds. Built bundles (production) refuse everything until the secret is set.
export function loginRequired(env) {
  return Boolean(env.STAFF_PASSCODE) || import.meta.env?.DEV !== true;
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function readCookie(request, name) {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function parseStaffToken(request) {
  const value = readCookie(request, STAFF_COOKIE);
  if (typeof value !== "string") return null;
  const separator = value.indexOf(".");
  if (separator < 0) return null;
  const sessionId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!SESSION_ID_PATTERN.test(sessionId) || !/^[0-9a-f]{64}$/.test(signature)) return null;
  return { sessionId, signature };
}

async function signSession(passcode, sessionId) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(passcode), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${TOKEN_LABEL}:${sessionId}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sessionHash(sessionId) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newSessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifiedSessionId(request, env) {
  if (!env.STAFF_PASSCODE || !env.DB) return null;
  const parsed = parseStaffToken(request);
  if (!parsed || !constantTimeEqual(parsed.signature, await signSession(env.STAFF_PASSCODE, parsed.sessionId))) return null;
  const hash = await sessionHash(parsed.sessionId);
  const row = await env.DB.prepare("SELECT expires_at FROM staff_sessions WHERE session_hash = ? AND expires_at > ?")
    .bind(hash, Date.now()).first();
  return row ? parsed.sessionId : null;
}

// Returns the authenticated session ID so the Durable Object can attach it to
// WebSockets and close those sockets when the session is revoked. The sentinel
// is only used by local development when authentication is intentionally off.
export async function staffSessionId(request, env) {
  if (!loginRequired(env)) return "development";
  try {
    return await verifiedSessionId(request, env);
  } catch {
    return null;
  }
}

export async function isStaffRequest(request, env) {
  if (!loginRequired(env)) return true;
  return Boolean(await staffSessionId(request, env));
}

export function passcodeMatches(input, env) {
  return Boolean(env.STAFF_PASSCODE) && constantTimeEqual(input, env.STAFF_PASSCODE);
}

function cookieAttributes(request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function staffCookie(request, env) {
  if (!env.STAFF_PASSCODE || !env.DB) throw new Error("Staff sessions require STAFF_PASSCODE and DB");
  const sessionId = newSessionId();
  const now = Date.now();
  const expiresAt = now + COOKIE_MAX_AGE * 1000;
  const hash = await sessionHash(sessionId);
  await env.DB.prepare("DELETE FROM staff_sessions WHERE expires_at <= ?").bind(now).run();
  await env.DB.prepare("INSERT INTO staff_sessions (session_hash, created_at, expires_at) VALUES (?, ?, ?)")
    .bind(hash, now, expiresAt).run();
  const signature = await signSession(env.STAFF_PASSCODE, sessionId);
  return `${STAFF_COOKIE}=${sessionId}.${signature}; ${cookieAttributes(request, COOKIE_MAX_AGE)}`;
}

export async function revokeStaffSession(request, env) {
  if (!env.STAFF_PASSCODE) return null;
  const parsed = parseStaffToken(request);
  if (!parsed || !constantTimeEqual(parsed.signature, await signSession(env.STAFF_PASSCODE, parsed.sessionId))) return null;
  if (!env.DB) throw new Error("Staff session store is unavailable");
  const hash = await sessionHash(parsed.sessionId);
  await env.DB.prepare("DELETE FROM staff_sessions WHERE session_hash = ?").bind(hash).run();
  return parsed.sessionId;
}

export function clearedStaffCookie(request) {
  return `${STAFF_COOKIE}=; ${cookieAttributes(request, 0)}`;
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
