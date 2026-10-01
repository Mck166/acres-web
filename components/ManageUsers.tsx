"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchManagedUsers,
  updateManagedUserPlan,
  type ManagedUser,
  type ManagedUserPlan,
} from "@/lib/api";
import styles from "@/components/AnalyticsDashboard.module.css";

const PLANS: { value: ManagedUserPlan; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "assistant", label: "Assistant" },
];

function typeLabel(accountType: ManagedUser["account_type"]): string | null {
  if (accountType === "agent") return "Agent";
  if (accountType === "client") return "Client";
  return null;
}

function billingLabel(status: string | null): string | null {
  if (status === "active" || status === "trialing" || status === "past_due") {
    return "Billed in Stripe";
  }
  return null;
}

export default function ManageUsers({ reloadToken }: { reloadToken: number }) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [remoteSearch, setRemoteSearch] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [listError, setListError] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [savedUid, setSavedUid] = useState<string | null>(null);
  const pending = useRef<Record<string, ManagedUserPlan>>({});

  useEffect(() => {
    const handle = window.setTimeout(() => setApplied(query.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  // A full directory is filtered here. Server search stays on once a load is
  // too long to hold at once, so a shorter result cannot flip back and refetch.
  const serverQuery = remoteSearch ? applied : "";

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    fetchManagedUsers(serverQuery, controller.signal)
      .then((data) => {
        if (cancelled) return;
        setUsers(
          data.users.map((user) => {
            const plan = pending.current[user.uid];
            return plan ? { ...user, plan, admin_plan: plan } : user;
          }),
        );
        setTotal(data.total);
        setTruncated(data.truncated);
        if (!serverQuery && data.truncated) setRemoteSearch(true);
        setListError(false);
        setPhase("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted || cancelled) return;
        console.error("Error loading users:", error);
        setListError(true);
        setPhase((current) => (current === "loading" ? "error" : current));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [serverQuery, reloadToken]);

  const visible = useMemo(() => {
    if (remoteSearch) return users;
    const needle = applied.toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(needle),
    );
  }, [applied, remoteSearch, users]);

  const changePlan = async (user: ManagedUser, plan: ManagedUserPlan) => {
    if (plan === user.plan || saving[user.uid]) return;
    const previous = user.plan;
    const previousOverride = user.admin_plan;
    pending.current[user.uid] = plan;
    setUsers((current) =>
      current.map((row) => (row.uid === user.uid ? { ...row, plan, admin_plan: plan } : row)),
    );
    setSaving((current) => ({ ...current, [user.uid]: true }));
    setRowError((current) => ({ ...current, [user.uid]: "" }));
    setSavedUid((current) => (current === user.uid ? null : current));
    try {
      const updated = await updateManagedUserPlan(user.uid, plan);
      if (pending.current[user.uid] === plan) delete pending.current[user.uid];
      setUsers((current) =>
        current.map((row) => (row.uid === user.uid ? { ...row, ...updated } : row)),
      );
      setSavedUid(user.uid);
    } catch (error) {
      console.error("Error updating subscription:", error);
      if (pending.current[user.uid] === plan) delete pending.current[user.uid];
      setUsers((current) =>
        current.map((row) =>
          row.uid === user.uid ? { ...row, plan: previous, admin_plan: previousOverride } : row,
        ),
      );
      setRowError((current) => ({
        ...current,
        [user.uid]: "Could not update this subscription.",
      }));
    } finally {
      setSaving((current) => ({ ...current, [user.uid]: false }));
    }
  };

  const countLabel = truncated
    ? `Showing ${visible.length} of ${total}. Keep typing to narrow the list.`
    : applied
      ? `${visible.length} of ${total} ${total === 1 ? "account" : "accounts"}`
      : `${total} ${total === 1 ? "account" : "accounts"}`;

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2>Manage users</h2>
        <p className={styles.panelNote}>{phase === "ready" ? countLabel : "Assistant access"}</p>
      </div>
      <p className={styles.userNote}>
        Find an account and set their assistant subscription. This changes access in the app. It
        does not start or cancel a Stripe charge.
      </p>
      <label className={styles.userSearch}>
        <span className={styles.srOnly}>Search accounts</span>
        <input
          type="search"
          value={query}
          placeholder="Search by name or email"
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </label>

      {phase === "loading" ? (
        <p className={styles.userStatus}>Loading accounts…</p>
      ) : null}

      {phase === "error" || listError ? (
        <p className={styles.userStatus}>Could not load accounts. Refresh and try again.</p>
      ) : null}

      {phase === "ready" && visible.length === 0 ? (
        <p className={styles.userStatus}>No accounts match that search.</p>
      ) : null}

      {phase === "ready" && visible.length > 0 ? (
        <ul className={styles.userList}>
          {visible.map((user) => {
            const kind = typeLabel(user.account_type);
            const billing = billingLabel(user.stripe_status);
            const meta = [
              kind,
              user.admin_plan ? "Manual" : null,
              billing,
            ].filter(Boolean);
            return (
              <li key={user.uid} className={styles.userRow}>
                <div className={styles.userIdentity}>
                  <p className={styles.userName}>{user.name}</p>
                  {user.email ? <p className={styles.userEmail}>{user.email}</p> : null}
                  {meta.length > 0 ? <p className={styles.userMeta}>{meta.join(" · ")}</p> : null}
                  {rowError[user.uid] ? (
                    <p className={styles.userRowError}>{rowError[user.uid]}</p>
                  ) : null}
                </div>
                <div className={styles.planControl}>
                  {savedUid === user.uid && !saving[user.uid] ? (
                    <span className={styles.userSaved}>Saved</span>
                  ) : null}
                  <label className={styles.srOnly} htmlFor={`plan-${user.uid}`}>
                    Subscription for {user.name}
                  </label>
                  <select
                    id={`plan-${user.uid}`}
                    className={styles.planSelect}
                    value={user.plan}
                    disabled={Boolean(saving[user.uid])}
                    onChange={(event) =>
                      changePlan(user, event.target.value as ManagedUserPlan)
                    }
                  >
                    {PLANS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
