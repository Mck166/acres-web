"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import GlassButton from "@/components/GlassButton";
import {
  fetchAnalyticsSummary,
  formatDayLabel,
  formatDuration,
  isAdminUser,
  sumBy,
  RANGE_OPTIONS,
  type AnalyticsSummary,
  type DayStats,
  type RangeDays,
} from "@/lib/adminAnalytics";
import styles from "@/components/AnalyticsDashboard.module.css";

type Series = {
  label: string;
  values: number[];
};

function Bars({ days, series }: { days: DayStats[]; series: Series[] }) {
  const peak = Math.max(1, ...series.flatMap((item) => item.values));

  return (
    <div className={styles.chart}>
      <div className={styles.legend}>
        {series.map((item, index) => (
          <span key={item.label} className={styles.legendItem}>
            <span className={`${styles.swatch} ${index === 1 ? styles.swatchAlt : ""}`} />
            {item.label}
          </span>
        ))}
      </div>
      <div className={styles.bars}>
        {days.map((day, dayIndex) => {
          const total = series.reduce((sum, item) => sum + item.values[dayIndex], 0);
          const detail = series
            .map((item) => `${item.label}: ${item.values[dayIndex]}`)
            .join(" · ");
          return (
            <div
              key={day.day}
              className={styles.barSlot}
              title={`${formatDayLabel(day.day)} — ${detail}`}
            >
              <div className={styles.barStack}>
                {series.map((item, index) => (
                  <div
                    key={item.label}
                    className={`${styles.bar} ${index === 1 ? styles.barAlt : ""}`}
                    style={{ height: `${(item.values[dayIndex] / peak) * 100}%` }}
                  />
                ))}
              </div>
              <span className={styles.barValue}>{total || ""}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.axis}>
        <span>{days.length ? formatDayLabel(days[0].day) : ""}</span>
        <span>{days.length ? formatDayLabel(days[days.length - 1].day) : ""}</span>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [range, setRange] = useState<RangeDays>(30);
  const [attempt, setAttempt] = useState(0);
  const [adminCheck, setAdminCheck] = useState<{ uid: string; allowed: boolean } | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  // Which request each of these belongs to, so "still loading" and "failed" are
  // derived rather than a third and fourth piece of state to keep in step.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const requestKey = `${range}:${attempt}`;
  const uid = user?.uid;

  const isAdmin: boolean | null = !uid
    ? authLoading
      ? null
      : false
    : adminCheck?.uid === uid
      ? adminCheck.allowed
      : null;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    isAdminUser()
      .then((allowed) => {
        if (!cancelled) setAdminCheck({ uid, allowed });
      })
      .catch(() => {
        if (!cancelled) setAdminCheck({ uid, allowed: false });
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (isAdmin !== true) return;
    let cancelled = false;
    fetchAnalyticsSummary(range)
      .then((next) => {
        if (cancelled) return;
        setSummary(next);
        setLoadedKey(requestKey);
      })
      .catch((error) => {
        console.error("Error loading analytics:", error);
        if (!cancelled) setFailedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, range, requestKey]);

  const failed = failedKey === requestKey;
  const loading = isAdmin === true && !failed && loadedKey !== requestKey;

  const cards = useMemo(() => {
    if (!summary) return [];
    const days = summary.days;
    const today = days[days.length - 1];
    const activeTotal = sumBy(days, "activeUsers");
    const seconds = sumBy(days, "foregroundSeconds");

    return [
      { label: "Total users", value: String(summary.totalUsers), note: "installs ever" },
      { label: "Opened today", value: String(today?.activeUsers ?? 0), note: "unique devices" },
      { label: "Users in range", value: String(summary.usersInRange), note: `last ${range} days` },
      { label: "Properties saved", value: String(sumBy(days, "propertySaves")), note: "in range" },
      { label: "Map searches", value: String(sumBy(days, "mapSearches")), note: "in range" },
      { label: "Page views", value: String(sumBy(days, "screenViews")), note: "in range" },
      {
        label: "Time per user",
        value: formatDuration(activeTotal ? seconds / activeTotal : 0),
        note: "per active day",
      },
      { label: "New installs", value: String(sumBy(days, "newUsers")), note: "in range" },
    ];
  }, [range, summary]);

  if (isAdmin === null) {
    return (
      <div className={styles.status}>
        <div className={styles.spinner} aria-hidden="true" />
        <p>Checking access…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.status}>
        <h1>Please sign in</h1>
        <p>
          <Link href="/login?next=/admin/analytics">Login</Link> with an admin account to see the
          dashboard.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.status}>
        <h1>Not authorized</h1>
        <p>This page is only available to Acres admins.</p>
      </div>
    );
  }

  const days = summary?.days ?? [];
  const totalScreenViews = sumBy(days, "screenViews") || 1;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin</p>
          <h1>App analytics</h1>
          <p className={styles.lead}>Everything the iOS app reports, in Atlantic days.</p>
        </div>
        <div className={styles.ranges} role="group" aria-label="Date range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.range} ${option === range ? styles.rangeActive : ""}`}
              onClick={() => setRange(option)}
              aria-pressed={option === range}
            >
              {option}d
            </button>
          ))}
        </div>
      </header>

      {failed ? (
        <div className={styles.status}>
          <p className={styles.error}>Could not load analytics. Please try again.</p>
          <GlassButton title="Try again" onClick={() => setAttempt((count) => count + 1)} />
        </div>
      ) : null}

      {loading && !summary ? (
        <div className={styles.status}>
          <div className={styles.spinner} aria-hidden="true" />
          <p>Loading analytics…</p>
        </div>
      ) : null}

      {summary ? (
        <div className={loading ? styles.stale : undefined}>
          <section className={styles.cards}>
            {cards.map((card) => (
              <div key={card.label} className={styles.card}>
                <span className={styles.cardLabel}>{card.label}</span>
                <strong className={styles.cardValue}>{card.value}</strong>
                <span className={styles.cardNote}>{card.note}</span>
              </div>
            ))}
          </section>

          <section className={styles.panel}>
            <h2>Daily active users</h2>
            <Bars
              days={days}
              series={[{ label: "Users", values: days.map((day) => day.activeUsers) }]}
            />
          </section>

          <section className={styles.panel}>
            <h2>Saves and map searches</h2>
            <Bars
              days={days}
              series={[
                { label: "Saves", values: days.map((day) => day.propertySaves) },
                { label: "Searches", values: days.map((day) => day.mapSearches) },
              ]}
            />
          </section>

          <section className={styles.panel}>
            <h2>Most viewed screens</h2>
            {summary.topScreens.length === 0 ? (
              <p className={styles.empty}>No screen views recorded yet.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Screen</th>
                    <th>Views</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topScreens.slice(0, 15).map((row) => (
                    <tr key={row.screen}>
                      <td>{row.screen}</td>
                      <td>{row.views}</td>
                      <td>{Math.round((row.views / totalScreenViews) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
