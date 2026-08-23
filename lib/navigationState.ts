import type { Property } from "@/lib/api";

export const PROPERTIES_LIST_STATE_KEY = "acres:properties-list";

export type PropertiesListState = {
  properties: Property[];
  cursor: string | null;
  hasMore: boolean;
  scrollY: number;
};

export type MapViewParams = {
  lng: number;
  lat: number;
  zoom: number;
  property?: string | null;
};

export function savePropertiesListState(state: PropertiesListState) {
  try {
    sessionStorage.setItem(PROPERTIES_LIST_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors.
  }
}

export function readPropertiesListState(): PropertiesListState | null {
  try {
    const raw = sessionStorage.getItem(PROPERTIES_LIST_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PropertiesListState;
  } catch {
    return null;
  }
}

export function clearPropertiesListState() {
  try {
    sessionStorage.removeItem(PROPERTIES_LIST_STATE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function markPropertiesListRestorable() {
  window.history.replaceState(
    { ...window.history.state, restorePropertiesList: true },
    "",
  );
}

export function shouldRestorePropertiesList(searchParams: URLSearchParams) {
  return (
    searchParams.get("restore") === "1" ||
    window.history.state?.restorePropertiesList === true
  );
}

export function parseMapViewParams(searchParams: URLSearchParams): MapViewParams | null {
  const lng = Number.parseFloat(searchParams.get("lng") ?? "");
  const lat = Number.parseFloat(searchParams.get("lat") ?? "");
  const zoom = Number.parseFloat(searchParams.get("zoom") ?? "");
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(zoom)) {
    return null;
  }

  const property = searchParams.get("property");
  return { lng, lat, zoom, property: property || null };
}

export function buildMapHref(params: MapViewParams) {
  const search = new URLSearchParams({
    lng: params.lng.toFixed(6),
    lat: params.lat.toFixed(6),
    zoom: params.zoom.toFixed(2),
  });
  if (params.property) {
    search.set("property", params.property);
  }
  return `/map?${search.toString()}`;
}

export function buildPropertyDetailHref(
  propertyId: string,
  context: { from: "map"; map: Omit<MapViewParams, "property"> } | { from: "properties" },
) {
  const base = `/properties/${encodeURIComponent(propertyId)}`;
  const search = new URLSearchParams({ from: context.from });

  if (context.from === "map") {
    search.set("lng", context.map.lng.toFixed(6));
    search.set("lat", context.map.lat.toFixed(6));
    search.set("zoom", context.map.zoom.toFixed(2));
  }

  return `${base}?${search.toString()}`;
}

export function buildPropertyBackHref(propertyId: string, searchParams: URLSearchParams) {
  const from = searchParams.get("from");

  if (from === "map") {
    const lng = Number.parseFloat(searchParams.get("lng") ?? "");
    const lat = Number.parseFloat(searchParams.get("lat") ?? "");
    const zoom = Number.parseFloat(searchParams.get("zoom") ?? "");

    if (Number.isFinite(lng) && Number.isFinite(lat) && Number.isFinite(zoom)) {
      return {
        href: buildMapHref({ lng, lat, zoom, property: propertyId }),
        label: "Back to map",
      };
    }

    return { href: "/map", label: "Back to map" };
  }

  if (from === "properties") {
    return { href: "/properties?restore=1", label: "Back to listings" };
  }

  return { href: "/properties", label: "Back to listings" };
}
