"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import OpenHouseCard from "@/components/OpenHouseCard";
import OpenHouseCompose from "@/components/OpenHouseCompose";
import {
  confirmAgentClient,
  declineAgentClient,
  fetchAgentClients,
  fetchClientFavoritesForAgent,
  fetchPropertiesByIds,
  submitSupport,
  type Property,
} from "@/lib/api";
import { needsEmailVerification } from "@/lib/emailVerification";
import { getUserData, updateUserData, type UserProfile } from "@/lib/firestore";
import { filterUpcomingOpenHouses, matchPropertyForOpenHouse } from "@/lib/openHouse";
import { displayNameOf, isAgentAccount } from "@/lib/slug";
import { listOpenHouses, publishAgentProfile, unpublishAgentProfile, type OpenHouseRecord } from "@/lib/social";
import { needsOnboarding, onboardingPath, verifyEmailPath } from "@/lib/completeAuth";
import styles from "./page.module.css";

function parseLinks(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((url) => ({
      label: url.replace(/^https?:\/\//, ""),
      url: url.includes("://") ? url : `https://${url}`,
    }));
}

function formatPhoneNumber(value: string) {
  const cleaned = value.replace(/\D/g, "").slice(0, 10);
  if (cleaned.length === 0) return "";
  if (cleaned.length <= 3) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [company, setCompany] = useState("");
  const [years, setYears] = useState("");
  const [about, setAbout] = useState("");
  const [links, setLinks] = useState("");
  const [savingPublic, setSavingPublic] = useState(false);
  const [clients, setClients] = useState<Array<Record<string, unknown>>>([]);
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [openHouses, setOpenHouses] = useState<OpenHouseRecord[]>([]);
  const [openHouseProperties, setOpenHouseProperties] = useState<Property[]>([]);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportCategory, setSupportCategory] = useState("Feedback");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportStatus, setSupportStatus] = useState<string | null>(null);
  const [sendingSupport, setSendingSupport] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const reload = async () => {
    if (!user) return;
    const data = await getUserData(user.uid);
    setProfile(data);
    setFirstName(data?.firstName || "");
    setLastName(data?.lastName || "");
    setPhoneNumber(digitsOnly(data?.phoneNumber || ""));
    setCompany(data?.company || "");
    setYears(data?.yearsAsAgent || "");
    setAbout(data?.about || "");
    setLinks((data?.socialLinks || []).map((item) => item.url).join("\n"));
    if (data?.accountType === "agent") {
      setClients(await fetchAgentClients());
      const houses = filterUpcomingOpenHouses(await listOpenHouses({ authorId: user.uid }));
      setOpenHouses(houses);
      const ids = houses.map((item) => item.propertyId).filter(Boolean);
      setOpenHouseProperties(ids.length ? await fetchPropertiesByIds(ids) : []);
    } else {
      setClients([]);
      setOpenHouses([]);
      setOpenHouseProperties([]);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/account");
      return;
    }
    if (needsEmailVerification(user)) {
      router.replace(verifyEmailPath("/account"));
      return;
    }
    (async () => {
      const data = await getUserData(user.uid);
      if (needsOnboarding(data)) {
        router.replace(onboardingPath("/account"));
        return;
      }
      await reload();
    })();
  }, [loading, router, user]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!user || !profile) {
    return (
      <div className={styles.page}>
        <p>Loading…</p>
      </div>
    );
  }

  const agent = isAgentAccount(profile);
  const displayName = displayNameOf(profile);
  const initial = (displayName || "A").slice(0, 1).toUpperCase();

  return (
    <div className={`${styles.page} ${agent ? styles.agentPage : styles.buyerPage}`}>
      <header className={styles.identity}>
        {profile.profilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.profilePictureUrl} alt="" className={styles.avatar} />
        ) : (
          <div className={styles.avatarFallback}>{initial}</div>
        )}
        <div className={styles.identityCopy}>
          <p className={styles.kicker}>{agent ? "Agent account" : "Looking for a home"}</p>
          <h1>{displayName}</h1>
          <p className={styles.lead}>{user.email || "Signed in with Apple"}</p>
        </div>
        <nav className={styles.topNav} aria-label="Account shortcuts">
          <Link href="/favorites">Favorites</Link>
          <Link href="/feed">Open houses</Link>
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.menuButton}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={() => setMenuOpen((open) => !open)}
            >
              More
            </button>
            {menuOpen ? (
              <div className={styles.menu} role="dialog" aria-label="Account options">
                <section>
                  <h2>Account type</h2>
                  <p>{agent ? "You have a public agent page." : "Buyers see you as looking for a home."}</p>
                  <button
                    type="button"
                    disabled={switchingRole}
                    onClick={async () => {
                      setSwitchingRole(true);
                      try {
                        if (agent) {
                          await unpublishAgentProfile(user.uid, profile.slug);
                          await updateUserData(user.uid, { accountType: "client", profilePublic: false });
                        } else {
                          const slug = await publishAgentProfile(user.uid, {
                            ...profile,
                            firstName: firstName || profile.firstName,
                            lastName: lastName || profile.lastName,
                            profilePublic: true,
                          });
                          await updateUserData(user.uid, { accountType: "agent", profilePublic: true, slug });
                        }
                        await reload();
                      } finally {
                        setSwitchingRole(false);
                      }
                    }}
                  >
                    {switchingRole ? "Switching…" : agent ? "Switch to home seeker" : "Switch to agent account"}
                  </button>
                </section>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!supportMessage.trim() || sendingSupport) return;
                    setSendingSupport(true);
                    setSupportStatus(null);
                    try {
                      await submitSupport({ category: supportCategory, message: supportMessage.trim() });
                      setSupportMessage("");
                      setSupportStatus("Thanks — we’ll take a look.");
                    } catch {
                      setSupportStatus("Could not send. Please try again.");
                    } finally {
                      setSendingSupport(false);
                    }
                  }}
                >
                  <h2>Support</h2>
                  <p>Send feedback, report a problem, or ask a question.</p>
                  <select value={supportCategory} onChange={(event) => setSupportCategory(event.target.value)}>
                    <option value="Feedback">Feedback</option>
                    <option value="Problem">Problem</option>
                    <option value="Other">Other</option>
                  </select>
                  <textarea
                    value={supportMessage}
                    onChange={(event) => setSupportMessage(event.target.value)}
                    placeholder="What should we know?"
                    required
                  />
                  {supportStatus ? <p>{supportStatus}</p> : null}
                  <button type="submit" disabled={sendingSupport || !supportMessage.trim()}>
                    {sendingSupport ? "Sending…" : "Send"}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.logout}
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              await logout();
              router.replace("/");
            }}
          >
            {loggingOut ? "Signing out…" : "Log out"}
          </button>
        </nav>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <form
            className={styles.card}
            onSubmit={async (event) => {
              event.preventDefault();
              setSavingProfile(true);
              setStatus(null);
              try {
                await updateUserData(user.uid, {
                  firstName: firstName.trim(),
                  lastName: lastName.trim(),
                  phoneNumber: phoneNumber.trim(),
                });
                if (agent) {
                  await publishAgentProfile(user.uid, {
                    ...profile,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phoneNumber: phoneNumber.trim(),
                    profilePublic: true,
                  });
                }
                setStatus("Profile saved.");
                await reload();
              } finally {
                setSavingProfile(false);
              }
            }}
          >
            <div className={styles.cardHead}>
              <h2>Profile</h2>
              <button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save"}
              </button>
            </div>
            <div className={styles.fields}>
              <label>
                First name
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </label>
              <label>
                Last name
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </label>
              <label>
                Phone
                <input
                  value={formatPhoneNumber(phoneNumber)}
                  onChange={(event) => setPhoneNumber(digitsOnly(event.target.value))}
                  placeholder="(902) 555-1234"
                  inputMode="tel"
                />
              </label>
              <label>
                Email
                <input value={user.email || "Signed in with Apple"} disabled />
              </label>
            </div>
          </form>

          {agent ? (
            <form
              className={styles.card}
              onSubmit={async (event) => {
                event.preventDefault();
                setSavingPublic(true);
                try {
                  const socialLinks = parseLinks(links);
                  const slug = await publishAgentProfile(user.uid, {
                    ...profile,
                    firstName,
                    lastName,
                    company,
                    yearsAsAgent: years,
                    about,
                    socialLinks,
                    profilePublic: true,
                  });
                  await updateUserData(user.uid, {
                    company,
                    yearsAsAgent: years,
                    about,
                    socialLinks,
                    slug,
                    profilePublic: true,
                  });
                  await reload();
                } finally {
                  setSavingPublic(false);
                }
              }}
            >
              <div className={styles.cardHead}>
                <h2>Public profile</h2>
                <button type="submit" disabled={savingPublic}>
                  {savingPublic ? "Saving…" : "Save"}
                </button>
              </div>
              {profile.slug ? (
                <Link className={styles.inlineLink} href={`/agents/${profile.slug}`}>
                  Open my page
                </Link>
              ) : null}
              <div className={styles.fields}>
                <label>
                  Company
                  <input value={company} onChange={(event) => setCompany(event.target.value)} />
                </label>
                <label>
                  Years as an agent
                  <input value={years} onChange={(event) => setYears(event.target.value)} />
                </label>
              </div>
              <label>
                About
                <textarea value={about} onChange={(event) => setAbout(event.target.value)} />
              </label>
              <label>
                Links, one per line
                <textarea value={links} onChange={(event) => setLinks(event.target.value)} />
              </label>
            </form>
          ) : null}
        </aside>

        {agent ? (
          <section className={`${styles.card} ${styles.workspace}`}>
            <div className={styles.cardHead}>
              <div>
                <h2>Open houses</h2>
                <p className={styles.meta}>Buyers will see this until the end time. The listing PID is required.</p>
              </div>
            </div>
            <OpenHouseCompose
              author={{
                uid: user.uid,
                slug: profile.slug,
                displayName,
                profilePictureUrl: profile.profilePictureUrl,
              }}
              onCreated={reload}
            />
            {openHouses.length ? <h3 className={styles.subhead}>Your upcoming open houses</h3> : <p className={styles.meta}>No upcoming open houses yet.</p>}
            <div className={styles.listings}>
              {openHouses.map((openHouse) => {
                const listing = matchPropertyForOpenHouse(openHouse, openHouseProperties);
                return (
                  <OpenHouseCard
                    key={openHouse.id}
                    openHouse={openHouse}
                    property={listing}
                    viewerUid={user.uid}
                    onDeleted={(id) => setOpenHouses((current) => current.filter((item) => item.id !== id))}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {agent ? (
          <section className={`${styles.card} ${styles.clients}`}>
            <h2>Clients</h2>
            {clients.length === 0 ? <p className={styles.meta}>No client requests yet.</p> : null}
            <div className={styles.clientList}>
              {clients.map((client) => (
                <div key={String(client.id)} className={styles.row}>
                  <div>
                    <strong>
                      {String(client.firstName || "")} {String(client.lastName || "")}
                    </strong>
                    <p>{String(client.clientStatus)}</p>
                  </div>
                  {client.clientStatus === "pending" ? (
                    <div className={styles.actions}>
                      <button
                        type="button"
                        onClick={async () => {
                          await confirmAgentClient(String(client.followerId));
                          reload();
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={async () => {
                          await declineAgentClient(String(client.followerId));
                          reload();
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  ) : null}
                  {client.clientStatus === "confirmed" ? (
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={async () => setFavorites(await fetchClientFavoritesForAgent(String(client.followerId)))}
                    >
                      View favorites
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {favorites.length ? (
              <div className={styles.favoriteLinks}>
                {favorites.map((item) => (
                  <Link key={item._id} href={`/properties/${item._id}`}>
                    {item.Address || item.address}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      {status ? <p className={styles.toast}>{status}</p> : null}
    </div>
  );
}
