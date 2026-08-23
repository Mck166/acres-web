"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Property } from "@/lib/api";
import {
  formatBathLabel,
  formatBedLabel,
  getBaths,
  getBeds,
  getLivingArea,
  getPropertyAddress,
  getPropertyHref,
  getPropertyId,
  getPropertyPhotos,
  getPropertyPrice,
} from "@/lib/properties";
import { useAuth } from "@/components/AuthProvider";
import HeartIcon from "@/components/HeartIcon";
import PropertyImage from "@/components/PropertyImage";
import styles from "@/components/PropertyCard.module.css";

type PropertyCardProps = {
  property: Property;
  isFavorite?: boolean;
  onFavorite?: (property: Property) => Promise<void> | void;
  onRemove?: (property: Property) => Promise<void> | void;
  detailHref?: string;
  onNavigate?: () => void;
};

export default function PropertyCard({
  property,
  isFavorite = false,
  onFavorite,
  onRemove,
  detailHref,
  onNavigate,
}: PropertyCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const photos = getPropertyPhotos(property);
  const photo = photos[0];
  const price = getPropertyPrice(property);
  const address = getPropertyAddress(property);
  const beds = getBeds(property);
  const baths = getBaths(property);
  const livingArea = getLivingArea(property);
  const id = getPropertyId(property);
  const href = detailHref ?? getPropertyHref(property);

  const handleFavorite = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(href)}`);
      return;
    }
    if (!onFavorite || busy) return;
    setBusy(true);
    try {
      await onFavorite(property);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onRemove || busy) return;
    if (!window.confirm("Remove this property from your favorites?")) return;
    setBusy(true);
    try {
      await onRemove(property);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={styles.card}>
      <Link
        href={href}
        className={styles.cardLink}
        aria-label={`${address}, ${price}`}
        onClick={() => onNavigate?.()}
      >
        <div className={styles.imageWrap}>
          {photo && !imageFailed ? (
            <PropertyImage
              className={styles.image}
              src={photo}
              alt={`${address} listed at ${price}`}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className={styles.placeholder}>No photo available</div>
          )}
        </div>
        <div className={styles.overlay}>
          <h2 className={styles.price}>{price}</h2>
          <div className={styles.badges}>
            {beds ? <span className={styles.badge}>{formatBedLabel(beds)}</span> : null}
            {baths ? <span className={styles.badge}>{formatBathLabel(baths)}</span> : null}
            {livingArea ? <span className={styles.badge}>{livingArea}</span> : null}
          </div>
          <p className={styles.address}>{address}</p>
          {id ? <span className="sr-only">Property {id}</span> : null}
        </div>
      </Link>

      {onFavorite ? (
        <button
          type="button"
          className={styles.favorite}
          onClick={handleFavorite}
          disabled={busy}
          aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
          aria-pressed={isFavorite}
        >
          <HeartIcon size={20} color="#EAE6E5" filled={isFavorite} />
        </button>
      ) : null}

      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          onClick={handleRemove}
          disabled={busy}
          aria-label="Remove from favorites"
        >
          Remove
        </button>
      ) : null}
    </article>
  );
}
