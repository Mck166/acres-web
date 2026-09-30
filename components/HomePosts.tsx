"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchPropertiesByIds, type Property } from "@/lib/api";
import { listOpenHouses, type OpenHouseRecord } from "@/lib/social";
import {
  filterUpcomingOpenHouses,
  formatOpenHouseWhen,
  matchPropertyForOpenHouse,
  openHouseBadge,
} from "@/lib/openHouse";
import { getPropertyAddress } from "@/lib/properties";
import styles from "./HomePosts.module.css";

export default function HomePosts() {
  const [openHouses, setOpenHouses] = useState<OpenHouseRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    listOpenHouses({ pageSize: 4 })
      .then(async (items) => {
        const upcoming = filterUpcomingOpenHouses(items).slice(0, 4);
        setOpenHouses(upcoming);
        const ids = upcoming.map((item) => item.propertyId).filter(Boolean);
        setProperties(ids.length ? await fetchPropertiesByIds(ids) : []);
      })
      .catch(() => setOpenHouses([]));
  }, []);

  if (openHouses.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="open-houses-heading">
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>This week</p>
          <h2 id="open-houses-heading">Upcoming open houses</h2>
        </div>
        <Link href="/feed" className={styles.link}>
          See open houses
        </Link>
      </div>
      <div className={styles.grid}>
        {openHouses.map((openHouse) => {
          const listing = matchPropertyForOpenHouse(openHouse, properties);
          const badge = openHouseBadge(openHouse.startsAt, openHouse.endsAt);
          return (
            <article key={openHouse.id} className={styles.card}>
              <strong className={styles.badge}>{badge ? badge.text : openHouse.authorName}</strong>
              <p className={styles.address}>
                {listing ? getPropertyAddress(listing) : openHouse.address}
              </p>
              <p className={styles.when}>{formatOpenHouseWhen(openHouse.startsAt, openHouse.endsAt)}</p>
              <Link
                href={listing ? `/properties/${listing._id}` : "/feed"}
                className={styles.cardLink}
              >
                View listing
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
