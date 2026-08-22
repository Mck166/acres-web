"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchPropertiesByIds, refreshSeenProperties, type Property } from "@/lib/api";
import {
  favoriteDocIdForProperty,
  getUserFavorites,
  removeFromFavorites,
  type FavoriteRecord,
} from "@/lib/firestore";
import { getPropertyId } from "@/lib/properties";
import { useAuth } from "@/components/AuthProvider";
import GlassButton from "@/components/GlassButton";
import PropertyCard from "@/components/PropertyCard";
import styles from "@/components/FavoritesView.module.css";

export default function FavoritesView() {
  const { user, loading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFavorites = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const records = await getUserFavorites(uid);
      setFavorites(records);
      const ids = records.map((item) => item.propertyId);
      const fetched = await fetchPropertiesByIds(ids);
      const byId = new Map(fetched.map((property) => [getPropertyId(property), property]));
      setProperties(
        records
          .map((record) => byId.get(record.propertyId))
          .filter((property): property is Property => Boolean(property)),
      );
    } catch (loadError) {
      console.error("Error loading favorites:", loadError);
      setError("Could not load your favorites. Please try again.");
      setFavorites([]);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    let cancelled = false;

    async function load() {
      try {
        const records = await getUserFavorites(uid);
        if (cancelled) return;
        setFavorites(records);
        const ids = records.map((item) => item.propertyId);
        const fetched = await fetchPropertiesByIds(ids);
        if (cancelled) return;
        const byId = new Map(fetched.map((property) => [getPropertyId(property), property]));
        setProperties(
          records
            .map((record) => byId.get(record.propertyId))
            .filter((property): property is Property => Boolean(property)),
        );
        setError(null);
      } catch (loadError) {
        console.error("Error loading favorites:", loadError);
        if (cancelled) return;
        setError("Could not load your favorites. Please try again.");
        setFavorites([]);
        setProperties([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleRemove = useCallback(
    async (property: Property) => {
      if (!user) return;
      const propertyId = getPropertyId(property);
      const record = favorites.find((item) => item.propertyId === propertyId);
      const docId = record?.docId || favoriteDocIdForProperty(propertyId);

      setProperties((current) => current.filter((item) => getPropertyId(item) !== propertyId));
      setFavorites((current) => current.filter((item) => item.propertyId !== propertyId));

      try {
        await removeFromFavorites(user.uid, docId);
        await refreshSeenProperties(user.uid);
      } catch (removeError) {
        console.error("Error removing favorite:", removeError);
        await loadFavorites(user.uid);
      }
    },
    [favorites, loadFavorites, user],
  );

  if (authLoading) {
    return (
      <div className={styles.status}>
        <div className={styles.spinner} aria-hidden="true" />
        <p>Loading favorites…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.status}>
        <h1>Please sign in to view favorites</h1>
        <p>
          <Link href="/login?next=/favorites">Login</Link> to see the properties you have saved.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.status}>
        <div className={styles.spinner} aria-hidden="true" />
        <p>Loading favorites…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.status}>
        <p className={styles.error}>{error}</p>
        <GlassButton title="Try again" onClick={() => loadFavorites(user.uid)} />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className={styles.status}>
        <h1>No favorites yet</h1>
        <p>
          Save properties from the <Link href="/properties">properties page</Link> to see them here.
        </p>
      </div>
    );
  }

  const countLabel =
    properties.length === 1 ? "1 saved property" : `${properties.length} saved properties`;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.count}>{countLabel}</p>
      </div>
      <div className={styles.list}>
        {properties.map((property) => (
          <PropertyCard
            key={getPropertyId(property)}
            property={property}
            isFavorite
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  );
}
