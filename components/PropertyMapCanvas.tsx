"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MapGL, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type MarkerEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import { fetchMapProperties, fetchMapSearch, fetchPropertyById, type MapProperty, type MapSearchFilters, type Property } from "@/lib/api";
import {
  clusterPins,
  listingKind,
  pinLabel,
  pinTone,
  type PinCluster,
} from "@/lib/mapPins";
import {
  formatBathLabel,
  formatBedLabel,
  getBaths,
  getBeds,
  getPropertyAddress,
  getPropertyPhotos,
  getPropertyPrice,
} from "@/lib/properties";
import {
  buildMapHref,
  buildPropertyDetailHref,
  parseMapViewParams,
} from "@/lib/navigationState";
import PropertyImage from "@/components/PropertyImage";
import MapSearchPanel from "@/components/MapSearchPanel";
import { loadAcresMapStyle } from "@/lib/mapStyle";
import {
  buildListingLots,
  buildLotlessListings,
  buildNeutralLots,
  fetchParcelFabric,
  fetchParcelsByPid,
  normalizePid,
  type ParcelFabric,
  type ParcelGeometry,
} from "@/lib/parcels";
import styles from "@/components/PropertyMap.module.css";
import type { StyleSpecification } from "maplibre-gl";

const INITIAL_VIEW = {
  longitude: -63.5752,
  latitude: 44.6488,
  zoom: 14,
};

const MIN_ZOOM = 6;
const MAX_ZOOM = 18;
/** Below this the API only returns last-24h activity, so we tell the user to zoom. */
const QUIET_MIN_ZOOM = 11;
const LOT_MIN_ZOOM = 14;
const LOT_LABEL_MIN_ZOOM = 16;
/** A viewport-wide parcel query only stays under the service's 2000 feature cap this far in. */
const FABRIC_MIN_ZOOM = 16;
const FETCH_DEBOUNCE_MS = 300;
const BOUNDS_PAD = 0.12;
const SEARCH_FLY_ZOOM = 16;

const FOR_SALE = "#1f6fd0";
const FOR_SALE_DARK = "#1a5cad";
const SOLD = "#c62828";
const SOLD_DARK = "#a92120";
const NEUTRAL_LOT = "#b4ada2";

/** Keep the camera over Nova Scotia and nearby water so zoom-out never hits empty globe/world. */
const MAX_BOUNDS: [number, number, number, number] = [-70.4, 41.7, -55.6, 48.9];

/**
 * MapLibre derives this from `import.meta.url`, which Turbopack cannot rewrite, so it
 * falls back to `new Worker("")` and loads the page itself as the worker. Without a
 * working worker no tile is ever parsed and the map stays blank. The files are copied
 * into public/maplibre by scripts/copy-maplibre-worker.mjs.
 */
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function pinBadge(property: MapProperty) {
  if (property.pin === "listed") return { text: "NEW", className: styles.badgeNew };
  if (property.pin === "price") return { text: "NEW PRICE", className: styles.badgePrice };
  return null;
}

function padBounds(bounds: {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  zoom: number;
}) {
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.002);
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.002);
  return {
    minLat: bounds.minLat - latSpan * BOUNDS_PAD,
    maxLat: bounds.maxLat + latSpan * BOUNDS_PAD,
    minLon: bounds.minLon - lonSpan * BOUNDS_PAD,
    maxLon: bounds.maxLon + lonSpan * BOUNDS_PAD,
    zoom: bounds.zoom,
  };
}

