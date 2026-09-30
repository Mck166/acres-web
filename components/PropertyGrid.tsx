"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  favoriteProperty,
  fetchFeed,
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
  LISTING_PAGE_SIZE,
  describeListings,
  listingQueryKey,
  orderProperties,
  type ListingQuery,
  type ListingResult,
} from "@/lib/listingBrowse";
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
import styles from "@/components/PropertyGrid.module.css";

type PropertyGridProps = {
  query: ListingQuery;
  result: ListingResult;
};

function mergeProperties(current: Property[], incoming: Property[]) {
  const seen = new Set(current.map(getPropertyId));
  return [...current, ...incoming.filter((item) => !seen.has(getPropertyId(item)))];
}

function PropertyListRestore({
  queryKey,
  onRestore,
}: {
  queryKey: string;
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
    if (saved && saved.queryKey === queryKey) {
      onRestore(saved);
    }
    clearPropertiesListState();

    if (searchParams.get("restore") === "1") {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("restore");
      const qs = next.toString();
      router.replace(qs ? `/properties?${qs}` : "/properties", { scroll: false });
    }

    if (saved && saved.queryKey === queryKey) {
      requestAnimationFrame(() => {
        window.scrollTo(0, saved.scrollY);
      });
    }
  }, [onRestore, queryKey, router, searchParams]);

  return null;
}

export default function PropertyGrid({ query, result }: PropertyGridProps) {
  const router = useRouter();
  const { user } = useAuth();
  const queryKey = listingQueryKey(query);
  const [properties, setProperties] = useState(result.properties);
  const [cursor, setCursor] = useState(result.cursor);
  const [hasMore, setHasMore] = useState(result.hasMore);
  const [orderedIds, setOrderedIds] = useState(result.orderedIds);
  const [nextIndex, setNextIndex] = useState(result.nextIndex);
  const [mode, setMode] = useState(result.mode);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(result.error);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const handleRestore = useCallback((saved: PropertiesListState) => {
    setProperties(saved.properties);
    setCursor(saved.cursor);
    setHasMore(saved.hasMore);
    setOrderedIds(saved.orderedIds);
    setNextIndex(saved.nextIndex);
    setMode(saved.mode);
    setError(null);
  }, []);

  const prepareReturnToList = useCallback(() => {
    savePropertiesListState({
      properties,
      cursor,
      hasMore,
      scrollY: window.scrollY,
      queryKey,
      mode,
      orderedIds,
      nextIndex,
    });
    markPropertiesListRestorable();
  }, [cursor, hasMore, mode, nextIndex, orderedIds, properties, queryKey]);

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

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      if (mode === "search") {
        const ids = orderedIds.slice(nextIndex, nextIndex + LISTING_PAGE_SIZE);
        const incoming = orderProperties(ids, await fetchPropertiesByIds(ids));
        const loadedThrough = nextIndex + ids.length;
        setProperties((current) => mergeProperties(current, incoming));
        setNextIndex(loadedThrough);
        setHasMore(loadedThrough < orderedIds.length);
      } else {
        const data = await fetchFeed({
          cursor,
          firebaseUid: user?.uid || null,
        });
        setProperties((current) => mergeProperties(current, data.properties));
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (loadError) {
      console.error("Error loading more properties:", loadError);
      setError("Could not load more properties. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, mode, nextIndex, orderedIds, user]);

  const summary = describeListings(query, result.total, result.truncated);
  const shown =
    result.total > properties.length
      ? `Showing ${properties.length.toLocaleString("en-CA")} of ${summary}`
      : summary;

  const restore = (
    <Suspense fallback={null}>
      <PropertyListRestore queryKey={queryKey} onRestore={handleRestore} />
    </Suspense>
  );

  return (
    <section className={styles.section} aria-label="Property listings">
      {restore}
      <div className={styles.summary}>
        <p aria-live="polite">{properties.length === 0 && error ? error : shown}</p>
        {result.truncated && properties.length > 0 ? (
          <p className={styles.note}>
            This search stops at 2,000 homes. Add a city or a tighter price to see a complete list.
          </p>
        ) : null}
      </div>

      {properties.length === 0 ? (
        <div className={styles.status}>
          <p>{error || "No homes match these filters."}</p>
          {error ? <GlassButton title="Try again" onClick={() => router.refresh()} /> : null}
        </div>
      ) : (
        <div className={styles.grid}>
          {properties.map((property) => {
            const id = getPropertyId(property);
            return (
              <PropertyCard
                key={id || JSON.stringify(property).slice(0, 40)}
                property={property}
                isFavorite={Boolean(user) && favoriteIds.has(id)}
                onFavorite={handleFavorite}
                detailHref={buildPropertyDetailHref(id, { from: "properties", listQuery: queryKey })}
                onNavigate={prepareReturnToList}
              />
            );
          })}
        </div>
      )}

      {error && properties.length > 0 ? (
        <p className={`${styles.status} ${styles.error}`}>{error}</p>
      ) : null}
      {hasMore ? (
        <div className={styles.loadMore}>
          <GlassButton title="Show more homes" onClick={loadMore} loading={loadingMore} />
        </div>
      ) : null}
    </section>
  );
}
