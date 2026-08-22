import { FEED_PAGE_SIZE } from "@/lib/site";

const REMOTE_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.myacresapp.com/api";

// Browser calls go through a same-origin rewrite so we never hit the API's
// CORS policy. The Next.js server still talks to the remote API directly.
function getApiBaseUrl() {
  if (typeof window === "undefined") return REMOTE_API_BASE_URL;
  return "/acres-api";
}

const DEFAULT_TIMEOUT_MS = 15000;

export type Property = {
  _id: string;
  Price?: string;
  Status?: string;
  Address?: string;
  address?: string;
  Photos?: string[];
  photos?: string[];
  Photo_Count?: number;
  PID?: string;
  url?: string;
  BEDS?: string | number;
  Beds?: string | number;
  beds?: string | number;
  "BATHROOMS (F/H)"?: string;
  "Bathrooms (F/H)"?: string;
  Bathrooms?: string;
  bathrooms?: string;
  [key: string]: unknown;
};

export type FeedResponse = {
  properties: Property[];
  nextCursor: string | null;
  hasMore: boolean;
  remaining: number;
  totalAvailable: number;
};

export type MapPinType = "price" | "sold" | "listed";

export type MapProperty = {
  id: string;
  lat: number;
  lon: number;
  price: number | null;
  priceLabel: string | null;
  status: string | null;
  pin: MapPinType | null;
  pid?: string | null;
};

export type MapBounds = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  zoom?: number;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  timeout?: number;
  revalidate?: number | false;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, timeout = DEFAULT_TIMEOUT_MS, revalidate, signal } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort);
    }
  }

  const init: RequestInit = {
    method,
    signal: controller.signal,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  if (typeof window === "undefined") {
    if (revalidate === false) {
      init.cache = "no-store";
    } else {
      Object.assign(init, { next: { revalidate: revalidate ?? 60 } });
    }
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, init);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}${errorText ? `: ${errorText}` : ""}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchMapProperties(
  bounds: MapBounds,
  options: { signal?: AbortSignal; timeout?: number } = {},
): Promise<MapProperty[]> {
  const params = new URLSearchParams({
    min_lat: String(bounds.minLat),
    min_lon: String(bounds.minLon),
    max_lat: String(bounds.maxLat),
    max_lon: String(bounds.maxLon),
  });
  if (bounds.zoom != null) params.set("zoom", String(bounds.zoom.toFixed(2)));

  const data = await request<{ properties?: MapProperty[] }>(`/map?${params.toString()}`, {
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    revalidate: false,
  });

  return data.properties || [];
}

export async function fetchFeed({
  firebaseUid = null,
  limit = FEED_PAGE_SIZE,
  cursor = null,
  revalidate,
}: {
  firebaseUid?: string | null;
  limit?: number;
  cursor?: string | null;
  revalidate?: number | false;
} = {}): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (firebaseUid) params.set("firebase_uid", firebaseUid);
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);

  const data = await request<{
    properties?: Property[];
    next_cursor?: string | null;
    has_more?: boolean;
    remaining?: number;
    total_available?: number;
  }>(`/feed?${params.toString()}`, { revalidate });

  return {
    properties: data.properties || [],
    nextCursor: data.next_cursor || null,
    hasMore: Boolean(data.has_more),
    remaining: data.remaining || 0,
    totalAvailable: data.total_available || 0,
  };
}

export async function fetchPropertiesByIds(ids: string[]): Promise<Property[]> {
  const cleanIds = (ids || []).filter(Boolean).map(String);
  if (cleanIds.length === 0) return [];

  const data = await request<{ properties?: Property[] }>("/properties/batch", {
    method: "POST",
    body: { ids: cleanIds },
    revalidate: false,
  });

  return data.properties || [];
}

export async function fetchPropertyById(propertyId: string): Promise<Property | null> {
  try {
    return await request<Property>(`/properties/${encodeURIComponent(propertyId)}`, {
      timeout: 10000,
      revalidate: 60,
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    return null;
  }
}

export async function favoriteProperty(propertyId: string, firebaseUid?: string | null) {
  const params = new URLSearchParams();
  if (firebaseUid) params.set("firebase_uid", firebaseUid);
  const query = params.toString() ? `?${params.toString()}` : "";

  try {
    return await request<{ success?: boolean }>(
      `/properties/${encodeURIComponent(propertyId)}/favorite${query}`,
      { method: "POST", timeout: 10000, revalidate: false },
    );
  } catch (error) {
    console.error("Error favoriting property:", error);
    return { success: false };
  }
}

export async function refreshSeenProperties(firebaseUid: string) {
  if (!firebaseUid) return { success: false };

  try {
    return await request<{ success?: boolean }>(
      `/users/${encodeURIComponent(firebaseUid)}/seen/refresh`,
      { method: "POST", timeout: 10000, revalidate: false },
    );
  } catch (error) {
    console.warn("Could not refresh seen properties:", error);
    return { success: false };
  }
}
