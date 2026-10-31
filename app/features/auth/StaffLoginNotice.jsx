"use client";

import { loginPath } from "./useStaffAuth.js";

// Spectators keep watching; the game PC signs in with the game passcode to take the controls.
export function StaffLoginNotice({ returnTo, auth }) {
  if (auth?.game !== false) return null;

  return (
    <div className="staff-login-notice" role="alert">
      <span>観戦モードです。この画面で操作するには、ゲーム用の合言葉でログインしてください。</span>
      <a href={loginPath(returnTo)}>ログインする</a>
    </div>
  );
}
