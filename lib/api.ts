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
  price_value?: number;
  Status?: string;
  Address?: string;
  address?: string;
  Photos?: string[];
  photos?: string[];
  Photo_Count?: number;
  PID?: string;
  url?: string;
  Description?: string;
  description?: string;
  latitude?: number | string;
  longitude?: number | string;
  date_added?: string;
  date_updated?: string;
  listed_on?: string;
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

export type MapPinType = "price" | "sold" | "listed" | "pending";

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
  headers?: Record<string, string>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, timeout = DEFAULT_TIMEOUT_MS, revalidate, signal, headers } = options;
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
      ...headers,
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

export type MapSearchFilters = {
  minPrice?: number | null;
  maxPrice?: number | null;
  minBeds?: number | null;
  maxBeds?: number | null;
  minBaths?: number | null;
  maxBaths?: number | null;
  minSqft?: number | null;
  maxSqft?: number | null;
};

export type MapSearchResponse = {
  properties: MapProperty[];
  total: number;
  truncated: boolean;
};

export async function fetchMapSearch(
  query: { q?: string; filters?: MapSearchFilters },
  options: { signal?: AbortSignal; timeout?: number } = {},
): Promise<MapSearchResponse> {
  const params = new URLSearchParams();
  const q = query.q?.trim();
  if (q) params.set("q", q);

  const filters = query.filters || {};
  const numeric: [string, number | null | undefined][] = [
    ["min_price", filters.minPrice],
    ["max_price", filters.maxPrice],
    ["min_beds", filters.minBeds],
    ["max_beds", filters.maxBeds],
    ["min_baths", filters.minBaths],
    ["max_baths", filters.maxBaths],
    ["min_sqft", filters.minSqft],
    ["max_sqft", filters.maxSqft],
  ];
  for (const [key, value] of numeric) {
    if (value != null && Number.isFinite(value)) params.set(key, String(value));
  }

  const data = await request<{
    properties?: MapProperty[];
    total?: number;
    truncated?: boolean;
  }>(`/search?${params.toString()}`, {
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    revalidate: false,
  });

  return {
    properties: data.properties || [],
    total: data.total ?? (data.properties || []).length,
    truncated: Boolean(data.truncated),
  };
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

export type PropertyFeedFilters = {
  q?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minBeds?: number | null;
  maxBeds?: number | null;
  minBaths?: number | null;
  maxBaths?: number | null;
};

function appendFeedParam(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") return;
  params.set(key, String(value));
}

export async function fetchFeed({
  limit = FEED_PAGE_SIZE,
  cursor = null,
  revalidate,
  filters = null,
}: {
  firebaseUid?: string | null;
  limit?: number;
  cursor?: string | null;
  revalidate?: number | false;
  filters?: PropertyFeedFilters | null;
} = {}): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  if (filters) {
    appendFeedParam(params, "q", filters.q);
    appendFeedParam(params, "min_price", filters.minPrice);
    appendFeedParam(params, "max_price", filters.maxPrice);
    appendFeedParam(params, "min_beds", filters.minBeds);
    appendFeedParam(params, "max_beds", filters.maxBeds);
    appendFeedParam(params, "min_baths", filters.minBaths);
    appendFeedParam(params, "max_baths", filters.maxBaths);
  }

  const data = await request<{
    properties?: Property[];
    next_cursor?: string | null;
    has_more?: boolean;
    remaining?: number;
    total_available?: number;
  }>(`/feed?${params.toString()}`, { revalidate, headers: await optionalAuthHeaders() });

  return {
    properties: data.properties || [],
    nextCursor: data.next_cursor || null,
    hasMore: Boolean(data.has_more),
    remaining: data.remaining || 0,
    totalAvailable: data.total_available || 0,
  };
}

export async function fetchPropertiesByIds(
  ids: string[],
  options: { signal?: AbortSignal } = {},
): Promise<Property[]> {
  const cleanIds = (ids || []).filter(Boolean).map(String);
  if (cleanIds.length === 0) return [];

  const data = await request<{ properties?: Property[] }>("/properties/batch", {
    method: "POST",
    body: { ids: cleanIds },
    revalidate: false,
    signal: options.signal,
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

export async function favoriteProperty(propertyId: string) {
  try {
    return await authedRequest<{ success?: boolean }>(
      `/properties/${encodeURIComponent(propertyId)}/favorite`,
      { method: "POST", timeout: 10000 },
    );
  } catch (error) {
    console.error("Error favoriting property:", error);
    return { success: false };
  }
}

async function optionalAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const { getFirebaseAuth } = await import("@/lib/firebase");
    const user = getFirebaseAuth().currentUser;
    if (!user) return {};
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    return {};
  }
}

export type ManagedUserPlan = "free" | "assistant";

export type ManagedUser = {
  uid: string;
  name: string;
  email: string;
  account_type: "client" | "agent" | null;
  plan: ManagedUserPlan;
  admin_plan: ManagedUserPlan | null;
  stripe_status: string | null;
};

export type ManagedUsersResponse = {
  users: ManagedUser[];
  total: number;
  truncated: boolean;
};

export async function fetchManagedUsers(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams();
  const q = query.trim();
  if (q) params.set("q", q);
  const suffix = params.toString() ? `?${params}` : "";
  return authedRequest<ManagedUsersResponse>(`/admin/users${suffix}`, {
    timeout: 20000,
    signal,
  });
}

export async function updateManagedUserPlan(uid: string, plan: ManagedUserPlan) {
  return authedRequest<Pick<ManagedUser, "uid" | "plan" | "admin_plan">>(
    `/admin/users/${encodeURIComponent(uid)}/subscription`,
    { method: "POST", body: { plan }, timeout: 15000 },
  );
}

async function authedRequest<T>(path: string, options: RequestOptions = {}) {
  const { getFirebaseAuth } = await import("@/lib/firebase");
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Sign in required");
  const token = await user.getIdToken();
  return request<T>(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
    revalidate: false,
  });
}

