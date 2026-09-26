"use client";

import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";

// Reads the counters the API writes from app events. See Acres-API/analytics.py
// for the shape. Everything here is admin-only at the rules level, so a signed
// out or non-admin visitor gets a permission error rather than empty data.
//
// Every load covers twice the selected range: the window on screen and the one
// immediately before it, so each number can be shown against its own past.

export type DayStats = {
  day: string;
  sessions: number;
  newUsers: number;
  screenViews: number;
  propertySaves: number;
  mapSearches: number;
  foregroundSeconds: number;
  activeUsers: number;
  screens: Record<string, number>;
};

export type PeriodTotals = {
  /** Distinct devices that opened the app in the window. Only exact for the
   * current window: `lastSeen` holds one timestamp per device, so a device
   * active in both windows counts only against the newer one. */
  uniqueUsers: number | null;
  /** Active users summed across days, i.e. user-days. Exact for any window. */
  userDays: number;
  avgDailyUsers: number;
  sessions: number;
  newUsers: number;
  screenViews: number;
  propertySaves: number;
  mapSearches: number;
  foregroundSeconds: number;
  secondsPerUserDay: number;
};

export type Retention = {
  /** Installs in the window, counted only once they are old enough to judge. */
  cohort: number;
  retained: number;
  /** Percent of the cohort that came back, or null when the cohort is empty. */
  rate: number | null;
  start: string;
  end: string;
};

export type AnalyticsSummary = {
  days: DayStats[];
  previousDays: DayStats[];
  totals: PeriodTotals;
  previous: PeriodTotals;
  retention: Retention;
  previousRetention: Retention;
  totalUsers: number;
  topScreens: { screen: string; views: number }[];
};

/** How long after installing someone has to reappear to count as retained. */
export const RETENTION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const RANGE_OPTIONS = [7, 30, 90] as const;

export type RangeDays = (typeof RANGE_OPTIONS)[number];

const ATLANTIC_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Halifax",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Day keys, oldest first, in the America/Halifax dates the API buckets by. */
export function rangeDays(days: number, today = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const moment = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    keys.push(ATLANTIC_DATE.format(moment));
  }
  return keys;
}

/** Halifax is UTC-4 in winter and UTC-3 in summer, so try both and keep the
 * one that formats back to the day we asked for. */
function atlanticMidnight(day: string): Date {
  const standard = new Date(`${day}T04:00:00Z`);
  if (ATLANTIC_DATE.format(standard) === day) return standard;
  return new Date(`${day}T03:00:00Z`);
}

function emptyDay(day: string): DayStats {
  return {
    day,
    sessions: 0,
    newUsers: 0,
    screenViews: 0,
    propertySaves: 0,
    mapSearches: 0,
    foregroundSeconds: 0,
    activeUsers: 0,
    screens: {},
  };
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const timestamp = value as { toDate?: () => Date } | null;
  if (timestamp && typeof timestamp.toDate === "function") return timestamp.toDate();
  return null;
}

function toScreens(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const screens: Record<string, number> = {};
  for (const [name, count] of Object.entries(value as Record<string, unknown>)) {
    const views = toNumber(count);
    if (views) screens[name] = views;
  }
  return screens;
}

export async function isAdminUser(): Promise<boolean> {
  const current = getFirebaseAuth().currentUser;
  if (!current) return false;
  const token = await current.getIdTokenResult();
  return token.claims.admin === true;
}

async function countActiveUsers(day: string): Promise<number> {
  const db = getFirebaseDb();
  const snapshot = await getCountFromServer(
    collection(doc(db, "analytics_daily", day), "active"),
  );
  return snapshot.data().count;
}

/** One-week retention for the two most recent *mature* cohorts.
 *
 * A cohort only counts once every install in it has had a full week to come
 * back, so both windows end `RETENTION_DAYS` ago rather than today. Firestore
 * cannot compare two fields in a query, so the `lastSeen >= firstSeen + 7d`
 * test happens here over the cohort documents.
 */
async function fetchRetention(days: number, now: Date): Promise<[Retention, Retention]> {
  const db = getFirebaseDb();
  const span = days * DAY_MS;
  const matureEnd = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
  const currentStart = new Date(matureEnd.getTime() - span);
  const priorStart = new Date(currentStart.getTime() - span);

  const installs = await getDocs(
    query(
      collection(db, "analytics_users"),
      where("firstSeen", ">=", priorStart),
      where("firstSeen", "<", matureEnd),
      orderBy("firstSeen"),
    ),
  );

  const current: Retention = {
    cohort: 0,
    retained: 0,
    rate: null,
    start: ATLANTIC_DATE.format(currentStart),
    end: ATLANTIC_DATE.format(matureEnd),
  };
  const prior: Retention = {
    cohort: 0,
    retained: 0,
    rate: null,
    start: ATLANTIC_DATE.format(priorStart),
    end: ATLANTIC_DATE.format(currentStart),
  };

  for (const snapshot of installs.docs) {
    const data = snapshot.data();
    const firstSeen = toDate(data.firstSeen);
    if (!firstSeen) continue;
    const lastSeen = toDate(data.lastSeen);
    const bucket = firstSeen >= currentStart ? current : prior;
    bucket.cohort += 1;
    if (lastSeen && lastSeen.getTime() - firstSeen.getTime() >= RETENTION_DAYS * DAY_MS) {
      bucket.retained += 1;
    }
  }

  for (const bucket of [current, prior]) {
    bucket.rate = bucket.cohort ? (bucket.retained / bucket.cohort) * 100 : null;
  }
  return [current, prior];
}

