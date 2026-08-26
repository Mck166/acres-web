"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
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
import { listingBadge, sortClusterItems } from "@/lib/mapPins";
import styles from "@/components/PropertyMap.module.css";

const STATUS_COLORS = {
  listed: "#1f6fd0",
  price: "#2e9e4f",
  pending: "#8b5a2b",
  sold: "#c62828",
} as const;

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
  const byId = useMemo(
    () => new Map(details.map((property) => [String(property._id), property])),
    [details],
  );
  const chromeRef = useRef<HTMLDivElement>(null);
  const orderedItems = useMemo(() => sortClusterItems(items, byId), [items, byId]);

  const countLabel = `${items.length} ${items.length === 1 ? "property" : "properties"}`;

  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    el.style.setProperty("display", "flex", "important");
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("min-height", "56px", "important");
    el.style.setProperty("visibility", "visible", "important");
    el.style.setProperty("pointer-events", "auto", "important");
  }, []);

  return (
    <>
      {embed ? (
        <button
          type="button"
          className={styles.clusterBackdrop}
          onClick={onClose}
          aria-label="Close property list"
        />
      ) : null}
      <aside
        className={`${styles.clusterList} ${embed ? styles.clusterListEmbed : ""}`}
        style={
          embed
            ? {
                top: 24,
                right: 18,
                bottom: overlayBottom,
                left: 18,
                width: "auto",
                maxWidth: "none",
                borderRadius: 28,
                overflow: "hidden",
              }
            : { borderRadius: 24, overflow: "hidden" }
        }
        aria-label={countLabel}
        data-acres-cluster-list=""
      >
        <div
          ref={chromeRef}
          className={styles.clusterListHeader}
          data-acres-cluster-chrome=""
        >
          <p className={styles.clusterListTitle}>{countLabel}</p>
          <button
            type="button"
            className={styles.clusterClose}
            onClick={onClose}
            aria-label="Close property list"
          >
            ×
          </button>
        </div>
        <div className={styles.clusterListBody}>
        {orderedItems.map((item) => {
          const property = byId.get(item.id) ?? null;
          const photos = property ? getPropertyPhotos(property) : [];
          const photo = photos[0];
          const price = property ? getPropertyPrice(property) : item.priceLabel || "Price not available";
          const address = property ? getPropertyAddress(property) : loading ? "Loading address…" : "Address not available";
          const beds = property ? getBeds(property) : null;
          const baths = property ? getBaths(property) : null;
          const href = buildPropertyDetailHref(item.id, { from: "map", map: mapView });
          const badge = listingBadge(item, property);

          return (
            <Link
              key={item.id}
              href={href}
              className={styles.clusterRow}
              data-acres-pin={item.pin || badge.tone}
            >
              {photo ? (
                <PropertyImage className={styles.cardImage} src={photo} alt={address} />
              ) : (
                <div className={styles.cardPlaceholder}>{loading && !property ? "Loading…" : "No photo available"}</div>
              )}
              <div className={styles.cardBody}>
                <span
                  className={styles.clusterStatus}
                  style={{ backgroundColor: STATUS_COLORS[badge.tone] }}
                >
                  {badge.text}
                </span>
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
    </>
  );
}
