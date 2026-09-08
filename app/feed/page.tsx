"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import OpenHouseCard from "@/components/OpenHouseCard";
import OpenHouseCompose from "@/components/OpenHouseCompose";
import ReportOpenHouseDialog from "@/components/ReportOpenHouseDialog";
import { getUserData, type UserProfile } from "@/lib/firestore";
import { listOpenHouses, type OpenHouseRecord } from "@/lib/social";
import { fetchPropertiesByIds, type Property } from "@/lib/api";
import { displayNameOf, isAgentAccount } from "@/lib/slug";
import { filterUpcomingOpenHouses, matchPropertyForOpenHouse } from "@/lib/openHouse";
import styles from "./page.module.css";

export default function FeedPage() {
  const { user } = useAuth();
  const [openHouses, setOpenHouses] = useState<OpenHouseRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [reporting, setReporting] = useState<{ openHouse: OpenHouseRecord; property: Property | null } | null>(null);

  const reload = async () => {
    const [nextHouses, userData] = await Promise.all([
      listOpenHouses(),
      user?.uid ? getUserData(user.uid) : Promise.resolve(null),
    ]);
    const upcoming = filterUpcomingOpenHouses(nextHouses);
    setOpenHouses(upcoming);
    setMe(userData);
    const ids = upcoming.map((item) => item.propertyId).filter(Boolean);
    setProperties(ids.length ? await fetchPropertiesByIds(ids) : []);
  };

  useEffect(() => {
    reload().catch(() => setOpenHouses([]));
  }, [user?.uid]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setOpenHouses((current) => filterUpcomingOpenHouses(current));
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={styles.page}>
      <h1>Open Houses</h1>
      <p className={styles.lead}>Upcoming showings, soonest first.</p>
      {isAgentAccount(me) && user ? (
        <div className={styles.compose}>
          <OpenHouseCompose
            author={{
              uid: user.uid,
              slug: me?.slug,
              displayName: displayNameOf(me),
              profilePictureUrl: me?.profilePictureUrl,
            }}
            onCreated={reload}
          />
        </div>
      ) : null}
      {openHouses.length === 0 ? <p className={styles.empty}>No upcoming open houses.</p> : null}
      {openHouses.map((openHouse) => {
        const listing = matchPropertyForOpenHouse(openHouse, properties);
        return (
          <OpenHouseCard
            key={openHouse.id}
            openHouse={openHouse}
            property={listing}
            viewerUid={user?.uid}
            onReport={() => setReporting({ openHouse, property: listing })}
            onDeleted={(id) => setOpenHouses((current) => current.filter((item) => item.id !== id))}
          />
        );
      })}
      <ReportOpenHouseDialog reporting={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}