export async function requestWelcomeEmail() {
  try {
    return await authedRequest<{ success?: boolean; sent?: boolean }>("/emails/welcome", {
      method: "POST",
      timeout: 15000,
    });
  } catch (error) {
    console.warn("Could not send welcome email:", error);
    return { success: false };
  }
}

export async function claimAgentClient(agentId: string) {
  return authedRequest<{ success?: boolean }>("/social/claim", {
    method: "POST",
    body: { agent_id: agentId },
  });
}

export type AgentSubscription = {
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  monthly_cents: number;
  currency: string;
  renews: boolean;
  onboarded: boolean;
  domain: string;
  checkout_session_id: string;
};

export async function fetchAgentSubscription() {
  const data = await authedRequest<{ subscription: AgentSubscription | null }>(
    "/agent-sites/subscription",
  );
  return data.subscription;
}

export async function cancelAgentSubscription() {
  return authedRequest<AgentSubscription>("/agent-sites/subscription/cancel", { method: "POST" });
}

export async function resumeAgentSubscription() {
  return authedRequest<AgentSubscription>("/agent-sites/subscription/resume", { method: "POST" });
}

export async function claimAgentSubscription(sessionId: string) {
  const data = await authedRequest<{ subscription: AgentSubscription | null }>(
    "/agent-sites/subscription/claim",
    { method: "POST", body: { session_id: sessionId } },
  );
  return data.subscription;
}

export async function fetchAgentClients() {
  const data = await authedRequest<{ clients?: Array<Record<string, unknown>> }>("/social/clients");
  return data.clients || [];
}

export async function confirmAgentClient(clientId: string) {
  return authedRequest("/social/clients/confirm", { method: "POST", body: { client_id: clientId } });
}

export async function declineAgentClient(clientId: string) {
  return authedRequest("/social/clients/decline", { method: "POST", body: { client_id: clientId } });
}

export async function fetchClientFavoritesForAgent(clientId: string) {
  const data = await authedRequest<{ properties?: Property[] }>(
    `/agents/clients/${encodeURIComponent(clientId)}/favorites`,
  );
  return data.properties || [];
}

export async function createScheduledViewing(payload: {
  propertyId: string;
  slots: string[];
  address?: string | null;
}) {
  return authedRequest("/viewings", {
    method: "POST",
    body: {
      property_id: payload.propertyId,
      slots: payload.slots,
      address: payload.address || null,
    },
  });
}

export async function fetchMyViewings() {
  const data = await authedRequest<{ viewings?: Array<Record<string, unknown>> }>("/viewings");
  return data.viewings || [];
}

export async function confirmScheduledViewing(viewingId: string, slot: string) {
  return authedRequest(`/viewings/${encodeURIComponent(viewingId)}/confirm`, {
    method: "POST",
    body: { slot },
  });
}

export async function counterScheduledViewing(viewingId: string, slot: string) {
  return authedRequest(`/viewings/${encodeURIComponent(viewingId)}/counter`, {
    method: "POST",
    body: { slot },
  });
}

export async function acceptViewingCounter(viewingId: string) {
  return authedRequest(`/viewings/${encodeURIComponent(viewingId)}/accept`, { method: "POST" });
}

export async function resolvePostPid(pid: string) {
  return authedRequest<{ found: boolean; property: Property | null }>("/posts/resolve-pid", {
    method: "POST",
    body: { pid },
  });
}

export async function reportOpenHouse(data: {
  openHouseId: string;
  propertyId?: string | null;
  address?: string | null;
  message: string;
}) {
  return authedRequest<{ success?: boolean; message?: string }>("/reports/open-house", {
    method: "POST",
    body: {
      open_house_id: data.openHouseId,
      property_id: data.propertyId || null,
      address: data.address || null,
      message: data.message,
    },
  });
}

export async function submitSupport(data: { category: string; message: string }) {
  return authedRequest<{ success?: boolean; message?: string }>("/support", {
    method: "POST",
    body: { category: data.category, message: data.message },
  });
}

export async function fetchTodayActivity(limit = 12) {
  const params = new URLSearchParams();
  params.set("recent_only", "true");
  params.set("include_listed", "true");
  params.set("include_price", "true");
  params.set("include_pending", "false");
  params.set("include_sold", "false");
  params.set("limit", String(limit));
  const data = await request<{ properties?: Property[] }>(`/feed?${params.toString()}`, {
    revalidate: 60,
  });
  return data.properties || [];
}

export async function refreshSeenProperties() {
  try {
    return await authedRequest<{ success?: boolean }>("/users/me/seen/refresh", {
      method: "POST",
      timeout: 10000,
    });
  } catch (error) {
    console.warn("Could not refresh seen properties:", error);
    return { success: false };
  }
}
