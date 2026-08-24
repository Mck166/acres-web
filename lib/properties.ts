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

export function getPropertyDescription(property: Property) {
  const value = property.Description ?? property.description;
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

export function truncateDescription(text: string, maxLength = 160) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const sliced = cleaned.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const clipped = (lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced).trim();
  return `${clipped}…`;
}

export function formatDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "N/A") {
    return "Not specified";
  }
  return String(value);
}

const EVENT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "America/Halifax",
};

/** Calendar date from an MLS event timestamp, hiding missing values. */
export function formatEventDate(value: unknown, locale = "en-CA"): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const date = new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12));
    return date.toLocaleDateString(locale, EVENT_DATE_OPTIONS);
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(locale, EVENT_DATE_OPTIONS);
}

export function field(property: Property, ...keys: string[]) {
  for (const key of keys) {
    const value = property[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}
