import { env } from "cloudflare:workers";
import { clearedRoleCookies, isGameRequest, isStaffRequest, loginAttemptAllowed, loginRequired, passcodeRole, roleCookie } from "../../../worker/auth.js";

export async function GET(request) {
  return Response.json(
    // authenticated: the admin screen. game: controlling the game screen.
    { authenticated: await isStaffRequest(request, env), game: await isGameRequest(request, env), loginRequired: loginRequired(env) },
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
  const role = passcodeRole(passcode, env);
  if (!role) {
    return Response.json({ error: "wrong_passcode", detail: "合言葉が違います" }, { status: 401 });
  }
  return Response.json({ role }, { headers: { "Set-Cookie": await roleCookie(request, env, role) } });
}

export function DELETE(request) {
  const headers = new Headers();
  for (const cookie of clearedRoleCookies(request)) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 204, headers });
}
