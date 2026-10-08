"use client";

import { useStaffAuth } from "./useStaffAuth.js";

// Shown on /admin and /game when this device has not entered the staff passcode,
// because syncing and character generation are refused until it has.
export function StaffLoginNotice({ returnTo }) {
  const authenticated = useStaffAuth();
  if (authenticated !== false) return null;

  return (
    <div className="staff-login-notice" role="alert">
      <span>この端末はまだスタッフログインしていないため、他の端末と同期されません。</span>
      <a href={`/login?next=${encodeURIComponent(returnTo)}`}>ログインする</a>
    </div>
  );
}
