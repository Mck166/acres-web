const PARCEL_QUERY_URL =
  "https://nsgiwa2.novascotia.ca/arcgis/rest/services/PLAN/PLAN_NSPRD_WM84/MapServer/0/query";

const EMPTY = { type: "FeatureCollection", features: [] };

/** Roughly half a metre. Lot lines stay accurate while the payload shrinks a lot. */
const FABRIC_SIMPLIFY_DEGREES = 0.000004;

/** The parcel service stores PIDs as strings, sometimes zero padded to eight. */
function pidVariants(pid: string): string[] {
  const digits = String(pid).replace(/\D/g, "");
  if (!digits) return [];
  const padded = digits.padStart(8, "0");
  return padded === digits ? [digits] : [digits, padded];
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    pids?: string[];
    bounds?: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  };

  const form = new URLSearchParams({
    outFields: "PID",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });

  if (body.pids && body.pids.length > 0) {
    const values = [...new Set(body.pids.flatMap(pidVariants))];
    if (values.length === 0) {
      return Response.json(EMPTY);
    }
    form.set("where", `PID IN (${values.map((value) => `'${value}'`).join(",")})`);
  } else if (body.bounds) {
    const { minLon, minLat, maxLon, maxLat } = body.bounds;
    form.set(
      "geometry",
      JSON.stringify({
        xmin: minLon,
        ymin: minLat,
        xmax: maxLon,
        ymax: maxLat,
        spatialReference: { wkid: 4326 },
      }),
    );
    form.set("geometryType", "esriGeometryEnvelope");
    form.set("inSR", "4326");
    form.set("spatialRel", "esriSpatialRelIntersects");
    form.set("maxAllowableOffset", String(FABRIC_SIMPLIFY_DEGREES));
  } else {
    return Response.json(EMPTY);
  }

  const response = await fetch(PARCEL_QUERY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!response.ok) {
    return Response.json(
      { error: { message: `Parcel query failed: ${response.status}` } },
      { status: 502 },
    );
  }

  return Response.json(await response.json());
}
