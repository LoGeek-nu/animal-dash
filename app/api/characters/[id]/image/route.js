import { env } from "cloudflare:workers";
import { getGeneratedCharacterImage } from "../../character-store.js";

export async function GET(_request, { params }) {
  const { id } = await params;
  const object = env.CHARACTERS ? await getGeneratedCharacterImage(env.CHARACTERS, id) : null;
  if (!object) return new Response("Not Found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/png",
      // Character ids are random UUIDs and the pixels never change (an edit rewrites only the metadata).
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
}