export default function PropertyMapCanvas() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapRef = useRef<MapRef>(null);
  const debounceRef = useRef<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const searchRequestRef = useRef<AbortController | null>(null);
  const parcelRequestRef = useRef<AbortController | null>(null);
  const fabricRequestRef = useRef<AbortController | null>(null);
  const ignoreMapClickRef = useRef(false);
  const restoredPreviewRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const searchActiveRef = useRef(false);
  const urlView = parseMapViewParams(searchParams);

  const [mapStyle, setMapStyle] = useState<StyleSpecification | string | null>(null);
  const [properties, setProperties] = useState<MapProperty[]>([]);
  const [fabric, setFabric] = useState<ParcelFabric>({
    type: "FeatureCollection",
    features: [],
  });
  const [parcels, setParcels] = useState<Map<string, ParcelGeometry>>(new Map());
  const [clusters, setClusters] = useState<PinCluster[]>([]);
  /** Bumped on every move so clusters re-form against the new screen positions. */
  const [viewTick, setViewTick] = useState(0);
  const [zoom, setZoom] = useState(urlView?.zoom ?? INITIAL_VIEW.zoom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchEmpty, setSearchEmpty] = useState(false);
  const [searchCount, setSearchCount] = useState(0);
  const [preview, setPreview] = useState<{
    id: string;
    property: Property | null;
    loading: boolean;
  } | null>(null);

  const initialViewState = useMemo(
    () =>
      urlView
        ? { longitude: urlView.lng, latitude: urlView.lat, zoom: urlView.zoom }
        : INITIAL_VIEW,
    [urlView],
  );

  const syncMapUrl = useCallback(
    (propertyId?: string | null) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const center = map.getCenter();
      router.replace(
        buildMapHref({
          lng: center.lng,
          lat: center.lat,
          zoom: map.getZoom(),
          property: propertyId ?? null,
        }),
        { scroll: false },
      );
    },
    [router],
  );

  const loadViewport = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const nextZoom = map.getZoom();
    setZoom(nextZoom);
    setViewTick((tick) => tick + 1);
    syncMapUrl(selectedIdRef.current ?? searchParams.get("property"));

    if (searchActiveRef.current) return;

    const bounds = map.getBounds();

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);

    fetchMapProperties(
      padBounds({
        minLat: bounds.getSouth(),
        minLon: bounds.getWest(),
        maxLat: bounds.getNorth(),
        maxLon: bounds.getEast(),
        zoom: nextZoom,
      }),
      { signal: controller.signal },
    )
      .then((next) => {
        setProperties(next);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isAbortError(loadError)) return;
        console.error("Error loading map properties:", loadError);
        setError("Could not load listings for this area.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [searchParams, syncMapUrl]);

  const scheduleFetch = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(loadViewport, FETCH_DEBOUNCE_MS);
  }, [loadViewport]);

  useEffect(() => {
    loadAcresMapStyle()
      .then(setMapStyle)
      .catch((loadError: unknown) => {
        console.error("Error loading map style:", loadError);
        setMapStyle("https://tiles.openfreemap.org/styles/liberty");
      });
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      requestRef.current?.abort();
      searchRequestRef.current?.abort();
      parcelRequestRef.current?.abort();
      fabricRequestRef.current?.abort();
    };
  }, []);

  // Coloured lots: ask the parcel service only for the PIDs we are about to draw.
  useEffect(() => {
    if (zoom < LOT_MIN_ZOOM) return;

    const pids = properties.map((property) => property.pid).filter(Boolean);
    if (pids.length === 0) return;

    parcelRequestRef.current?.abort();
    const controller = new AbortController();
    parcelRequestRef.current = controller;

    fetchParcelsByPid(pids, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setParcels(new Map(next));
      })
      .catch((loadError: unknown) => {
        if (isAbortError(loadError)) return;
        console.error("Error loading parcels:", loadError);
      });

    return () => controller.abort();
  }, [properties, zoom]);

  // Neutral surrounding lot lines, only once the viewport is small enough to fetch them.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    const bounds = map?.getBounds();

    fabricRequestRef.current?.abort();
    const controller = new AbortController();
    fabricRequestRef.current = controller;

    if (zoom < FABRIC_MIN_ZOOM || !bounds) {
      setFabric({ type: "FeatureCollection", features: [] });
      return () => controller.abort();
    }

    fetchParcelFabric(
      {
        minLon: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLon: bounds.getEast(),
        maxLat: bounds.getNorth(),
      },
      controller.signal,
    )
      .then((next) => {
        if (!controller.signal.aborted) setFabric(next);
      })
      .catch((loadError: unknown) => {
        if (isAbortError(loadError)) return;
        console.error("Error loading parcel fabric:", loadError);
      });

    return () => controller.abort();
  }, [zoom, viewTick]);

  const openPreview = useCallback(
    (id: string, fromMarker = false) => {
      if (fromMarker) ignoreMapClickRef.current = true;
      setPreview({ id, property: null, loading: true });
      syncMapUrl(id);
      fetchPropertyById(id).then((property) => {
        setPreview((current) => (current?.id === id ? { id, property, loading: false } : current));
      });
    },
    [syncMapUrl],
  );

  const closePreview = useCallback(() => {
    setPreview(null);
    syncMapUrl(null);
  }, [syncMapUrl]);

  const frameSearchResults = useCallback((results: MapProperty[]) => {
    const map = mapRef.current?.getMap();
    if (!map || results.length === 0) return;

    if (results.length === 1) {
      map.flyTo({
        center: [results[0].lon, results[0].lat],
        zoom: Math.max(map.getZoom(), SEARCH_FLY_ZOOM),
        duration: 800,
      });
      return;
    }

    const minLat = Math.min(...results.map((item) => item.lat));
    const maxLat = Math.max(...results.map((item) => item.lat));
    const minLon = Math.min(...results.map((item) => item.lon));
    const maxLon = Math.max(...results.map((item) => item.lon));
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      {
        padding: { top: 96, bottom: 96, left: 48, right: 48 },
        maxZoom: SEARCH_FLY_ZOOM,
        duration: 800,
      },
    );
  }, []);

  const handleSearch = useCallback(
    (query: { q: string; filters: MapSearchFilters }) => {
      searchRequestRef.current?.abort();
      requestRef.current?.abort();
      const controller = new AbortController();
      searchRequestRef.current = controller;
      setSearching(true);
      setError(null);
      setSearchEmpty(false);

      fetchMapSearch(query, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) return;
          searchActiveRef.current = true;
          setSearchActive(true);
          setSearchOpen(false);
          setSearching(false);
          setProperties(response.properties);
          setSearchCount(response.properties.length);
          setSearchEmpty(response.properties.length === 0);

          if (response.properties.length === 1) {
            openPreview(response.properties[0].id);
          } else {
            closePreview();
          }
          frameSearchResults(response.properties);
        })
        .catch((loadError: unknown) => {
          if (isAbortError(loadError)) return;
          console.error("Error searching listings:", loadError);
          setSearching(false);
          setError("Could not search listings.");
        });
    },
    [closePreview, frameSearchResults, openPreview],
  );

  const handleClearSearch = useCallback(() => {
    searchRequestRef.current?.abort();
    searchActiveRef.current = false;
    setSearchActive(false);
    setSearchEmpty(false);
    setSearchCount(0);
    setSearching(false);
    setSearchOpen(false);
    closePreview();
    loadViewport();
  }, [closePreview, loadViewport]);

  const selectedId = preview?.id ?? null;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (restoredPreviewRef.current || !urlView?.property) return;
    restoredPreviewRef.current = true;
    openPreview(urlView.property);
  }, [openPreview, urlView?.property]);

  const detailHref = useMemo(() => {
    if (!selectedId) return "";

    const map = mapRef.current?.getMap();
    if (!map) {
      return buildPropertyDetailHref(selectedId, {
        from: "map",
        map: {
          lng: urlView?.lng ?? INITIAL_VIEW.longitude,
          lat: urlView?.lat ?? INITIAL_VIEW.latitude,
          zoom: urlView?.zoom ?? INITIAL_VIEW.zoom,
        },
      });
    }

    const center = map.getCenter();
    return buildPropertyDetailHref(selectedId, {
      from: "map",
      map: {
        lng: center.lng,
        lat: center.lat,
        zoom: map.getZoom(),
      },
    });
  }, [selectedId, urlView, viewTick]);

  const activityPins = useMemo(
    () =>
      searchActive
        ? properties
        : properties.filter((property) => Boolean(property.pin) && listingKind(property) !== "sold"),
    [properties, searchActive],
  );

  // Clustering needs the map's current projection, so it runs after render, not during it.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    setClusters(clusterPins(map ? (lon, lat) => map.project([lon, lat]) : null, activityPins));
  }, [activityPins, viewTick]);

  const lotListings = useMemo(
    () =>
      properties.map((property) => ({
        id: property.id,
        lon: property.lon,
        lat: property.lat,
        pid: property.pid,
        kind: listingKind(property),
        label: property.priceLabel || "",
        selected: selectedId === property.id,
      })),
    [properties, selectedId],
  );

  const lotGeoJson = useMemo(
    () => buildListingLots(parcels, lotListings),
    [parcels, lotListings],
  );

  const lotlessGeoJson = useMemo(
    () => buildLotlessListings(parcels, lotListings),
    [parcels, lotListings],
  );

  const neutralGeoJson = useMemo(() => {
    const colouredPids = new Set(
      properties
        .map((property) => normalizePid(property.pid))
        .filter((pid): pid is string => Boolean(pid)),
    );
    return buildNeutralLots(fabric, colouredPids);
  }, [fabric, properties]);

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (ignoreMapClickRef.current) {
        ignoreMapClickRef.current = false;
        return;
      }

      const feature = event.features?.[0];
      const id = String(feature?.properties?.id ?? "");
      if (id) {
        openPreview(id);
        return;
      }
      closePreview();
    },
    [closePreview, openPreview],
  );

  const handleClusterClick = useCallback(
    (cluster: PinCluster) => (event: MarkerEvent<MouseEvent>) => {
      event.originalEvent.stopPropagation();

      if (cluster.items.length === 1) {
        openPreview(cluster.items[0].id, true);
        return;
      }

      ignoreMapClickRef.current = true;
      const map = mapRef.current?.getMap();
      map?.easeTo({
        center: [cluster.lon, cluster.lat],
        zoom: Math.min(MAX_ZOOM, map.getZoom() + 2),
        duration: 400,
      });
    },
    [openPreview],
  );

  const selectedProperty = preview?.property ?? null;
  const cardLoading = Boolean(preview?.loading);
  const selectedMapProperty = properties.find((property) => property.id === selectedId) || null;
  const photos = selectedProperty ? getPropertyPhotos(selectedProperty) : [];
  const photo = photos[0];
  const price = selectedProperty
    ? getPropertyPrice(selectedProperty)
    : selectedMapProperty?.priceLabel || "Price not available";
  const address = selectedProperty ? getPropertyAddress(selectedProperty) : "Loading address…";
  const beds = selectedProperty ? getBeds(selectedProperty) : null;
  const baths = selectedProperty ? getBaths(selectedProperty) : null;

  if (!mapStyle) {
    return <div className={styles.page} />;
  }

  return (
    <div className={styles.page}>
      <MapGL
        ref={mapRef}
        initialViewState={initialViewState}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={MAX_BOUNDS}
        dragRotate={false}
        touchPitch={false}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{
          compact: true,
          customAttribution: "Property lines © Province of Nova Scotia",
        }}
        interactiveLayerIds={["listing-lot-fills", "lotless-listings"]}
        cursor={cursor}
        onLoad={loadViewport}
        onMoveEnd={scheduleFetch}
        onClick={handleMapClick}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
      >
        <Source id="neutral-lots" type="geojson" data={neutralGeoJson}>
          <Layer
            id="neutral-lot-outlines"
            type="line"
            minzoom={FABRIC_MIN_ZOOM}
            paint={{
              "line-color": NEUTRAL_LOT,
              "line-width": 0.7,
            }}
          />
        </Source>

        <Source id="listing-lots" type="geojson" data={lotGeoJson}>
          <Layer
            id="listing-lot-fills"
            type="fill"
            minzoom={LOT_MIN_ZOOM}
            paint={{
              "fill-color": ["match", ["get", "kind"], "sold", SOLD, FOR_SALE],
              "fill-opacity": ["case", [">", ["get", "selected"], 0], 0.42, 0.22],
            }}
          />
          <Layer
            id="listing-lot-outlines"
            type="line"
            minzoom={LOT_MIN_ZOOM}
            paint={{
              "line-color": ["match", ["get", "kind"], "sold", SOLD, FOR_SALE],
              "line-width": ["case", [">", ["get", "selected"], 0], 3.2, 2],
            }}
          />
          <Layer
            id="listing-lot-labels"
            type="symbol"
            minzoom={LOT_LABEL_MIN_ZOOM}
            layout={{
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Bold", "Noto Sans Regular"],
              "text-size": 11,
              "text-anchor": "center",
              "text-allow-overlap": false,
            }}
            paint={{
              "text-color": ["match", ["get", "kind"], "sold", SOLD_DARK, FOR_SALE_DARK],
              "text-halo-color": "rgba(255,255,255,0.92)",
              "text-halo-width": 1.4,
            }}
          />
        </Source>

        <Source id="lotless-listings-source" type="geojson" data={lotlessGeoJson}>
          <Layer
            id="lotless-listings"
            type="circle"
            minzoom={LOT_MIN_ZOOM}
            paint={{
              "circle-radius": ["case", [">", ["get", "selected"], 0], 9, 7],
              "circle-color": ["match", ["get", "kind"], "sold", SOLD, FOR_SALE],
              "circle-opacity": 0.85,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
        </Source>

        {clusters.map((cluster) => {
          const first = cluster.items[0];
          const count = cluster.items.length;
          const tone = pinTone(cluster.items);
          const badge = count === 1 ? pinBadge(first) : null;
          const selected =
            selectedId !== null && cluster.items.some((item) => item.id === selectedId);

          return (
            <Marker
              key={cluster.key}
              longitude={cluster.lon}
              latitude={cluster.lat}
              anchor="bottom"
              onClick={handleClusterClick(cluster)}
            >
              <span className={styles.pinWrap}>
                <button
                  type="button"
                  className={[
                    styles.pin,
                    tone === "sold" ? styles.pinSold : tone === "mixed" ? styles.pinMixed : styles.pinSale,
                    count > 1 ? styles.pinCount : "",
                    selected ? styles.pinActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {count > 1 ? count : pinLabel(first)}
                </button>
                {badge ? (
                  <span className={`${styles.badge} ${badge.className}`}>{badge.text}</span>
                ) : null}
              </span>
            </Marker>
          );
        })}

        <NavigationControl position="bottom-right" showCompass={false} />
      </MapGL>

      {loading || searching ? (
        <p className={styles.status}>{searching ? "Searching…" : "Updating listings…"}</p>
      ) : null}
      {error && !loading && !searching ? <p className={styles.status}>{error}</p> : null}
      {searchActive && searchEmpty && !searching && !error ? (
        <p className={styles.status}>No matching listings</p>
      ) : null}
      {zoom < QUIET_MIN_ZOOM && !loading && !error && !selectedId && !searchActive ? (
        <p className={styles.hint}>Zoom in to see all listings</p>
      ) : null}

      <MapSearchPanel
        open={searchOpen}
        searching={searching}
        active={searchActive}
        empty={searchEmpty}
        resultCount={searchCount}
        onToggle={() => setSearchOpen((current) => !current)}
        onClose={() => setSearchOpen(false)}
        onSearch={handleSearch}
        onClear={handleClearSearch}
      />

      {selectedId ? (
        <article className={styles.card}>
          <button
            type="button"
            className={styles.cardClose}
            onClick={closePreview}
            aria-label="Close property preview"
          >
            ×
          </button>
          <Link href={detailHref} className={styles.cardLink}>
            {photo ? (
              <PropertyImage className={styles.cardImage} src={photo} alt={address} />
            ) : (
              <div className={styles.cardPlaceholder}>
                {cardLoading ? "Loading…" : "No photo available"}
              </div>
            )}
            <div className={styles.cardBody}>
              <p className={styles.cardPrice}>{price}</p>
              <p className={styles.cardAddress}>
                {cardLoading && !selectedProperty ? "Loading address…" : address}
              </p>
              {beds || baths ? (
                <p className={styles.cardMeta}>
                  {[beds ? formatBedLabel(beds) : null, baths ? formatBathLabel(baths) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </Link>
        </article>
      ) : null}
    </div>
  );
}
