import { env } from "cloudflare:workers";
import { clearedStaffCookie, isStaffRequest, loginRequired, passcodeMatches, staffCookie } from "../../../worker/auth.js";

export async function GET(request) {
  return Response.json(
    { authenticated: await isStaffRequest(request, env), loginRequired: loginRequired(env) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request) {
  let passcode;
  try {
    ({ passcode } = await request.json());
  } catch {
    return Response.json({ error: "invalid_body", detail: "expected JSON with a passcode field" }, { status: 400 });
  }
  if (!passcodeMatches(passcode, env)) {
    return Response.json({ error: "wrong_passcode", detail: "合言葉が違います" }, { status: 401 });
  }
  return new Response(null, { status: 204, headers: { "Set-Cookie": await staffCookie(request, env) } });
}

export function DELETE(request) {
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearedStaffCookie(request) } });
}
