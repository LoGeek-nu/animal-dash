"use client";

import { useEffect, useState } from "react";

const CHECK_FAILED = Object.freeze({ authenticated: false, loginRequired: true, checkFailed: true });
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10_000];

// Throws when the answer is unknown (network error or a non-2xx reply), so callers can tell it from signed out.
export async function fetchStaffAuth(fetchImpl = fetch) {
  const response = await fetchImpl("/api/auth", { cache: "no-store" });
  if (!response.ok) throw new Error(`auth check failed: ${response.status}`);
  const body = await response.json();
  return { authenticated: body.authenticated === true, loginRequired: body.loginRequired !== false };
}

export function authRetryDelay(attempt) {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
}

// null while checking, then { authenticated, loginRequired }. A failed check acts signed out
// (checkFailed: true) but keeps retrying, so one network blip cannot leave the staff game display a viewer.
export function useStaffAuth() {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer;
    let attempt = 0;
    const check = () => fetchStaffAuth().then(
      (result) => { if (!cancelled) setAuth(result); },
      () => {
        if (cancelled) return;
        setAuth(CHECK_FAILED);
        timer = setTimeout(check, authRetryDelay(attempt++));
      },
    );
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return auth;
}

// Sends signed-out devices to /login. The page keeps rendering while the check runs,
// so server rendering is unchanged; actions taken in that moment are refused server-side anyway.
export function useRequireStaff(returnTo) {
  const auth = useStaffAuth();

  useEffect(() => {
    if (auth?.authenticated === false && !auth.checkFailed) window.location.replace(loginPath(returnTo));
  }, [auth, returnTo]);

  return auth;
}

export function loginPath(returnTo) {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}

export async function logout(returnTo) {
  await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
  window.location.assign(loginPath(returnTo));
}

const SAME_SITE_BASE = "https://same-site.invalid";

// Only same-site paths, so /login?next=https://evil.example cannot redirect away.
// The path is resolved the way the browser will (it drops tabs/newlines and reads "\" as "/"),
// so tricks like "/\t/evil.example" end up on another origin and are refused.
export function safeNextPath(next) {
  if (typeof next !== "string" || !next.startsWith("/")) return "/admin";
  const url = new URL(next, SAME_SITE_BASE);
  return url.origin === SAME_SITE_BASE ? `${url.pathname}${url.search}${url.hash}` : "/admin";
}
