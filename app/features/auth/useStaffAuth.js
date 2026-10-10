"use client";

import { useEffect, useState } from "react";

const SIGNED_OUT = { authenticated: false, loginRequired: true };

// null while checking, then { authenticated, loginRequired }. A failed check counts as signed out.
export function useStaffAuth() {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : SIGNED_OUT)
      .then((body) => {
        if (!cancelled) setAuth({ authenticated: body.authenticated === true, loginRequired: body.loginRequired !== false });
      })
      .catch(() => { if (!cancelled) setAuth(SIGNED_OUT); });
    return () => {
      cancelled = true;
    };
  }, []);

  return auth;
}

// Sends signed-out devices to /login. The page keeps rendering while the check runs,
// so server rendering is unchanged; actions taken in that moment are refused server-side anyway.
export function useRequireStaff(returnTo) {
  const auth = useStaffAuth();

  useEffect(() => {
    if (auth?.authenticated === false) window.location.replace(loginPath(returnTo));
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
