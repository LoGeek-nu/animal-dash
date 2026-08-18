export async function GET() {
  return Response.json({
    status: "ok",
    app: "animal-dash-mock",
    mode: "local-mock",
    services: { game: "ready", admin: "ready", sync: "broadcast-channel" },
    checkedAt: new Date().toISOString(),
  });
}
