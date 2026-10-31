import { env } from "cloudflare:workers";
import { clearedStaffCookie, isStaffRequest, loginAttemptAllowed, loginRequired, passcodeMatches, revokeStaffSession, staffCookie } from "../../../worker/auth.js";

export async function GET(request) {
  return Response.json(
    { authenticated: await isStaffRequest(request, env), loginRequired: loginRequired(env) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request) {
  if (!(await loginAttemptAllowed(request, env))) {
    return Response.json({ error: "rate_limited", detail: "ログインの試行が多すぎます。1分ほど待ってから、もう一度試してください。" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  let passcode;
  try {
    ({ passcode } = await request.json());
  } catch {
    return Response.json({ error: "invalid_body", detail: "expected JSON with a passcode field" }, { status: 400 });
  }
  if (!passcodeMatches(passcode, env)) {
    return Response.json({ error: "wrong_passcode", detail: "合言葉が違います" }, { status: 401 });
  }
  try {
    return new Response(null, { status: 204, headers: { "Set-Cookie": await staffCookie(request, env) } });
  } catch (error) {
    console.error("staff_session_create_failed", error);
    return Response.json({ error: "session_unavailable", detail: "ログイン状態を保存できませんでした。", retryable: true }, { status: 503 });
  }
}

export async function DELETE(request) {
  const headers = { "Set-Cookie": clearedStaffCookie(request) };
  try {
    await revokeStaffSession(request, env);
    return new Response(null, { status: 204, headers });
  } catch (error) {
    console.error("staff_session_revoke_failed", error);
    return Response.json({ error: "session_revoke_failed", detail: "ログアウトを完了できませんでした。もう一度お試しください。", retryable: true }, { status: 503, headers });
  }
}
