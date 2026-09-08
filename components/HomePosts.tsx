"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchPropertiesByIds, type Property } from "@/lib/api";
import { listOpenHouses, type OpenHouseRecord } from "@/lib/social";
import { filterUpcomingOpenHouses, formatOpenHouseWhen, matchPropertyForOpenHouse, openHouseBadge } from "@/lib/openHouse";
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
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>Upcoming open houses</h2>
        <Link href="/feed">See open houses</Link>
      </div>
      <div className={styles.grid}>
        {openHouses.map((openHouse) => {
          const listing = matchPropertyForOpenHouse(openHouse, properties);
          const badge = openHouseBadge(openHouse.startsAt, openHouse.endsAt);
          return (
            <article key={openHouse.id}>
              {badge ? <strong>{badge.text}</strong> : <strong>{openHouse.authorName}</strong>}
              <p>{listing ? getPropertyAddress(listing) : openHouse.address}</p>
              <p>{formatOpenHouseWhen(openHouse.startsAt, openHouse.endsAt)}</p>
              <Link href={listing ? `/properties/${listing._id}` : "/feed"}>View listing</Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
