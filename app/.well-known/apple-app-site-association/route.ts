import { getAppleAppSiteAssociation, wellKnownHeaders } from "@/lib/appLinks";

export async function GET() {
  const association = getAppleAppSiteAssociation();
  if (!association) {
    return new Response(JSON.stringify({ error: "Apple Team ID is not configured" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(JSON.stringify(association), {
    status: 200,
    headers: wellKnownHeaders(),
  });
}
