"use client";

import Link from "next/link";
import type { MapProperty, Property } from "@/lib/api";
import { buildPropertyDetailHref } from "@/lib/navigationState";
import {
  formatBathLabel,
  formatBedLabel,
  getBaths,
  getBeds,
  getPropertyAddress,
  getPropertyPhotos,
  getPropertyPrice,
} from "@/lib/properties";
import PropertyImage from "@/components/PropertyImage";
import styles from "@/components/PropertyMap.module.css";

type MapView = {
  lng: number;
  lat: number;
  zoom: number;
};

type MapClusterListProps = {
  items: MapProperty[];
  details: Property[];
  loading: boolean;
  embed: boolean;
  overlayBottom: number;
  mapView: MapView;
  onClose: () => void;
};

export default function MapClusterList({
  items,
  details,
  loading,
  embed,
  overlayBottom,
  mapView,
  onClose,
}: MapClusterListProps) {
  const byId = new Map(details.map((property) => [String(property._id), property]));

  return (
    <aside
      className={`${styles.clusterList} ${embed ? styles.clusterListEmbed : ""}`}
      style={embed ? { bottom: overlayBottom } : undefined}
      aria-label={`${items.length} listings at this location`}
    >
      <header className={styles.clusterListHeader}>
        <p className={styles.clusterListTitle}>
          {items.length} listing{items.length === 1 ? "" : "s"}
        </p>
        <button type="button" className={styles.cardClose} onClick={onClose} aria-label="Close listing list">
          ×
        </button>
      </header>
      <div className={styles.clusterListBody}>
        {items.map((item) => {
          const property = byId.get(item.id) ?? null;
          const photos = property ? getPropertyPhotos(property) : [];
          const photo = photos[0];
          const price = property ? getPropertyPrice(property) : item.priceLabel || "Price not available";
          const address = property ? getPropertyAddress(property) : loading ? "Loading address…" : "Address not available";
          const beds = property ? getBeds(property) : null;
          const baths = property ? getBaths(property) : null;
          const href = buildPropertyDetailHref(item.id, { from: "map", map: mapView });

          return (
            <Link key={item.id} href={href} className={styles.clusterRow}>
              {photo ? (
                <PropertyImage className={styles.cardImage} src={photo} alt={address} />
              ) : (
                <div className={styles.cardPlaceholder}>{loading && !property ? "Loading…" : "No photo available"}</div>
              )}
              <div className={styles.cardBody}>
                <p className={styles.cardPrice}>{price}</p>
                <p className={styles.cardAddress}>{address}</p>
                {beds || baths ? (
                  <p className={styles.cardMeta}>
                    {[beds ? formatBedLabel(beds) : null, baths ? formatBathLabel(baths) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
