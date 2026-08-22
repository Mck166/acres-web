import type { MapProperty } from "@/lib/api";
import type { ListingKind } from "@/lib/parcels";

export type PinTone = "sale" | "sold" | "mixed";

export type PinCluster = {
  key: string;
  lon: number;
  lat: number;
  x: number;
  y: number;
  items: MapProperty[];
};

export type ProjectPoint = (lon: number, lat: number) => { x: number; y: number };

export const CLUSTER_RADIUS_PX = 54;

/**
 * The only lot colours the data supports. Status is either FOR SALE or SOLD, and
 * the API already drops sold homes once they fall outside its recency window.
 */
export function listingKind(property: MapProperty): ListingKind {
  if (property.pin === "sold") return "sold";
  return String(property.status || "").toLowerCase().includes("sold") ? "sold" : "sale";
}

export function pinTone(items: MapProperty[]): PinTone {
  const kinds = new Set(items.map(listingKind));
  if (kinds.size > 1) return "mixed";
  return kinds.has("sold") ? "sold" : "sale";
}

export function pinLabel(property: MapProperty): string {
  if (property.pin === "sold") return property.priceLabel || "Sold";
  return property.priceLabel || "New";
}

/** Greedy pixel-distance clustering. Fine at this scale: a few hundred pins at most. */
export function clusterPins(
  project: ProjectPoint | null,
  pins: MapProperty[],
  radius = CLUSTER_RADIUS_PX,
): PinCluster[] {
  const clusters: PinCluster[] = [];

  for (const pin of pins) {
    const point = project?.(pin.lon, pin.lat);
    if (!point) {
      clusters.push({ key: pin.id, lon: pin.lon, lat: pin.lat, x: 0, y: 0, items: [pin] });
      continue;
    }

    const existing = clusters.find(
      (cluster) => (cluster.x - point.x) ** 2 + (cluster.y - point.y) ** 2 <= radius ** 2,
    );
    if (existing) {
      existing.items.push(pin);
      continue;
    }

    clusters.push({
      key: pin.id,
      lon: pin.lon,
      lat: pin.lat,
      x: point.x,
      y: point.y,
      items: [pin],
    });
  }

  return clusters;
}
