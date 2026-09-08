"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import OpenHouseCard from "@/components/OpenHouseCard";
import ReportOpenHouseDialog from "@/components/ReportOpenHouseDialog";
import { fetchPropertiesByIds, fetchTodayActivity, type Property } from "@/lib/api";
import { getAgentProfileBySlug, listOpenHouses, type AgentProfile, type OpenHouseRecord } from "@/lib/social";
import { filterUpcomingOpenHouses, matchPropertyForOpenHouse } from "@/lib/openHouse";
import { getSiteUrl } from "@/lib/site";
import styles from "./page.module.css";

export default function AgentLandingPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || "");
  const { user } = useAuth();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [openHouses, setOpenHouses] = useState<OpenHouseRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activity, setActivity] = useState<Property[]>([]);
  const [missing, setMissing] = useState(false);
  const [reporting, setReporting] = useState<{ openHouse: OpenHouseRecord; property: Property | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await getAgentProfileBySlug(slug);
        if (cancelled) return;
        if (!next || next.published === false) {
          setMissing(true);
          return;
        }
        setProfile(next);

        const housesPromise = listOpenHouses({ authorId: next.uid })
          .then((nextHouses) => {
            const upcoming = filterUpcomingOpenHouses(nextHouses);
            if (!cancelled) setOpenHouses(upcoming);
            return upcoming;
          })
          .catch((error) => {
            console.error("Error loading agent open houses:", error);
            return [];
          });

        fetchTodayActivity(8)
          .then((nextActivity) => {
            if (!cancelled) setActivity(nextActivity || []);
          })
          .catch((error) => {
            console.error("Error loading agent activity:", error);
          });

        const upcoming = await housesPromise;
        if (cancelled) return;
        const ids = upcoming.map((item) => item.propertyId).filter(Boolean);
        setProperties(ids.length ? await fetchPropertiesByIds(ids) : []);
      } catch (error) {
        console.error("Error loading agent profile:", error);
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleShare = useCallback(async () => {
    if (!profile?.slug) return;
    const url = `${getSiteUrl()}/agents/${profile.slug}`;
    const title = profile.displayName || "Agent on Acres";
    try {
      if (navigator.share) {
        await navigator.share({ title, url, text: title });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      // User cancelled share or clipboard is unavailable.
    }
  }, [profile]);

  if (missing) {
    return (
      <div className={styles.page}>
        <p>This agent page is not available.</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.page}>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <span />
        <button type="button" className={styles.share} onClick={handleShare} aria-label="Share agent page">
          Share
        </button>
      </div>

      <section className={styles.identity}>
        {profile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photoUrl} alt="" className={styles.avatar} />
        ) : (
          <div className={styles.avatarFallback}>{(profile.displayName || "A").slice(0, 1)}</div>
        )}
        <h1>{profile.displayName}</h1>
        {profile.company ? <p>{profile.company}</p> : null}
        {profile.yearsAsAgent ? <p>{profile.yearsAsAgent} years as an agent</p> : null}
      </section>

      {profile.about ? <p className={styles.about}>{profile.about}</p> : null}
      <div className={styles.links}>
        {(profile.socialLinks || []).map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
            {link.label || link.url}
          </a>
        ))}
      </div>

      <h2>Open houses</h2>
      {openHouses.length === 0 ? <p className={styles.meta}>No upcoming open houses.</p> : null}
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

      {activity.length ? (
        <section className={styles.activitySection}>
          <h2>Today on Acres</h2>
          <div className={styles.activityRow}>
            {activity.map((item) => {
              const photos = item.Photos || item.photos || [];
              const photo = photos[0] || null;
              return (
                <Link key={item._id} href={`/properties/${item._id}`} className={styles.activityCard}>
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className={styles.activityPhoto} />
                  ) : (
                    <div className={`${styles.activityPhoto} ${styles.activityPhotoFallback}`}>No photo</div>
                  )}
                  <div className={styles.activityCopy}>
                    <strong>{item.change_type === "price" ? "New price" : "New listing"}</strong>
                    <span>{item.Address || item.address}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <ReportOpenHouseDialog reporting={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}
