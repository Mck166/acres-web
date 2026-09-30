import {
  fetchFeed,
  type Property,
  type PropertyFeedFilters,
} from "@/lib/api";
import { FEED_PAGE_SIZE } from "@/lib/site";
import { getBaths, getBeds, getPropertyAddress } from "@/lib/properties";

export type PropertyListFilters = {
  place: string | null;
  beds: string | null;
  baths: string | null;
  price: string | null;
};

export const EMPTY_PROPERTY_FILTERS: PropertyListFilters = {
  place: null,
  beds: null,
  baths: null,
  price: null,
};

type Choice = {
  id: string;
  label: string;
  summary: string;
  query?: string;
  min: number | null;
  max: number | null;
};

export const PLACE_OPTIONS: Choice[] = [
  { id: "halifax", label: "Halifax", summary: "Halifax", query: "halifax", min: null, max: null },
  { id: "dartmouth", label: "Dartmouth", summary: "Dartmouth", query: "dartmouth", min: null, max: null },
  { id: "bedford", label: "Bedford", summary: "Bedford", query: "bedford", min: null, max: null },
  { id: "sackville", label: "Sackville", summary: "Sackville", query: "sackville", min: null, max: null },
  { id: "cole-harbour", label: "Cole Harbour", summary: "Cole Harbour", query: "cole harbour", min: null, max: null },
  { id: "sydney", label: "Sydney", summary: "Sydney", query: "sydney", min: null, max: null },
  { id: "truro", label: "Truro", summary: "Truro", query: "truro", min: null, max: null },
  { id: "new-glasgow", label: "New Glasgow", summary: "New Glasgow", query: "new glasgow", min: null, max: null },
  { id: "wolfville", label: "Wolfville", summary: "Wolfville", query: "wolfville", min: null, max: null },
  { id: "kentville", label: "Kentville", summary: "Kentville", query: "kentville", min: null, max: null },
  { id: "bridgewater", label: "Bridgewater", summary: "Bridgewater", query: "bridgewater", min: null, max: null },
  { id: "yarmouth", label: "Yarmouth", summary: "Yarmouth", query: "yarmouth", min: null, max: null },
];

export const BED_OPTIONS: Choice[] = [
  { id: "1", label: "1 bed", summary: "1 bedroom", min: 1, max: 1 },
  { id: "2", label: "2 beds", summary: "2 bedrooms", min: 2, max: 2 },
  { id: "3", label: "3 beds", summary: "3 bedrooms", min: 3, max: 3 },
  { id: "4", label: "4+ beds", summary: "4+ bedrooms", min: 4, max: null },
];

export const BATH_OPTIONS: Choice[] = [
  { id: "1", label: "1 bath", summary: "1 bathroom", min: 1, max: 1.99 },
  { id: "2", label: "2 baths", summary: "2 bathrooms", min: 2, max: 2.99 },
  { id: "3", label: "3 baths", summary: "3 bathrooms", min: 3, max: 3.99 },
  { id: "4", label: "4+ baths", summary: "4+ bathrooms", min: 4, max: null },
];

export const PRICE_OPTIONS: Choice[] = [
  { id: "under-300", label: "Under $300k", summary: "Under $300k", min: null, max: 299999 },
  { id: "300-500", label: "$300–500k", summary: "$300–500k", min: 300000, max: 500000 },
  { id: "500-750", label: "$500–750k", summary: "$500–750k", min: 500001, max: 750000 },
  { id: "750-1000", label: "$750k–$1M", summary: "$750k–$1M", min: 750001, max: 1000000 },
  { id: "over-1000", label: "$1M+", summary: "$1M+", min: 1000001, max: null },
];

type SearchParamValue = string | string[] | undefined;
type SearchParamSource =
  | URLSearchParams
  | Record<string, SearchParamValue>;

function readParam(source: SearchParamSource, key: string) {
  if (source instanceof URLSearchParams) return source.get(key);
  const value = source[key];
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function allowedId(options: Choice[], id: string | null) {
  if (!id) return null;
  return options.some((option) => option.id === id) ? id : null;
}

export function parsePropertyListFilters(source: SearchParamSource): PropertyListFilters {
  return {
    place: allowedId(PLACE_OPTIONS, readParam(source, "place")),
    beds: allowedId(BED_OPTIONS, readParam(source, "beds")),
    baths: allowedId(BATH_OPTIONS, readParam(source, "baths")),
    price: allowedId(PRICE_OPTIONS, readParam(source, "price")),
  };
}

export function filtersAreActive(filters: PropertyListFilters) {
  return Boolean(filters.place || filters.beds || filters.baths || filters.price);
}

export function buildPropertiesHref(filters: PropertyListFilters) {
  const search = new URLSearchParams();
  if (filters.place) search.set("place", filters.place);
  if (filters.beds) search.set("beds", filters.beds);
  if (filters.baths) search.set("baths", filters.baths);
  if (filters.price) search.set("price", filters.price);
  const query = search.toString();
  return query ? `/properties?${query}` : "/properties";
}

export function syncPropertyFilterUrl(filters: PropertyListFilters) {
  if (typeof window === "undefined") return;
  const href = buildPropertiesHref(filters);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === href) return;
  window.history.replaceState(window.history.state, "", href);
}

