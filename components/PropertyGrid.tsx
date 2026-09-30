"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  favoriteProperty,
  refreshSeenProperties,
  type Property,
} from "@/lib/api";
import {
  addToFavorites,
  favoriteDocIdForProperty,
  getUserFavorites,
  removeFromFavorites,
} from "@/lib/firestore";
import { getPropertyId } from "@/lib/properties";
import { FEED_PAGE_SIZE } from "@/lib/site";
import {
  buildPropertiesHref,
  describePropertyFilters,
  EMPTY_PROPERTY_FILTERS,
  filtersAreActive,
  loadFilteredFeed,
  propertyMatchesFilters,
  propertyMatchesPlace,
  syncPropertyFilterUrl,
  type PropertyListFilters,
} from "@/lib/propertyFilters";
import {
  buildPropertyDetailHref,
  clearPropertiesListState,
  markPropertiesListRestorable,
  readPropertiesListState,
  savePropertiesListState,
  shouldRestorePropertiesList,
  type PropertiesListState,
} from "@/lib/navigationState";
import { useAuth } from "@/components/AuthProvider";
import GlassButton from "@/components/GlassButton";
import PropertyCard from "@/components/PropertyCard";
import PropertyFilters from "@/components/PropertyFilters";
import styles from "@/components/PropertyGrid.module.css";

type PropertyGridProps = {
  initialProperties: Property[];
  initialCursor: string | null;
  initialHasMore: boolean;
  initialTotal: number;
  initialFilters?: PropertyListFilters;
  initialError?: string | null;
};

