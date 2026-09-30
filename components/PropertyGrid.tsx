"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  favoriteProperty,
  fetchFeed,
  fetchMapSearch,
  fetchPropertiesByIds,
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
import {
  DEFAULT_BROWSE_FILTERS,
  browseFiltersActive,
  browseFiltersToSearchParams,
  parseBrowseFilters,
  sortProperties,
  sortSearchHits,
  toMapSearchFilters,
  type PropertyBrowseFilters,
  type PricedSearchHit,
} from "@/lib/propertyBrowse";
import { FEED_PAGE_SIZE } from "@/lib/site";
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
  initialError?: string | null;
};

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
      const next = new URLSearchParams(searchParams.toString());
      next.delete("restore");
      const query = next.toString();
      router.replace(query ? `/properties?${query}` : "/properties", { scroll: false });
    }

    requestAnimationFrame(() => {
      window.scrollTo(0, saved.scrollY);
    });
  }, [onRestore, router, searchParams]);

  return null;
}

function PropertyGridInner({
  initialProperties,
  initialCursor,
  initialHasMore,
  initialError = null,
}: PropertyGridProps) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const filters = useMemo(() => parseBrowseFilters(searchParams), [searchParams]);
  const [properties, setProperties] = useState(() =>
    sortProperties(initialProperties, filters.sort),
  );
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [matchHits, setMatchHits] = useState<PricedSearchHit[] | null>(null);
  const [matchTotal, setMatchTotal] = useState(0);
  const [matchTruncated, setMatchTruncated] = useState(false);
  const [hydratedCount, setHydratedCount] = useState(0);
  const searchRequestRef = useRef<AbortController | null>(null);
  const skipNextSearchRef = useRef(false);
  const wasFilteredRef = useRef(browseFiltersActive(filters));
  const sortRef = useRef(filters.sort);

  const filteredMode = browseFiltersActive(filters);

  const syncUrl = useCallback(
    (nextFilters: PropertyBrowseFilters) => {
      const params = browseFiltersToSearchParams(nextFilters);
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `/properties?${query}` : "/properties", { scroll: false });
      });
    },
    [router],
  );

  const handleRestore = useCallback((saved: PropertiesListState) => {
    skipNextSearchRef.current = true;
    setProperties(saved.properties);
    setCursor(saved.cursor);
    setHasMore(saved.hasMore);
    setMatchHits(null);
    setHydratedCount(saved.properties.length);
  }, []);

  const prepareReturnToList = useCallback(() => {
    savePropertiesListState({
      properties,
      cursor,
      hasMore,
      scrollY: window.scrollY,
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

  const resetToFeed = useCallback(
    (sort = sortRef.current) => {
      searchRequestRef.current?.abort();
      setMatchHits(null);
      setMatchTotal(0);
      setMatchTruncated(false);
      setHydratedCount(0);
      setProperties(sortProperties(initialProperties, sort));
      setCursor(initialCursor);
      setHasMore(initialHasMore);
      setError(initialError);
      setSearching(false);
    },
    [initialCursor, initialError, initialHasMore, initialProperties],
  );

  const runSearch = useCallback(async (nextFilters: PropertyBrowseFilters) => {
    searchRequestRef.current?.abort();
    const controller = new AbortController();
    searchRequestRef.current = controller;
    setSearching(true);
    setError(null);
    setLoadingMore(false);

    try {
      const response = await fetchMapSearch(
        {
          q: nextFilters.q,
          filters: toMapSearchFilters(nextFilters),
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;

      const hits = sortSearchHits(
        response.properties.map((item) => ({
          id: item.id,
          price: item.price,
        })),
        nextFilters.sort,
      );
      setMatchHits(hits);
      setMatchTotal(response.total);
      setMatchTruncated(response.truncated);
      setCursor(null);

      if (hits.length === 0) {
        setProperties([]);
        setHasMore(false);
        setHydratedCount(0);
        return;
      }

      const firstIds = hits.slice(0, FEED_PAGE_SIZE).map((hit) => hit.id);
      const details = await fetchPropertiesByIds(firstIds, { signal: controller.signal });
      if (controller.signal.aborted) return;

      const byId = new Map(details.map((property) => [getPropertyId(property), property]));
      const ordered = firstIds
        .map((id) => byId.get(id))
        .filter((property): property is Property => Boolean(property));

      setProperties(ordered);
      setHydratedCount(firstIds.length);
      setHasMore(hits.length > firstIds.length);
    } catch (loadError) {
      if ((loadError as Error)?.name === "AbortError") return;
      console.error("Error searching properties:", loadError);
      setError("Could not search properties. Please try again.");
      setProperties([]);
      setMatchHits([]);
      setHasMore(false);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, []);

  useEffect(() => {
    sortRef.current = filters.sort;

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    let cancelled = false;
    const active = browseFiltersActive(filters);

    const run = () => {
      if (cancelled) return;

      if (!active) {
        if (wasFilteredRef.current) {
          wasFilteredRef.current = false;
          resetToFeed(filters.sort);
        }
        return;
      }

      wasFilteredRef.current = true;
      void runSearch(filters);
    };

    queueMicrotask(run);

    return () => {
      cancelled = true;
      searchRequestRef.current?.abort();
    };
  }, [filters, resetToFeed, runSearch]);

  const visibleProperties = useMemo(() => {
    if (matchHits) return properties;
    return sortProperties(properties, filters.sort);
  }, [filters.sort, matchHits, properties]);

  const handleFiltersChange = useCallback(
    (next: PropertyBrowseFilters) => {
      syncUrl(next);
    },
    [syncUrl],
  );

  const handleClearFilters = useCallback(() => {
    syncUrl({ ...DEFAULT_BROWSE_FILTERS, sort: filters.sort });
  }, [filters.sort, syncUrl]);

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

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || searching) return;
    setLoadingMore(true);
    setError(null);

    try {
      if (matchHits) {
        const nextIds = matchHits
          .slice(hydratedCount, hydratedCount + FEED_PAGE_SIZE)
          .map((hit) => hit.id);
        if (nextIds.length === 0) {
          setHasMore(false);
          return;
        }
        const details = await fetchPropertiesByIds(nextIds);
        const byId = new Map(details.map((property) => [getPropertyId(property), property]));
        const ordered = nextIds
          .map((id) => byId.get(id))
          .filter((property): property is Property => Boolean(property));
        setProperties((current) => [...current, ...ordered]);
        const nextHydrated = hydratedCount + nextIds.length;
        setHydratedCount(nextHydrated);
        setHasMore(nextHydrated < matchHits.length);
        return;
      }

      const data = await fetchFeed({
        cursor,
        firebaseUid: user?.uid || null,
      });
      setProperties((current) => {
        const seen = new Set(current.map(getPropertyId));
        const incoming = data.properties.filter((item) => !seen.has(getPropertyId(item)));
        return sortProperties([...current, ...incoming], filters.sort);
      });
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (loadError) {
      console.error("Error loading more properties:", loadError);
      setError("Could not load more properties. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [
    cursor,
    filters.sort,
    hasMore,
    hydratedCount,
    loadingMore,
    matchHits,
    searching,
    user,
  ]);

  const resultLabel = useMemo(() => {
    if (searching) return "Searching…";
    if (filteredMode) {
      if (matchHits && matchHits.length === 0) return "No homes match";
      const total = matchTruncated ? `${matchTotal}+` : String(matchTotal || matchHits?.length || 0);
      return `${total} home${matchTotal === 1 ? "" : "s"} match`;
    }
    if (visibleProperties.length === 0) return "No homes available";
    return hasMore ? `${visibleProperties.length}+ homes` : `${visibleProperties.length} homes`;
  }, [
    filteredMode,
    hasMore,
    matchHits,
    matchTotal,
    matchTruncated,
    searching,
    visibleProperties.length,
  ]);

  return (
    <div className={styles.browser}>
      <PropertyListRestore onRestore={handleRestore} />
      <PropertyFilters
        filters={filters}
        resultLabel={resultLabel}
        searching={searching}
        onChange={handleFiltersChange}
        onClear={handleClearFilters}
      />

      {visibleProperties.length === 0 && !loadingMore && !searching ? (
        <div className={styles.status}>
          <p>
            {error ||
              (filteredMode
                ? "Try a broader search or clear a filter."
                : "No properties are available right now.")}
          </p>
          {error ? (
            <GlassButton
              title="Try again"
              onClick={() => void (filteredMode ? runSearch(filters) : loadMore())}
            />
          ) : null}
          {filteredMode && !error ? (
            <GlassButton title="Clear filters" onClick={handleClearFilters} />
          ) : null}
        </div>
      ) : (
        <section className={styles.section} aria-label="Property listings">
          {searching && visibleProperties.length === 0 ? (
            <div className={styles.status}>
              <div className={styles.spinner} aria-hidden="true" />
              <p>Finding homes…</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {visibleProperties.map((property) => {
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
          )}
          {error ? <p className={`${styles.status} ${styles.error}`}>{error}</p> : null}
          {hasMore ? (
            <div className={styles.loadMore}>
              <GlassButton title="Load more" onClick={loadMore} loading={loadingMore || searching} />
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

export default function PropertyGrid(props: PropertyGridProps) {
  return (
    <Suspense
      fallback={
        <div className={styles.status}>
          <div className={styles.spinner} aria-hidden="true" />
          <p>Loading homes…</p>
        </div>
      }
    >
      <PropertyGridInner {...props} />
    </Suspense>
  );
}