export function describePropertyFilters(filters: PropertyListFilters) {
  const parts: string[] = [];
  const place = PLACE_OPTIONS.find((option) => option.id === filters.place);
  if (place) parts.push(place.summary);
  const beds = BED_OPTIONS.find((option) => option.id === filters.beds);
  if (beds) parts.push(beds.summary);
  const baths = BATH_OPTIONS.find((option) => option.id === filters.baths);
  if (baths) parts.push(baths.summary);
  const price = PRICE_OPTIONS.find((option) => option.id === filters.price);
  if (price) parts.push(price.summary);
  return parts.join(" · ");
}

function choiceBounds(options: Choice[], id: string | null) {
  const choice = options.find((option) => option.id === id);
  return { min: choice?.min ?? null, max: choice?.max ?? null };
}

export function toFeedQuery(filters: PropertyListFilters): PropertyFeedFilters {
  const place = PLACE_OPTIONS.find((option) => option.id === filters.place);
  const beds = choiceBounds(BED_OPTIONS, filters.beds);
  const baths = choiceBounds(BATH_OPTIONS, filters.baths);
  const price = choiceBounds(PRICE_OPTIONS, filters.price);
  return {
    q: place?.query ?? null,
    minBeds: beds.min,
    maxBeds: beds.max,
    minBaths: baths.min,
    maxBaths: baths.max,
    minPrice: price.min,
    maxPrice: price.max,
  };
}

function inRange(value: number | null, min: number | null, max: number | null) {
  if (min === null && max === null) return true;
  if (value === null) return false;
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

function numericField(value: string | null) {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const REGION_TOKENS = new Set(["ns", "n.s.", "n.s", "nova scotia"]);
const COUNTRY_TOKENS = new Set(["ca", "canada"]);

function propertyPrice(property: Property) {
  if (typeof property.price_value === "number" && Number.isFinite(property.price_value)) {
    return property.price_value;
  }
  const digits = String(property.Price ?? "").replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : null;
}

export function propertyLocality(property: Property) {
  const parts = getPropertyAddress(property)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z]\s?\d[A-CEGHJ-NPR-TV-Z]\d$/i.test(part));

  if (parts.length && COUNTRY_TOKENS.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  if (parts.length && REGION_TOKENS.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  if (parts.length >= 2) return parts[parts.length - 1];
  return null;
}

export function localityMatches(city: string | null, query: string) {
  const q = query.toLowerCase().replace(/\s+/g, " ").trim();
  if (!q) return true;
  if (!city) return false;
  const normalized = city.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalized === q) return true;
  return ` ${normalized} `.includes(` ${q} `);
}

export function propertyMatchesPlace(property: Property, filters: PropertyListFilters) {
  const place = PLACE_OPTIONS.find((option) => option.id === filters.place);
  if (!place?.query) return true;
  return localityMatches(propertyLocality(property), place.query);
}

export function propertyMatchesFilters(property: Property, filters: PropertyListFilters) {
  if (!propertyMatchesPlace(property, filters)) return false;

  const price = propertyPrice(property);
  const priceBounds = choiceBounds(PRICE_OPTIONS, filters.price);
  if (!inRange(price, priceBounds.min, priceBounds.max)) return false;

  const beds = choiceBounds(BED_OPTIONS, filters.beds);
  if (!inRange(numericField(getBeds(property)), beds.min, beds.max)) return false;

  const baths = choiceBounds(BATH_OPTIONS, filters.baths);
  if (!inRange(numericField(getBaths(property)), baths.min, baths.max)) return false;

  return true;
}

export type FilteredFeedPage = {
  properties: Property[];
  cursor: string | null;
  hasMore: boolean;
  totalAvailable: number | null;
};

/**
 * Load the next slice of listings for the current filters.
 * Place is applied on the server when the API supports it. If a page still
 * contains other cities, keep reading so the grid fills with real matches.
 */
export async function loadFilteredFeed({
  cursor,
  filters,
  firebaseUid = null,
  target = FEED_PAGE_SIZE,
}: {
  cursor: string | null;
  filters: PropertyListFilters;
  firebaseUid?: string | null;
  target?: number;
}): Promise<FilteredFeedPage> {
  const matched: Property[] = [];
  let nextCursor = cursor;
  let hasMore = true;
  let totalAvailable: number | null = null;
  let placeTrusted = true;
  let pages = 0;
  const maxPages = filters.place ? 8 : 1;

  while (matched.length < target && hasMore && pages < maxPages) {
    const page = await fetchFeed({
      cursor: nextCursor,
      firebaseUid,
      limit: !placeTrusted && filters.place ? 100 : FEED_PAGE_SIZE,
      filters: toFeedQuery(filters),
      revalidate: false,
    });
    pages += 1;
    nextCursor = page.nextCursor;
    hasMore = page.hasMore;
    if (pages === 1) totalAvailable = page.totalAvailable;

    for (const property of page.properties) {
      if (!propertyMatchesPlace(property, filters)) placeTrusted = false;
      if (propertyMatchesFilters(property, filters)) matched.push(property);
    }

    if (placeTrusted) break;
  }

  return {
    properties: matched,
    cursor: nextCursor,
    hasMore,
    totalAvailable: placeTrusted ? totalAvailable : null,
  };
}
