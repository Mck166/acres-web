import { getAssetLinks, wellKnownHeaders } from "@/lib/appLinks";

export async function GET() {
  const links = getAssetLinks();
  if (!links) {
    return new Response(JSON.stringify({ error: "Android app fingerprints are not configured" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(JSON.stringify(links), {
    status: 200,
    headers: wellKnownHeaders(),
  });
}
