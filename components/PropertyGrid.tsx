"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  favoriteProperty,
  fetchFeed,
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
  buildPropertyDetailHref,
  clearPropertiesListState,
  markPropertiesListRestorable,
  readPropertiesListState,
  savePropertiesListState,
  shouldRestorePropertiesList,
} from "@/lib/navigationState";
import { useAuth } from "@/components/AuthProvider";
import GlassButton from "@/components/GlassButton";
import PropertyCard from "@/components/PropertyCard";
import styles from "@/components/PropertyGrid.module.css";

type PropertyGridProps = {
  initialProperties: Property[];
  initialCursor: string | null;
  initialHasMore: boolean;
  initialError?: string | null;
};

export default function PropertyGrid({
  initialProperties,
  initialCursor,
  initialHasMore,
  initialError = null,
}: PropertyGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restoredRef = useRef(false);
  const { user } = useAuth();
  const [properties, setProperties] = useState(initialProperties);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

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
    setProperties(saved.properties);
    setCursor(saved.cursor);
    setHasMore(saved.hasMore);

    if (searchParams.get("restore") === "1") {
      router.replace("/properties", { scroll: false });
    }

    requestAnimationFrame(() => {
      window.scrollTo(0, saved.scrollY);
    });
  }, [router, searchParams]);

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
      const data = await fetchFeed({
        cursor,
        firebaseUid: user?.uid || null,
      });
      setProperties((current) => {
        const seen = new Set(current.map(getPropertyId));
        const incoming = data.properties.filter((item) => !seen.has(getPropertyId(item)));
        return [...current, ...incoming];
      });
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (loadError) {
      console.error("Error loading more properties:", loadError);
      setError("Could not load more properties. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, user]);

  if (properties.length === 0 && !loadingMore) {
    return (
      <div className={styles.status}>
        <p>{error || "No properties are available right now."}</p>
        {error ? (
          <GlassButton title="Try again" onClick={loadMore} />
        ) : null}
      </div>
    );
  }

  return (
    <section className={styles.section} aria-label="Property listings">
      <div className={styles.grid}>
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
      {error ? <p className={`${styles.status} ${styles.error}`}>{error}</p> : null}
      {hasMore ? (
        <div className={styles.loadMore}>
          <GlassButton title="Load more" onClick={loadMore} loading={loadingMore} />
        </div>
      ) : null}
    </section>
  );
}
