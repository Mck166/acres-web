"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import GlassButton from "@/components/GlassButton";
import {
  changeVsPrevious,
  fetchAnalyticsSummary,
  formatDayLabel,
  formatDuration,
  isAdminUser,
  pointsVsPrevious,
  sumBy,
  RANGE_OPTIONS,
  RETENTION_DAYS,
  type AnalyticsSummary,
  type DayStats,
  type RangeDays,
} from "@/lib/adminAnalytics";
import styles from "@/components/AnalyticsDashboard.module.css";

type Theme = "light" | "dark";

const THEME_KEY = "acres:admin-theme";
const THEME_EVENT = "acres:admin-theme-change";

const number = new Intl.NumberFormat("en-CA");
const decimal = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 });

// The theme lives outside React so the first client render can read the stored
// choice without a hydration mismatch: the server snapshot is always light, and
// React swaps in the real value on hydration.
function subscribeTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
}

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Private browsing can refuse storage; fall back to the OS preference.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function writeTheme(next: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // The toggle still works for this visit, it just will not be remembered.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

type Metric = {
  key: string;
  label: string;
  /** null when the metric cannot be measured yet, shown as a dash. */
  value: number | null;
  previous: number | null;
  note: string;
  /** Longer explanation, surfaced as the card's tooltip. */
  hint?: string;
  /** Percentages compare in points, since a relative change of a rate reads
   * as nonsense ("40% to 45%" is not "+13%"). */
  changeMode?: "points";
  /** What the change chip is measured against, read out in its tooltip. */
  comparison: string;
  /** For metrics whose headline number cannot be compared, the chip falls back
   * to a related one that can. */
  compare?: {
    value: number;
    previous: number;
    note: string;
    format?: (value: number) => string;
  };
  format?: (value: number) => string;
  series?: number[];
  featured?: boolean;
  wide?: boolean;
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const peak = Math.max(...values, 1);
  const step = 100 / (values.length - 1);
  const points = values.map(
    (value, index) => `${(index * step).toFixed(2)},${(30 - (value / peak) * 26).toFixed(2)}`,
  );

  return (
    <svg
      className={styles.spark}
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`M0,32 ${points.map((point) => `L${point}`).join(" ")} L100,32 Z`}
        fill="currentColor"
        fillOpacity="0.14"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

type Series = {
  label: string;
  values: number[];
};

function Chart({
  days,
  series,
  comparison,
}: {
  days: DayStats[];
  series: Series[];
  comparison?: Series;
}) {
  const peak = Math.max(
    1,
    ...series.flatMap((item) => item.values),
    ...(comparison?.values ?? []),
  );
  const total = series.reduce(
    (sum, item) => sum + item.values.reduce((inner, value) => inner + value, 0),
    0,
  );
  const average = days.length ? total / days.length : 0;
  const labelEvery = Math.max(1, Math.ceil(days.length / 4));

  return (
    <div className={styles.chart}>
      <div className={styles.chartHead}>
        <div className={styles.legend}>
          {series.map((item, index) => (
            <span key={item.label} className={styles.legendItem}>
              <span className={`${styles.swatch} ${index === 1 ? styles.swatchAlt : ""}`} />
              {item.label}
            </span>
          ))}
          {comparison ? (
            <span className={styles.legendItem}>
              <span className={styles.swatchGhost} />
              {comparison.label}
            </span>
          ) : null}
        </div>
        <p className={styles.chartMeta}>
          Peak {number.format(peak)} · Avg {average.toFixed(average < 10 ? 1 : 0)} per day
        </p>
      </div>

      <div className={styles.plot}>
        <div className={styles.grid} aria-hidden="true">
          {[1, 0.5, 0].map((fraction) => (
            <div key={fraction} className={styles.gridLine}>
              <span>{number.format(Math.round(peak * fraction))}</span>
            </div>
          ))}
        </div>

        <div className={styles.bars}>
          {days.map((day, dayIndex) => (
            <div key={day.day} className={styles.slot}>
              <div className={styles.tip}>
                <strong>{formatDayLabel(day.day)}</strong>
                {series.map((item) => (
                  <span key={item.label}>
                    {item.label}
                    <b>{number.format(item.values[dayIndex])}</b>
                  </span>
                ))}
                {comparison ? (
                  <span className={styles.tipGhost}>
                    {comparison.label}
                    <b>{number.format(comparison.values[dayIndex] ?? 0)}</b>
                  </span>
                ) : null}
              </div>
              <div className={styles.stack}>
                {series.map((item, index) => (
                  <div
                    key={item.label}
                    className={`${styles.bar} ${index === 1 ? styles.barAlt : ""}`}
                    style={{ height: `${(item.values[dayIndex] / peak) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {comparison ? (
          <svg
            className={styles.overlay}
            viewBox={`0 0 ${days.length} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points={days
                .map(
                  (_, index) =>
                    `${index + 0.5},${100 - ((comparison.values[index] ?? 0) / peak) * 100}`,
                )
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
      </div>

      <div className={styles.xAxis} aria-hidden="true">
        {days.map((day, index) => (
          <span key={day.day} className={styles.xTick}>
            {index % labelEvery === 0 ? formatDayLabel(day.day) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12a8 8 0 1 1-2.6-5.9"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M20 4.4V9h-4.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AnalyticsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  const [range, setRange] = useState<RangeDays>(30);
  const [attempt, setAttempt] = useState(0);
  const [adminCheck, setAdminCheck] = useState<{ uid: string; allowed: boolean } | null>(null);
  const [snapshot, setSnapshot] = useState<{ summary: AnalyticsSummary; at: number } | null>(null);
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

  // The site header and footer sit outside this component, so the theme is
  // announced on the body for them to pick up while the dashboard is open.
  useEffect(() => {
    document.body.dataset.adminTheme = theme;
    return () => {
      delete document.body.dataset.adminTheme;
    };
  }, [theme]);

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
        setSnapshot({ summary: next, at: Date.now() });
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

  const summary = snapshot?.summary ?? null;
  const failed = failedKey === requestKey;
  const loading = isAdmin === true && !failed && loadedKey !== requestKey;
  const priorLabel = `previous ${range} days`;

  const metrics = useMemo<Metric[]>(() => {
    if (!summary) return [];
    const { days, totals, previous, retention, previousRetention } = summary;
    const today = days[days.length - 1];
    const yesterday = days[days.length - 2];
    const cohortWindow = `${formatDayLabel(retention.start)}–${formatDayLabel(retention.end)}`;

    return [
      {
        key: "users",
        label: "Total users",
        value: summary.totalUsers,
        previous: summary.totalUsers - totals.newUsers,
        note: "installs ever",
        comparison: `before this ${range}-day window`,
        featured: true,
      },
      {
        key: "active",
        label: "Active users",
        value: totals.uniqueUsers ?? totals.userDays,
        previous: null,
        note: "unique devices",
        comparison: priorLabel,
        featured: true,
        series: days.map((day) => day.activeUsers),
        // Unique devices cannot be counted for a past window, so the chip on
        // this card compares the daily average instead.
        compare: {
          value: totals.avgDailyUsers,
          previous: previous.avgDailyUsers,
          note: "a day",
          format: (value: number) => decimal.format(value),
        },
      },
      {
        key: "today",
        label: "Opened today",
        value: today?.activeUsers ?? 0,
        previous: yesterday?.activeUsers ?? null,
        note: "so far",
        comparison: "yesterday",
      },
      {
        key: "retention",
        label: "1-week retention",
        value: retention.rate,
        previous: previousRetention.rate,
        note: retention.cohort
          ? `${number.format(retention.retained)}/${number.format(retention.cohort)} came back`
          : "no installs old enough yet",
        hint:
          `Installs from ${cohortWindow} that opened the app again at least ` +
          `${RETENTION_DAYS} days after installing. Anyone who installed in the last ` +
          `${RETENTION_DAYS} days is excluded until they have had a full week.`,
        comparison: `${formatDayLabel(previousRetention.start)}–${formatDayLabel(
          previousRetention.end,
        )} cohort`,
        changeMode: "points",
        format: (value: number) => `${decimal.format(value)}%`,
      },
      {
        key: "saves",
        label: "Properties saved",
        value: totals.propertySaves,
        previous: previous.propertySaves,
        note: "in range",
        comparison: priorLabel,
        series: days.map((day) => day.propertySaves),
      },
      {
        key: "searches",
        label: "Map searches",
        value: totals.mapSearches,
        previous: previous.mapSearches,
        note: "in range",
        comparison: priorLabel,
        series: days.map((day) => day.mapSearches),
      },
      {
        key: "views",
        label: "Page views",
        value: totals.screenViews,
        previous: previous.screenViews,
        note: "in range",
        comparison: priorLabel,
        series: days.map((day) => day.screenViews),
      },
      {
        key: "installs",
        label: "New installs",
        value: totals.newUsers,
        previous: previous.newUsers,
        note: "in range",
        comparison: priorLabel,
        series: days.map((day) => day.newUsers),
      },
      {
        key: "time",
        label: "Time per user",
        value: totals.secondsPerUserDay,
        previous: previous.secondsPerUserDay,
        note: "per active day",
        comparison: priorLabel,
        format: formatDuration,
        wide: true,
        series: days.map((day) =>
          day.activeUsers ? day.foregroundSeconds / day.activeUsers : 0,
        ),
      },
    ];
  }, [priorLabel, range, summary]);

  const shellProps = { className: styles.shell, "data-theme": theme };

  if (isAdmin === null) {
    return (
      <div {...shellProps}>
        <div className={styles.inner}>
          <div className={styles.status}>
            <div className={styles.spinner} aria-hidden="true" />
            <p>Checking access…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div {...shellProps}>
        <div className={styles.inner}>
          <div className={styles.status}>
            <h1>Please sign in</h1>
            <p>
              <Link href="/login?next=/admin/analytics">Login</Link> with an admin account to see
              the dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div {...shellProps}>
        <div className={styles.inner}>
          <div className={styles.status}>
            <h1>Not authorized</h1>
            <p>This page is only available to Acres admins.</p>
          </div>
        </div>
      </div>
    );
  }

  const days = summary?.days ?? [];
  const previousDays = summary?.previousDays ?? [];
  const totalScreenViews = summary?.totals.screenViews || 1;
  const topScreens = summary?.topScreens.slice(0, 10) ?? [];
  const topScreenViews = topScreens[0]?.views || 1;
  const busiest = days.reduce<DayStats | null>(
    (best, day) => (!best || day.activeUsers > best.activeUsers ? day : best),
    null,
  );

  return (
    <div {...shellProps}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.headline}>
            <p className={styles.kicker}>
              <span className={styles.pulse} aria-hidden="true" />
              Acres admin
            </p>
            <h1>App analytics</h1>
            <p className={styles.lead}>
              Last {range} days against the {priorLabel}, bucketed by Atlantic day.
              {snapshot ? (
                <span className={styles.stamp}>
                  Updated{" "}
                  {new Date(snapshot.at).toLocaleTimeString("en-CA", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
            </p>
          </div>

          <div className={styles.controls}>
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

            <button
              type="button"
              className={`${styles.iconButton} ${loading ? styles.iconButtonBusy : ""}`}
              onClick={() => setAttempt((count) => count + 1)}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshIcon />
            </button>

            <button
              type="button"
              className={styles.themeToggle}
              onClick={() => writeTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              <span className={styles.themeKnob} aria-hidden="true" />
              <span className={styles.themeIcon}>
                <SunIcon />
              </span>
              <span className={styles.themeIcon}>
                <MoonIcon />
              </span>
            </button>
          </div>
        </header>

        {failed ? (
          <div className={styles.status}>
            <p className={styles.error}>Could not load analytics. Please try again.</p>
            <GlassButton title="Try again" onClick={() => setAttempt((count) => count + 1)} />
          </div>
        ) : null}

        {loading && !summary ? (
          <div className={styles.skeleton}>
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className={styles.skeletonCard} />
            ))}
          </div>
        ) : null}

        {summary ? (
          <div className={loading ? styles.stale : undefined}>
            <section className={styles.cards}>
              {metrics.map((metric, index) => {
                const compare = metric.compare;
                const current = compare ? compare.value : metric.value;
                const before = compare ? compare.previous : metric.previous;
                const format = metric.format ?? ((value: number) => number.format(value));
                const formatDelta = compare?.format ?? format;
                const change =
                  current === null
                    ? null
                    : metric.changeMode === "points"
                      ? pointsVsPrevious(current, before)
                      : changeVsPrevious(current, before);
                // A rounded "was" that reads the same as the headline looks
                // like a rendering bug, so only show one that differs.
                const prior =
                  before === null ||
                  (!compare && metric.value !== null && format(before) === format(metric.value))
                    ? null
                    : compare && current !== null
                      ? ` · ${formatDelta(current)} vs ${formatDelta(before)} ${compare.note}`
                      : ` · was ${format(before)}`;

                return (
                  <article
                    key={metric.key}
                    className={`${styles.card} ${metric.featured ? styles.cardFeatured : ""} ${
                      metric.wide ? styles.cardWide : ""
                    }`}
                    style={{ animationDelay: `${index * 45}ms` }}
                    title={metric.hint}
                  >
                    <div className={styles.cardTop}>
                      <span className={styles.cardLabel}>{metric.label}</span>
                      {change ? (
                        <span
                          className={`${styles.trend} ${styles[`trend${change.direction}`]}`}
                          title={`${current === null ? "—" : formatDelta(current)} vs ${
                            before === null ? "—" : formatDelta(before)
                          }${compare ? ` ${compare.note}` : ""} in the ${metric.comparison}`}
                        >
                          {change.direction === "up"
                            ? "▲"
                            : change.direction === "down"
                              ? "▼"
                              : "■"}{" "}
                          {change.label}
                        </span>
                      ) : null}
                    </div>
                    <strong className={styles.cardValue}>
                      {metric.value === null ? "—" : format(metric.value)}
                    </strong>
                    <span className={styles.cardNote}>
                      {metric.note}
                      {prior ? <span className={styles.cardPrior}>{prior}</span> : null}
                    </span>
                    {metric.series ? (
                      <div className={styles.cardSpark}>
                        <Sparkline values={metric.series} />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Daily active users</h2>
                {busiest && busiest.activeUsers > 0 ? (
                  <p className={styles.panelNote}>
                    Busiest day was {formatDayLabel(busiest.day)} with{" "}
                    {number.format(busiest.activeUsers)}
                  </p>
                ) : null}
              </div>
              <Chart
                days={days}
                series={[{ label: "Users", values: days.map((day) => day.activeUsers) }]}
                comparison={{
                  label: `Previous ${range}d`,
                  values: previousDays.map((day) => day.activeUsers),
                }}
              />
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Saves and map searches</h2>
                <p className={styles.panelNote}>What people actually do once they are in</p>
              </div>
              <Chart
                days={days}
                series={[
                  { label: "Saves", values: days.map((day) => day.propertySaves) },
                  { label: "Searches", values: days.map((day) => day.mapSearches) },
                ]}
                comparison={{
                  label: `Previous ${range}d saves`,
                  values: previousDays.map((day) => day.propertySaves),
                }}
              />
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h2>Most viewed screens</h2>
                <p className={styles.panelNote}>
                  {number.format(sumBy(days, "screenViews"))} views across{" "}
                  {summary.topScreens.length} screens
                </p>
              </div>
              {topScreens.length === 0 ? (
                <p className={styles.empty}>No screen views recorded yet.</p>
              ) : (
                <ol className={styles.ranks}>
                  {topScreens.map((row, index) => (
                    <li key={row.screen} className={styles.rank}>
                      <span className={styles.rankIndex}>{index + 1}</span>
                      <span className={styles.rankName}>{row.screen}</span>
                      <span className={styles.rankTrack}>
                        <span
                          className={styles.rankFill}
                          style={{ width: `${(row.views / topScreenViews) * 100}%` }}
                        />
                      </span>
                      <span className={styles.rankValue}>{number.format(row.views)}</span>
                      <span className={styles.rankShare}>
                        {Math.round((row.views / totalScreenViews) * 100)}%
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
