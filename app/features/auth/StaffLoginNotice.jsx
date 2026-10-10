"use client";

import { loginPath, useStaffAuth } from "./useStaffAuth.js";

// Shown on /game when this device has not entered the staff passcode, because syncing is
// refused until it has. (/admin redirects to /login instead.)
export function StaffLoginNotice({ returnTo }) {
  const auth = useStaffAuth();
  if (auth?.authenticated !== false) return null;

  return (
    <div className="staff-login-notice" role="alert">
      <span>この端末はまだスタッフログインしていないため、他の端末と同期されません。</span>
      <a href={loginPath(returnTo)}>ログインする</a>
    </div>
  );
}
