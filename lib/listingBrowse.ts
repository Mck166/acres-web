import {
  fetchFeed,
  fetchMapSearch,
  fetchPropertiesByIds,
  type MapProperty,
  type MapSearchFilters,
  type Property,
} from "@/lib/api";
import { getPropertyId } from "@/lib/properties";
import { FEED_PAGE_SIZE } from "@/lib/site";

export const LISTING_PAGE_SIZE = FEED_PAGE_SIZE;

export const LISTING_QUERY_KEYS = ["q", "price", "beds", "baths", "sort"] as const;

export const PLACE_SHORTCUTS = [
  "Halifax",
  "Dartmouth",
  "Bedford",
  "Truro",
  "Sydney",
  "Wolfville",
] as const;

export const PRICE_BANDS = [
  { id: "under-250", label: "Under $250k", minPrice: null, maxPrice: 250_000 },
  { id: "250-500", label: "$250–500k", minPrice: 250_000, maxPrice: 500_000 },
  { id: "500-1000", label: "$500k–$1M", minPrice: 500_000, maxPrice: 1_000_000 },
  { id: "over-1000", label: "$1M+", minPrice: 1_000_000, maxPrice: null },
] as const;

export const BED_OPTIONS = [1, 2, 3, 4] as const;
export const BATH_OPTIONS = [1, 2, 3] as const;

export type PriceBandId = (typeof PRICE_BANDS)[number]["id"];
export type SortKey = "suggested" | "price-asc" | "price-desc";

export type ListingQuery = {
  q: string;
  price: PriceBandId | null;
  beds: number | null;
  baths: number | null;
  sort: SortKey;
};

export type ListingResult = {
  mode: "feed" | "search";
  properties: Property[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
  truncated: boolean;
  orderedIds: string[];
  nextIndex: number;
  error: string | null;
};

const PRICE_IDS = new Set<string>(PRICE_BANDS.map((band) => band.id));

export function emptyListingQuery(): ListingQuery {
  return { q: "", price: null, beds: null, baths: null, sort: "suggested" };
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export function listingQueryFromRecord(
  raw: Record<string, string | string[] | undefined>,
): ListingQuery {
  const params = new URLSearchParams();
  for (const key of LISTING_QUERY_KEYS) {
    const value = firstParam(raw[key]).trim();
    if (value) params.set(key, value);
  }
  return parseListingQuery(params);
}

export function parseListingQuery(params: URLSearchParams): ListingQuery {
  const q = (params.get("q") || "").trim().slice(0, 80);
  const priceRaw = params.get("price") || "";
  const price = PRICE_IDS.has(priceRaw) ? (priceRaw as PriceBandId) : null;
  const beds = parseOption(params.get("beds"), BED_OPTIONS);
  const baths = parseOption(params.get("baths"), BATH_OPTIONS);
  const sortRaw = params.get("sort");
  const sort: SortKey =
    sortRaw === "price-asc" || sortRaw === "price-desc" ? sortRaw : "suggested";

  return { q, price, beds, baths, sort };
}

function parseOption(value: string | null, options: readonly number[]) {
  const parsed = Number.parseInt(value || "", 10);
  return options.includes(parsed) ? parsed : null;
}

export function isListingFiltered(query: ListingQuery) {
  return Boolean(query.q || query.price || query.beds || query.baths);
}

export function serializeListingQuery(query: ListingQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.price) params.set("price", query.price);
  if (query.beds) params.set("beds", String(query.beds));
  if (query.baths) params.set("baths", String(query.baths));
  if (isListingFiltered(query) && query.sort !== "suggested") params.set("sort", query.sort);
  return params.toString();
}

export function listingQueryKey(query: ListingQuery) {
  return serializeListingQuery(query);
}

export function toMapFilters(query: ListingQuery): MapSearchFilters {
  const band = PRICE_BANDS.find((item) => item.id === query.price);
  return {
    minPrice: band?.minPrice ?? null,
    maxPrice: band?.maxPrice ?? null,
    minBeds: query.beds,
    minBaths: query.baths,
  };
}

export function sortSearchHits(hits: MapProperty[], sort: SortKey) {
  const unique: MapProperty[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    if (!hit.id || seen.has(hit.id)) continue;
    seen.add(hit.id);
    unique.push(hit);
  }
  if (sort === "suggested") return unique;

  const missing = sort === "price-asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  return unique.sort((left, right) => {
    const leftPrice = left.price ?? missing;
    const rightPrice = right.price ?? missing;
    return sort === "price-asc" ? leftPrice - rightPrice : rightPrice - leftPrice;
  });
}

export function orderProperties(ids: string[], properties: Property[]) {
  const byId = new Map(properties.map((property) => [getPropertyId(property), property]));
  return ids.flatMap((id) => {
    const property = byId.get(id);
    return property ? [property] : [];
  });
}

export function describeListings(query: ListingQuery, total: number, truncated: boolean) {
  const count = total.toLocaleString("en-CA");
  if (!isListingFiltered(query)) {
    return `${count} homes, newest first`;
  }

  const details: string[] = [];
  if (query.q) details.push(query.q);
  const band = PRICE_BANDS.find((item) => item.id === query.price);
  if (band) details.push(band.label);
  if (query.beds) details.push(`${query.beds}+ beds`);
  if (query.baths) details.push(`${query.baths}+ baths`);

  const countLabel = truncated ? `${count}+ homes` : `${count} home${total === 1 ? "" : "s"}`;
  return details.length ? `${countLabel} · ${details.join(" · ")}` : countLabel;
}

export function emptyListingResult(error: string | null = null): ListingResult {
  return {
    mode: "feed",
    properties: [],
    cursor: null,
    hasMore: false,
    total: 0,
    truncated: false,
    orderedIds: [],
    nextIndex: 0,
    error,
  };
}

export async function loadPropertyListings(query: ListingQuery): Promise<ListingResult> {
  if (!isListingFiltered(query)) {
    const feed = await fetchFeed({ limit: LISTING_PAGE_SIZE, revalidate: 60 });
    return {
      mode: "feed",
      properties: feed.properties,
      cursor: feed.nextCursor,
      hasMore: feed.hasMore,
      total: feed.totalAvailable,
      truncated: false,
      orderedIds: [],
      nextIndex: feed.properties.length,
      error: null,
    };
  }

  const search = await fetchMapSearch({
    q: query.q,
    filters: toMapFilters(query),
  });
  const hits = sortSearchHits(search.properties, query.sort);
  const orderedIds = hits.map((hit) => hit.id);
  const pageIds = orderedIds.slice(0, LISTING_PAGE_SIZE);
  const properties = pageIds.length
    ? orderProperties(pageIds, await fetchPropertiesByIds(pageIds))
    : [];

  return {
    mode: "search",
    properties,
    cursor: null,
    hasMore: orderedIds.length > pageIds.length,
    total: search.total,
    truncated: search.truncated,
    orderedIds,
    nextIndex: pageIds.length,
    error: null,
  };
}
