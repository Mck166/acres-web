import type { MapSearchFilters, Property } from "@/lib/api";
import { getBaths, getBeds, getPropertyAddress } from "@/lib/properties";

export type PropertySort = "newest" | "price_asc" | "price_desc";

export type PropertyBrowseFilters = {
  q: string;
  minPrice: number | null;
  maxPrice: number | null;
  minBeds: number | null;
  minBaths: number | null;
  sort: PropertySort;
};

export const DEFAULT_BROWSE_FILTERS: PropertyBrowseFilters = {
  q: "",
  minPrice: null,
  maxPrice: null,
  minBeds: null,
  minBaths: null,
  sort: "newest",
};

export const PRICE_PRESETS: {
  id: string;
  label: string;
  minPrice: number | null;
  maxPrice: number | null;
}[] = [
  { id: "any", label: "Any price", minPrice: null, maxPrice: null },
  { id: "u300", label: "Under $300k", minPrice: null, maxPrice: 300_000 },
  { id: "300-500", label: "$300–500k", minPrice: 300_000, maxPrice: 500_000 },
  { id: "500-750", label: "$500–750k", minPrice: 500_000, maxPrice: 750_000 },
  { id: "750p", label: "$750k+", minPrice: 750_000, maxPrice: null },
];

export const BED_PRESETS = [
  { id: "any", label: "Any beds", value: null },
  { id: "1", label: "1+", value: 1 },
  { id: "2", label: "2+", value: 2 },
  { id: "3", label: "3+", value: 3 },
  { id: "4", label: "4+", value: 4 },
] as const;

export const BATH_PRESETS = [
  { id: "any", label: "Any baths", value: null },
  { id: "1", label: "1+", value: 1 },
  { id: "2", label: "2+", value: 2 },
  { id: "3", label: "3+", value: 3 },
] as const;

export const SORT_OPTIONS: { id: PropertySort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
];

export function getPriceValue(property: Property): number | null {
  if (typeof property.price_value === "number" && Number.isFinite(property.price_value)) {
    return property.price_value;
  }
  const raw = property.Price;
  if (!raw) return null;
  const parsed = Number.parseFloat(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCount(value: string | null): number | null {
  if (!value) return null;
  const match = String(value).match(/[\d.]+/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function browseFiltersActive(filters: PropertyBrowseFilters) {
  return Boolean(
    filters.q.trim() ||
      filters.minPrice != null ||
      filters.maxPrice != null ||
      filters.minBeds != null ||
      filters.minBaths != null,
  );
}

export function toMapSearchFilters(filters: PropertyBrowseFilters): MapSearchFilters {
  return {
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minBeds: filters.minBeds,
    minBaths: filters.minBaths,
  };
}

export function parseBrowseFilters(params: URLSearchParams): PropertyBrowseFilters {
  const sortRaw = params.get("sort");
  const sort: PropertySort =
    sortRaw === "price_asc" || sortRaw === "price_desc" || sortRaw === "newest"
      ? sortRaw
      : "newest";

  const num = (key: string) => {
    const raw = params.get(key);
    if (!raw) return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    q: params.get("q")?.trim() || "",
    minPrice: num("min_price"),
    maxPrice: num("max_price"),
    minBeds: num("min_beds"),
    minBaths: num("min_baths"),
    sort,
  };
}

export function browseFiltersToSearchParams(filters: PropertyBrowseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.minPrice != null) params.set("min_price", String(filters.minPrice));
  if (filters.maxPrice != null) params.set("max_price", String(filters.maxPrice));
  if (filters.minBeds != null) params.set("min_beds", String(filters.minBeds));
  if (filters.minBaths != null) params.set("min_baths", String(filters.minBaths));
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  return params;
}

export function sortProperties(properties: Property[], sort: PropertySort): Property[] {
  const next = [...properties];
  if (sort === "price_asc" || sort === "price_desc") {
    next.sort((a, b) => {
      const aPrice = getPriceValue(a);
      const bPrice = getPriceValue(b);
      if (aPrice == null && bPrice == null) return 0;
      if (aPrice == null) return 1;
      if (bPrice == null) return -1;
      return sort === "price_asc" ? aPrice - bPrice : bPrice - aPrice;
    });
    return next;
  }

  next.sort((a, b) => {
    const aDate = Date.parse(String(a.listed_on || a.date_added || "")) || 0;
    const bDate = Date.parse(String(b.listed_on || b.date_added || "")) || 0;
    return bDate - aDate;
  });
  return next;
}

export type PricedSearchHit = {
  id: string;
  price: number | null;
};

export function sortSearchHits(hits: PricedSearchHit[], sort: PropertySort): PricedSearchHit[] {
  const next = [...hits];
  if (sort === "newest") return next;
  next.sort((a, b) => {
    if (a.price == null && b.price == null) return 0;
    if (a.price == null) return 1;
    if (b.price == null) return -1;
    return sort === "price_asc" ? a.price - b.price : b.price - a.price;
  });
  return next;
}

export function propertyMatchesBrowseFilters(property: Property, filters: PropertyBrowseFilters) {
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const address = getPropertyAddress(property).toLowerCase();
    const pid = String(property.PID || "").toLowerCase();
    if (!address.includes(q) && !pid.includes(q)) return false;
  }

  const price = getPriceValue(property);
  if (filters.minPrice != null && (price == null || price < filters.minPrice)) return false;
  if (filters.maxPrice != null && (price == null || price > filters.maxPrice)) return false;

  const beds = parseCount(getBeds(property));
  if (filters.minBeds != null && (beds == null || beds < filters.minBeds)) return false;

  const baths = parseCount(getBaths(property));
  if (filters.minBaths != null && (baths == null || baths < filters.minBaths)) return false;

  return true;
}

export function activeFilterSummary(filters: PropertyBrowseFilters): string[] {
  const chips: string[] = [];
  if (filters.q.trim()) chips.push(`“${filters.q.trim()}”`);

  const pricePreset = PRICE_PRESETS.find(
    (preset) => preset.minPrice === filters.minPrice && preset.maxPrice === filters.maxPrice,
  );
  if (pricePreset && pricePreset.id !== "any") chips.push(pricePreset.label);
  else if (filters.minPrice != null || filters.maxPrice != null) {
    const min = filters.minPrice != null ? `$${Math.round(filters.minPrice / 1000)}k` : "";
    const max = filters.maxPrice != null ? `$${Math.round(filters.maxPrice / 1000)}k` : "";
    chips.push([min, max].filter(Boolean).join("–") || "Price");
  }

  if (filters.minBeds != null) chips.push(`${filters.minBeds}+ beds`);
  if (filters.minBaths != null) chips.push(`${filters.minBaths}+ baths`);
  return chips;
}
