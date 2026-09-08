"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PropertyCard from "@/components/PropertyCard";
import { useAuth } from "@/components/AuthProvider";
import type { Property } from "@/lib/api";
import { deleteOpenHouse, type OpenHouseRecord } from "@/lib/social";
import { formatOpenHouseWhen, openHouseBadge } from "@/lib/openHouse";
import { getPropertyAddress, getPropertyId } from "@/lib/properties";
import styles from "@/components/OpenHouseCard.module.css";

type OpenHouseCardProps = {
  openHouse: OpenHouseRecord;
  property: Property | null;
  viewerUid?: string | null;
  onReport?: () => void;
  onDeleted?: (id: string) => void;
};

export default function OpenHouseCard({
  openHouse,
  property,
  viewerUid,
  onReport,
  onDeleted,
}: OpenHouseCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [removing, setRemoving] = useState(false);
  const badge = openHouseBadge(openHouse.startsAt, openHouse.endsAt);
  const when = formatOpenHouseWhen(openHouse.startsAt, openHouse.endsAt);
  const address = property ? getPropertyAddress(property) : openHouse.address || "Address not available";
  const isAuthor = Boolean(viewerUid && openHouse.authorId === viewerUid);
  const href = property ? `/properties/${getPropertyId(property)}` : undefined;

  return (
    <article className={styles.wrap}>
      <div className={styles.card}>
        {badge ? (
          <span className={styles.badge} style={{ backgroundColor: badge.backgroundColor }}>
            {badge.text}
          </span>
        ) : null}
        {property ? (
          <PropertyCard property={property} />
        ) : (
          <div className={styles.fallback}>{address}</div>
        )}
      </div>
      <div className={styles.meta}>
        <div>
          {when ? <p className={styles.when}>{when}</p> : null}
          {openHouse.authorSlug ? (
            <Link href={`/agents/${openHouse.authorSlug}`} className={styles.agent}>
              Hosted by {openHouse.authorName || "an agent"}
            </Link>
          ) : openHouse.authorName ? (
            <p className={styles.agent}>Hosted by {openHouse.authorName}</p>
          ) : null}
          {openHouse.notes ? <p className={styles.notes}>{openHouse.notes}</p> : null}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.report}
            onClick={() => {
              if (!user) {
                router.push(`/login?next=${encodeURIComponent(href || "/feed")}`);
                return;
              }
              onReport?.();
            }}
          >
            Report
          </button>
          {isAuthor ? (
            <button
              type="button"
              className={styles.remove}
              disabled={removing}
              onClick={async () => {
                if (!window.confirm("Remove this open house?")) return;
                setRemoving(true);
                try {
                  await deleteOpenHouse(openHouse.id);
                  onDeleted?.(openHouse.id);
                } finally {
                  setRemoving(false);
                }
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
