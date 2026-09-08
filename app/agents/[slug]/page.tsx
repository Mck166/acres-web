"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import OpenHouseCard from "@/components/OpenHouseCard";
import ReportOpenHouseDialog from "@/components/ReportOpenHouseDialog";
import { claimAgentClient, fetchPropertiesByIds, fetchTodayActivity } from "@/lib/api";
import { getUserData, type UserProfile } from "@/lib/firestore";
import {
  createFollow,
  deleteFollow,
  getAgentProfileBySlug,
  getFollow,
  listOpenHouses,
  listReviews,
  upsertReview,
  type AgentProfile,
  type FollowRecord,
  type OpenHouseRecord,
  type ReviewRecord,
} from "@/lib/social";
import { filterUpcomingOpenHouses, matchPropertyForOpenHouse } from "@/lib/openHouse";
import type { Property } from "@/lib/api";
import styles from "./page.module.css";

export default function AgentLandingPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || "");
  const { user } = useAuth();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [follow, setFollow] = useState<FollowRecord | null>(null);
  const [openHouses, setOpenHouses] = useState<OpenHouseRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [activity, setActivity] = useState<Property[]>([]);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reporting, setReporting] = useState<{ openHouse: OpenHouseRecord; property: Property | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await getAgentProfileBySlug(slug);
      if (cancelled) return;
      if (!next || next.published === false) {
        setMissing(true);
        return;
      }
      setProfile(next);
      const [nextHouses, nextReviews, nextActivity, userData, nextFollow] = await Promise.all([
        listOpenHouses({ authorId: next.uid }),
        listReviews(next.uid),
        fetchTodayActivity(8),
        user?.uid ? getUserData(user.uid) : Promise.resolve(null),
        user?.uid ? getFollow(user.uid, next.uid) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      const upcoming = filterUpcomingOpenHouses(nextHouses);
      setOpenHouses(upcoming);
      setReviews(nextReviews);
      setActivity(nextActivity);
      setMe(userData);
      setFollow(nextFollow);
      const ids = upcoming.map((item) => item.propertyId).filter(Boolean);
      setProperties(ids.length ? await fetchPropertiesByIds(ids) : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, user?.uid]);

  const handleFollow = async (claimed: boolean) => {
    if (!user || !profile) return;
    const created = await createFollow(user.uid, profile.uid, { claimedClient: claimed });
    if (claimed) {
      try {
        await claimAgentClient(profile.uid);
      } catch {
        /* notification is best-effort */
      }
    }
    setFollow(created);
  };

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
      <section className={styles.identity}>
        {profile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photoUrl} alt="" className={styles.avatar} />
        ) : (
          <div className={styles.avatarFallback}>{(profile.displayName || "A").slice(0, 1)}</div>
        )}
        <div>
          <h1>{profile.displayName}</h1>
          {profile.company ? <p>{profile.company}</p> : null}
          {profile.yearsAsAgent ? <p>{profile.yearsAsAgent} years as an agent</p> : null}
          <p>{profile.followerCount || 0} followers</p>
          <div className={styles.actions}>
            {follow ? (
              <button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  await deleteFollow(user.uid, profile.uid);
                  setFollow(null);
                }}
              >
                Following
              </button>
            ) : (
              <>
                <button type="button" onClick={() => handleFollow(false)}>
                  Follow
                </button>
                <button type="button" onClick={() => handleFollow(true)}>
                  I am signed to this agent
                </button>
              </>
            )}
          </div>
          {follow?.clientStatus === "pending" ? <p>Waiting for this agent to confirm you as a client.</p> : null}
        </div>
      </section>

      <div className={styles.layout}>
        <div>
          {profile.about ? <p className={styles.about}>{profile.about}</p> : null}
          <div className={styles.links}>
            {(profile.socialLinks || []).map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                {link.label || link.url}
              </a>
            ))}
          </div>
          <h2>Open houses</h2>
          {openHouses.length === 0 ? <p>No upcoming open houses.</p> : null}
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
          <h2>Reviews</h2>
          {reviews.map((review) => (
            <article key={review.id} className={styles.review}>
              <strong>
                {review.authorName} · {"★".repeat(review.rating || 0)}
              </strong>
              {review.text ? <p>{review.text}</p> : null}
            </article>
          ))}
          {follow?.clientStatus === "confirmed" && user ? (
            <form
              className={styles.reviewForm}
              onSubmit={async (event) => {
                event.preventDefault();
                await upsertReview(profile.uid, { uid: user.uid, firstName: me?.firstName }, { rating, text: reviewText });
                setReviews(await listReviews(profile.uid));
                setReviewText("");
              }}
            >
              <label>
                Your review
                <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value} star{value === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
              <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} />
              <button type="submit">Save review</button>
            </form>
          ) : null}
        </div>
        <aside>
          <h2>Today on Acres</h2>
          {activity.map((item) => (
            <Link key={item._id} href={`/properties/${item._id}`} className={styles.activity}>
              <strong>{item.change_type === "price" ? "New price" : "New listing"}</strong>
              <span>{item.Address || item.address}</span>
            </Link>
          ))}
        </aside>
      </div>
      <ReportOpenHouseDialog reporting={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}
