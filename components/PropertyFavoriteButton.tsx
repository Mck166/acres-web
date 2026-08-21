"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { favoriteProperty, refreshSeenProperties, type Property } from "@/lib/api";
import {
  addToFavorites,
  favoriteDocIdForProperty,
  getUserFavorites,
  removeFromFavorites,
} from "@/lib/firestore";
import { getPropertyHref, getPropertyId } from "@/lib/properties";
import { useAuth } from "@/components/AuthProvider";
import HeartIcon from "@/components/HeartIcon";
import styles from "@/components/PropertyFavoriteButton.module.css";

export default function PropertyFavoriteButton({ property }: { property: Property }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const propertyId = getPropertyId(property);
  const href = getPropertyHref(property);

  useEffect(() => {
    if (!user || !propertyId) return;
    let cancelled = false;
    getUserFavorites(user.uid)
      .then((favorites) => {
        if (cancelled) return;
        setIsFavorite(favorites.some((item) => item.propertyId === propertyId));
      })
      .catch((error) => {
        console.error("Error checking favorite:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [propertyId, user]);

  const handleClick = useCallback(async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(href)}`);
      return;
    }
    if (!propertyId || busy) return;

    const nextValue = !isFavorite;
    setIsFavorite(nextValue);
    setBusy(true);
    try {
      if (nextValue) {
        await addToFavorites(user.uid, propertyId);
        await favoriteProperty(propertyId, user.uid);
      } else {
        await removeFromFavorites(user.uid, favoriteDocIdForProperty(propertyId));
        await refreshSeenProperties(user.uid);
      }
    } catch (error) {
      console.error("Error updating favorite:", error);
      setIsFavorite(!nextValue);
    } finally {
      setBusy(false);
    }
  }, [busy, href, isFavorite, propertyId, router, user]);

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleClick}
      disabled={busy}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
    >
      <HeartIcon size={20} color="#EAE6E5" filled={isFavorite} />
      {isFavorite ? "Saved" : "Save"}
    </button>
  );
}
