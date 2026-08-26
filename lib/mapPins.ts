import type { MapProperty } from "@/lib/api";
import type { ListingKind } from "@/lib/parcels";

export type PinTone = "sale" | "sold" | "pending" | "mixed";

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
 * Lot and pin colour follow listing state. Pending is brown, a closed sale is
 * red, and everything still on the market is blue. A leftover sold pin must
 * not paint a still-pending home red.
 */
export function listingKind(property: MapProperty): ListingKind {
  const status = String(property.status || "").toLowerCase();
  if (property.pin === "pending" || status.includes("pending")) return "pending";
  if (property.pin === "sold") return "sold";
  return status.includes("sold") ? "sold" : "sale";
}

export function pinTone(items: MapProperty[]): PinTone {
  const kinds = new Set(items.map(listingKind));
  if (kinds.size > 1) return "mixed";
  if (kinds.has("sold")) return "sold";
  if (kinds.has("pending")) return "pending";
  return "sale";
}

export function pinLabel(property: MapProperty): string {
  if (property.pin === "sold") return property.priceLabel || "Sold";
  if (property.pin === "pending") return property.priceLabel || "Pending";
  return property.priceLabel || "New";
}

/** Status chip for map pins and the cluster list. Pending beats leftover sold. */
export function listingBadge(
  property: MapProperty,
): { text: string; tone: "sold" | "pending" | "listed" | "price" } | null {
  const status = String(property.status || "").toLowerCase();
  if (property.pin === "pending" || status.includes("pending")) {
    return { text: "Pending", tone: "pending" };
  }
  if (property.pin === "sold" || status.includes("sold")) {
    return { text: "Sold", tone: "sold" };
  }
  if (property.pin === "listed") {
    return { text: "New listing", tone: "listed" };
  }
  if (property.pin === "price") {
    return { text: "New price", tone: "price" };
  }
  return null;
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
