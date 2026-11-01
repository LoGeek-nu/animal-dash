import { isGameRequest, isSameOrigin, isStaffRequest, unauthorizedResponse } from "./auth.js";
import { getSyncRoom } from "./sync.js";

export async function syncResponse(request, env) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const role = url.searchParams.get("role") ?? "viewer";
  if (!["admin", "game", "viewer"].includes(role)) return new Response("Invalid role", { status: 400 });
  // Each writing role needs its own login; the admin passcode alone only watches the game.
  const allowed = role === "viewer" || (role === "admin" ? await isStaffRequest(request, env) : await isGameRequest(request, env));
  if (!allowed) return unauthorizedResponse();
  // Only this public upgrade path reaches the room; internal notification paths
  // remain binding-only. A role in a later WebSocket frame cannot change access.
  url.searchParams.set("role", role);
  return getSyncRoom(env).fetch(new Request(url, request));
}
