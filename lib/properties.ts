import type { Property } from "@/lib/api";
import { getSiteUrl } from "@/lib/site";

export function getPropertyId(property: Property) {
  return String(property._id || "");
}

export function getPropertyHref(property: Property | string) {
  const id = typeof property === "string" ? property : getPropertyId(property);
  return `/properties/${encodeURIComponent(id)}`;
}

export function getPropertyShareUrl(property: Property | string) {
  const site = getSiteUrl().replace(/\/$/, "");
  return `${site}${getPropertyHref(property)}`;
}

export function getPropertyPhotos(property: Property): string[] {
  const photos = property.Photos ?? property.photos ?? [];
  return Array.isArray(photos) ? photos.filter(Boolean).map(String) : [];
}

export function getPropertyPrice(property: Property) {
  return property.Price || "Price not available";
}

export function getPropertyAddress(property: Property) {
  return property.Address || property.address || "Address not available";
}

export function getBeds(property: Property) {
  const beds = property.BEDS ?? property.Beds ?? property.beds;
  if (beds === null || beds === undefined || beds === "") return null;
  return String(beds);
}

export function getBaths(property: Property) {
  const baths =
    property["BATHROOMS (F/H)"] ??
    property["Bathrooms (F/H)"] ??
    property.Bathrooms ??
    property.bathrooms;

  if (baths === null || baths === undefined || baths === "") return null;

  const value = String(baths);
  if (value.includes("/")) return value.split("/")[0].trim();
  return value;
}

export function formatBedLabel(beds: string) {
  return `${beds} Bed${beds !== "1" ? "s" : ""}`;
}

export function formatBathLabel(baths: string) {
  return `${baths} Bath${baths !== "1" ? "s" : ""}`;
}

export function getLivingArea(property: Property) {
  const value =
    property["MAIN LIVING AREA"] ??
    property["TOTAL LIVING AREA"] ??
    property.Sqft ??
    property.sqft;
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export function formatDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "N/A") {
    return "Not specified";
  }
  return String(value);
}

export function field(property: Property, ...keys: string[]) {
  for (const key of keys) {
    const value = property[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}
