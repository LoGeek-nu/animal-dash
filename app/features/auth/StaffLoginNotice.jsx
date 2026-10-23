"use client";

import { loginPath } from "./useStaffAuth.js";

// Spectators keep watching; staff use the same login link as before.
export function StaffLoginNotice({ returnTo, auth }) {
  if (auth?.authenticated !== false) return null;

  return (
    <div className="staff-login-notice" role="alert">
      <span>観戦モードです。操作するにはスタッフログインしてください。</span>
      <a href={loginPath(returnTo)}>ログインする</a>
    </div>
  );
}
