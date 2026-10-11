"use client";

import { useState } from "react";
import { Button } from "../../components/ui/atoms/Button.jsx";
import { safeNextPath } from "./useStaffAuth.js";

export function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.detail ?? "ログインに失敗しました。");
        return;
      }
      // Full navigation so the new cookie is used when the screen opens its sync socket.
      window.location.assign(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="staff-login">
      <form className="generate-dialog" onSubmit={submit}>
        <h2>スタッフログイン</h2>
        <p>管理画面・ゲーム画面を同期させるには、この端末で一度だけ合言葉を入力してください。</p>
        <label className="staff-login-field">
          <span>合言葉</span>
          <input
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            required
          />
        </label>
        {error && <p className="staff-login-error" role="alert">{error}</p>}
        <div className="generate-dialog-actions">
          <Button type="submit" disabled={submitting || passcode === ""}>
            {submitting ? "確認中…" : "ログイン"}
          </Button>
        </div>
      </form>
    </main>
  );
}