function totalsOf(days: DayStats[], uniqueUsers: number | null): PeriodTotals {
  const userDays = sumBy(days, "activeUsers");
  const foregroundSeconds = sumBy(days, "foregroundSeconds");
  return {
    uniqueUsers,
    userDays,
    avgDailyUsers: days.length ? userDays / days.length : 0,
    sessions: sumBy(days, "sessions"),
    newUsers: sumBy(days, "newUsers"),
    screenViews: sumBy(days, "screenViews"),
    propertySaves: sumBy(days, "propertySaves"),
    mapSearches: sumBy(days, "mapSearches"),
    foregroundSeconds,
    secondsPerUserDay: userDays ? foregroundSeconds / userDays : 0,
  };
}

export async function fetchAnalyticsSummary(days: RangeDays): Promise<AnalyticsSummary> {
  const db = getFirebaseDb();
  const keys = rangeDays(days * 2);
  const previousKeys = keys.slice(0, days);
  const currentKeys = keys.slice(days);
  const byDay = new Map(keys.map((day) => [day, emptyDay(day)]));

  // One ranged read over document ids covers both windows.
  const counters = await getDocs(
    query(
      collection(db, "analytics_daily"),
      where(documentId(), ">=", keys[0]),
      where(documentId(), "<=", keys[keys.length - 1]),
      orderBy(documentId()),
    ),
  );

  for (const snapshot of counters.docs) {
    const existing = byDay.get(snapshot.id);
    if (!existing) continue;
    const data = snapshot.data();
    existing.sessions = toNumber(data.sessions);
    existing.newUsers = toNumber(data.newUsers);
    existing.screenViews = toNumber(data.screenViews);
    existing.propertySaves = toNumber(data.propertySaves);
    existing.mapSearches = toNumber(data.mapSearches);
    existing.foregroundSeconds = toNumber(data.foregroundSeconds);
    existing.screens = toScreens(data.screens);
  }

  // Unique devices per day live in a subcollection, so each day is its own
  // aggregation query. Only days that saw a session can have one.
  const withSessions = keys.filter((day) => (byDay.get(day)?.sessions ?? 0) > 0);
  const activeCounts = await Promise.all(
    withSessions.map(async (day) => [day, await countActiveUsers(day)] as const),
  );
  for (const [day, count] of activeCounts) {
    const existing = byDay.get(day);
    if (existing) existing.activeUsers = count;
  }

  const [totalUsers, uniqueUsers, [retention, previousRetention]] = await Promise.all([
    getCountFromServer(collection(db, "analytics_users")).then((snap) => snap.data().count),
    getCountFromServer(
      query(
        collection(db, "analytics_users"),
        where("lastSeen", ">=", atlanticMidnight(currentKeys[0])),
      ),
    ).then((snap) => snap.data().count),
    fetchRetention(days, new Date()),
  ]);

  const current = currentKeys.map((day) => byDay.get(day) ?? emptyDay(day));
  const earlier = previousKeys.map((day) => byDay.get(day) ?? emptyDay(day));

  const screenTotals = new Map<string, number>();
  for (const day of current) {
    for (const [screen, views] of Object.entries(day.screens)) {
      screenTotals.set(screen, (screenTotals.get(screen) ?? 0) + views);
    }
  }

  return {
    days: current,
    previousDays: earlier,
    totals: totalsOf(current, uniqueUsers),
    previous: totalsOf(earlier, null),
    retention,
    previousRetention,
    totalUsers,
    topScreens: Array.from(screenTotals.entries())
      .map(([screen, views]) => ({ screen, views }))
      .sort((a, b) => b.views - a.views),
  };
}

export function sumBy(days: DayStats[], key: keyof DayStats): number {
  return days.reduce((total, day) => total + toNumber(day[key]), 0);
}

export type Change = {
  direction: "up" | "down" | "flat";
  label: string;
};

/** Percentage change against the same metric in the previous window. */
export function changeVsPrevious(current: number, previous: number | null): Change | null {
  if (previous === null) return null;
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { direction: "up", label: "New" };

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { direction: "flat", label: "Flat" };
  return {
    direction: percent > 0 ? "up" : "down",
    label: `${percent > 0 ? "+" : ""}${percent}%`,
  };
}

/** Change for metrics that are already percentages, where a relative change
 * ("40% to 45% is +13%") reads as nonsense. */
export function pointsVsPrevious(current: number, previous: number | null): Change | null {
  if (previous === null) return null;
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return { direction: "flat", label: "Flat" };
  return {
    direction: delta > 0 ? "up" : "down",
    label: `${delta > 0 ? "+" : ""}${delta} pts`,
  };
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.round(seconds)}s`;
}

export function formatDayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}
