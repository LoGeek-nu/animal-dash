"use client";

import { useEffect, useState } from "react";

// null while checking, then true/false. A failed check counts as signed out.
export function useStaffAuth() {
  const [authenticated, setAuthenticated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { authenticated: false })
      .then((body) => { if (!cancelled) setAuthenticated(body.authenticated === true); })
      .catch(() => { if (!cancelled) setAuthenticated(false); });
    return () => {
      cancelled = true;
    };
  }, []);

  return authenticated;
}

// Only same-site paths, so /login?next=https://evil.example cannot redirect away.
export function safeNextPath(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/admin";
}