function mergeProperties(current: Property[], incoming: Property[]) {
  const seen = new Set(current.map(getPropertyId));
  const next = incoming.filter((item) => {
    const id = getPropertyId(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...current, ...next];
}

function PropertyListRestore({
  onRestore,
}: {
  onRestore: (saved: PropertiesListState) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (!shouldRestorePropertiesList(searchParams)) {
      clearPropertiesListState();
      return;
    }

    const saved = readPropertiesListState();
    if (!saved) return;

    clearPropertiesListState();
    onRestore(saved);

    if (searchParams.get("restore") === "1") {
      router.replace(
        saved.filters ? buildPropertiesHref(saved.filters) : "/properties",
        { scroll: false },
      );
    }

    requestAnimationFrame(() => {
      window.scrollTo(0, saved.scrollY);
    });
  }, [onRestore, router, searchParams]);

  return null;
}

function resultCountLabel(count: number, total: number | null, hasMore: boolean) {
  if (total !== null) {
    return `${total.toLocaleString("en-CA")} home${total === 1 ? "" : "s"}`;
  }
  if (hasMore && count > 0) {
    return `${count.toLocaleString("en-CA")}+ homes`;
  }
  return `${count.toLocaleString("en-CA")} home${count === 1 ? "" : "s"}`;
}

export default function PropertyGrid({
  initialProperties,
  initialCursor,
  initialHasMore,
  initialTotal,
  initialFilters = EMPTY_PROPERTY_FILTERS,
  initialError = null,
}: PropertyGridProps) {
  const { user } = useAuth();
  const placeTrusted = initialProperties.every((property) =>
    propertyMatchesPlace(property, initialFilters),
  );
  const initialVisible = initialProperties.filter((property) =>
    propertyMatchesFilters(property, initialFilters),
  );
  const shouldScan =
    !initialError &&
    !placeTrusted &&
    initialHasMore &&
    initialVisible.length < FEED_PAGE_SIZE;
  const [filters, setFilters] = useState(initialFilters);
  const [properties, setProperties] = useState(initialVisible);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [totalAvailable, setTotalAvailable] = useState<number | null>(
    placeTrusted ? initialTotal : null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(shouldScan);
  const [error, setError] = useState<string | null>(initialError);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const requestId = useRef(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const runFetch = useCallback(async (
    nextFilters: PropertyListFilters,
    nextCursor: string | null,
    append: boolean,
  ) => {
    const generation = ++requestId.current;
    if (append) setLoadingMore(true);
    else setRefreshing(true);
    setError(null);

    try {
      const page = await loadFilteredFeed({
        cursor: nextCursor,
        filters: nextFilters,
      });
      if (generation !== requestId.current) return;
      setProperties((current) => (
        append ? mergeProperties(current, page.properties) : page.properties
      ));
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setTotalAvailable(page.totalAvailable);
    } catch (loadError) {
      if (generation !== requestId.current) return;
      console.error("Error loading properties:", loadError);
      setError(append
        ? "Could not load more properties. Please try again."
        : "Could not load properties. Please try again.");
    } finally {
      if (generation === requestId.current) {
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  const didFill = useRef(false);

  useEffect(() => {
    if (didFill.current) return;
    didFill.current = true;
    if (!shouldScan) return;
    void runFetch(initialFilters, initialCursor, true);
  }, [initialCursor, initialFilters, runFetch, shouldScan]);

  const handleRestore = useCallback((saved: PropertiesListState) => {
    requestId.current += 1;
    setProperties(saved.properties);
    setCursor(saved.cursor);
    setHasMore(saved.hasMore);
    setRefreshing(false);
    setLoadingMore(false);
    setTotalAvailable(null);
    if (saved.filters) setFilters(saved.filters);
  }, []);

  const prepareReturnToList = useCallback(() => {
    savePropertiesListState({
      properties,
      cursor,
      hasMore,
      scrollY: window.scrollY,
      filters: filtersRef.current,
    });
    markPropertiesListRestorable();
  }, [cursor, hasMore, properties]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    getUserFavorites(user.uid)
      .then((favorites) => {
        if (cancelled) return;
        setFavoriteIds(new Set(favorites.map((item) => item.propertyId)));
      })
      .catch((loadError) => {
        console.error("Error loading favorites:", loadError);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleFavorite = useCallback(
    async (property: Property) => {
      if (!user) return;
      const propertyId = getPropertyId(property);
      if (!propertyId) return;

      const alreadySaved = favoriteIds.has(propertyId);
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (alreadySaved) next.delete(propertyId);
        else next.add(propertyId);
        return next;
      });

      try {
        if (alreadySaved) {
          await removeFromFavorites(user.uid, favoriteDocIdForProperty(propertyId));
          await refreshSeenProperties(user.uid);
        } else {
          await addToFavorites(user.uid, propertyId);
          await favoriteProperty(propertyId, user.uid);
        }
      } catch (saveError) {
        console.error("Error updating favorite:", saveError);
        setFavoriteIds((current) => {
          const next = new Set(current);
          if (alreadySaved) next.add(propertyId);
          else next.delete(propertyId);
          return next;
        });
      }
    },
    [favoriteIds, user],
  );

  const handleFiltersChange = (next: PropertyListFilters) => {
    setFilters(next);
    setProperties([]);
    setCursor(null);
    setHasMore(false);
    setTotalAvailable(null);
    syncPropertyFilterUrl(next);
    void runFetch(next, null, false);
  };

  const handleClear = () => {
    handleFiltersChange(EMPTY_PROPERTY_FILTERS);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore || refreshing) return;
    void runFetch(filters, cursor, true);
  };

  const restore = (
    <Suspense fallback={null}>
      <PropertyListRestore onRestore={handleRestore} />
    </Suspense>
  );

  const searchingEmpty = properties.length === 0 && (refreshing || loadingMore);
  const showEmpty = properties.length === 0 && !refreshing && !loadingMore;
  const detail = filtersAreActive(filters) ? describePropertyFilters(filters) : "";

  return (
    <section className={styles.section} aria-label="Property listings">
      {restore}
      <PropertyFilters
        filters={filters}
        resultLabel={resultCountLabel(properties.length, totalAvailable, hasMore)}
        detail={detail}
        loading={refreshing || searchingEmpty}
        onChange={handleFiltersChange}
        onClear={handleClear}
      />
      {searchingEmpty ? (
        <div className={styles.status}>
          <div className={styles.spinner} aria-hidden="true" />
          <p>Finding homes…</p>
        </div>
      ) : null}
      {showEmpty ? (
        <div className={styles.status}>
          <p>
            {error
              || (filtersAreActive(filters)
                ? "No homes match these filters."
                : "No properties are available right now.")}
          </p>
          {error ? (
            <GlassButton title="Try again" onClick={() => void runFetch(filters, null, false)} />
          ) : null}
        </div>
      ) : null}
      {properties.length > 0 ? (
        <div className={`${styles.grid}${refreshing ? ` ${styles.gridBusy}` : ""}`}>
          {properties.map((property) => {
            const id = getPropertyId(property);
            return (
              <PropertyCard
                key={id || JSON.stringify(property).slice(0, 40)}
                property={property}
                isFavorite={Boolean(user) && favoriteIds.has(id)}
                onFavorite={handleFavorite}
                detailHref={buildPropertyDetailHref(id, { from: "properties" })}
                onNavigate={prepareReturnToList}
              />
            );
          })}
        </div>
      ) : null}
      {error && properties.length > 0 ? (
        <p className={`${styles.status} ${styles.error}`}>{error}</p>
      ) : null}
      {hasMore && properties.length > 0 ? (
        <div className={styles.loadMore}>
          <GlassButton title="Load more" onClick={loadMore} loading={loadingMore} />
        </div>
      ) : null}
    </section>
  );
}
