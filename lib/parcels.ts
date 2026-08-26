import type { MultiPolygon, Polygon } from "geojson";

export type ParcelGeometry = Polygon | MultiPolygon;

type ArcGisFeature = {
  geometry?: ParcelGeometry;
  properties?: { PID?: string | number };
};

export type ListingKind = "sale" | "sold" | "pending";

export type ListingForParcel = {
  id: string;
  lon: number;
  lat: number;
  pid?: string | null;
  kind: ListingKind;
  label: string;
  selected: boolean;
};

export type ParcelFabric = {
  type: "FeatureCollection";
  features: ArcGisFeature[];
};

const parcelByPid = new Map<string, ParcelGeometry>();
/** PIDs the parcel service had no polygon for, so we never ask twice. */
const unknownPids = new Set<string>();

const PID_CHUNK_SIZE = 100;
const MAX_PARALLEL_REQUESTS = 3;

export function normalizePid(pid: string | null | undefined): string | null {
  if (!pid) return null;
  const digits = String(pid).replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(8, "0");
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

async function postParcels(body: unknown, signal?: AbortSignal): Promise<ArcGisFeature[]> {
  const response = await fetch("/api/parcels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Parcel query failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    features?: ArcGisFeature[];
    error?: { message?: string };
  };
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  return (data.features || []).filter((feature) => Boolean(feature.geometry));
}

async function queryParcelsByPid(pids: string[], signal?: AbortSignal) {
  const queue = chunk(pids, PID_CHUNK_SIZE);
  const workers = Array.from(
    { length: Math.min(MAX_PARALLEL_REQUESTS, queue.length) },
    async () => {
      while (queue.length > 0) {
        const group = queue.shift();
        if (!group) return;

        const features = await postParcels({ pids: group }, signal);
        for (const feature of features) {
          const pid = normalizePid(String(feature.properties?.PID ?? ""));
          if (!pid || !feature.geometry) continue;
          parcelByPid.set(pid, feature.geometry);
        }
        for (const pid of group) {
          if (!parcelByPid.has(pid)) unknownPids.add(pid);
        }
      }
    },
  );

  await Promise.all(workers);
}

/** Load polygons for these listings' PIDs, reusing anything already cached. */
export async function fetchParcelsByPid(
  pids: Array<string | null | undefined>,
  signal?: AbortSignal,
): Promise<Map<string, ParcelGeometry>> {
  const needed = [
    ...new Set(
      pids
        .map(normalizePid)
        .filter((pid): pid is string => Boolean(pid))
        .filter((pid) => !parcelByPid.has(pid) && !unknownPids.has(pid)),
    ),
  ];

  if (needed.length > 0) {
    await queryParcelsByPid(needed, signal);
  }
  return parcelByPid;
}

/** Coloured lots: one polygon per listing that has a known parcel. */
export function buildListingLots(
  parcels: Map<string, ParcelGeometry>,
  listings: ListingForParcel[],
) {
  return {
    type: "FeatureCollection" as const,
    features: listings.flatMap((listing) => {
      const pid = normalizePid(listing.pid);
      const geometry = pid ? parcels.get(pid) : undefined;
      if (!geometry) return [];
      return [
        {
          type: "Feature" as const,
          geometry,
          properties: {
            id: listing.id,
            kind: listing.kind,
            label: listing.label,
            selected: listing.selected ? 1 : 0,
          },
        },
      ];
    }),
  };
}

/**
 * Some listings have a PID the province's parcel fabric does not carry, usually
 * condo units or very new subdivisions. Mark those with a dot so they are still
 * visible rather than silently missing from the map.
 */
export function buildLotlessListings(
  parcels: Map<string, ParcelGeometry>,
  listings: ListingForParcel[],
) {
  return {
    type: "FeatureCollection" as const,
    features: listings.flatMap((listing) => {
      const pid = normalizePid(listing.pid);
      if (pid && parcels.has(pid)) return [];
      return [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [listing.lon, listing.lat] },
          properties: {
            id: listing.id,
            kind: listing.kind,
            selected: listing.selected ? 1 : 0,
          },
        },
      ];
    }),
  };
}

/** Neutral lot outlines, minus the ones already drawn in colour. */
export function buildNeutralLots(fabric: ParcelFabric, colouredPids: Set<string>) {
  return {
    type: "FeatureCollection" as const,
    features: fabric.features.flatMap((feature) => {
      if (!feature.geometry) return [];
      const pid = normalizePid(String(feature.properties?.PID ?? ""));
      if (pid && colouredPids.has(pid)) return [];
      return [
        {
          type: "Feature" as const,
          geometry: feature.geometry,
          properties: {},
        },
      ];
    }),
  };
}

export async function fetchParcelFabric(
  bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number },
  signal?: AbortSignal,
): Promise<ParcelFabric> {
  return {
    type: "FeatureCollection",
    features: await postParcels({ bounds }, signal),
  };
}
