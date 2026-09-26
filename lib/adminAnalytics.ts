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
// of the same length immediately before it, so each number can be shown against
// its own past.

export type DayStats = {
  day: string;
  sessions: number;
  newUsers: number;
  screenViews: number;
  propertySaves: number;
  mapSearches: number;
  propertyShares: number;
  profileShares: number;
  pushesSent: number;
  foregroundSeconds: number;
  activeUsers: number;
  screens: Record<string, number>;
  pushes: Record<string, number>;
};

export type PeriodTotals = {
  /** Distinct devices that opened the app in the window. Only known when the
   * window ends today: `lastSeen` holds one timestamp per device, so a window
   * in the past cannot be counted. */
  uniqueUsers: number | null;
  /** Active users summed across days, i.e. user-days. Exact for any window. */
  userDays: number;
  avgDailyUsers: number;
  sessions: number;
  newUsers: number;
  screenViews: number;
  propertySaves: number;
  mapSearches: number;
  propertyShares: number;
  profileShares: number;
  pushesSent: number;
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

/** Inclusive Atlantic day keys, YYYY-MM-DD. */
export type DateRange = {
  start: string;
  end: string;
};

export type AnalyticsSummary = {
  range: DateRange;
  endsToday: boolean;
  days: DayStats[];
  previousDays: DayStats[];
  totals: PeriodTotals;
  previous: PeriodTotals;
  retention: Retention;
  previousRetention: Retention;
  /** Installs up to the end of the range. */
  totalUsers: number;
  topScreens: { screen: string; views: number }[];
  pushKinds: { kind: string; count: number }[];
};

/** How long after installing someone has to reappear to count as retained. */
export const RETENTION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const PRESET_DAYS = [7, 30, 90] as const;

export type PresetDays = (typeof PRESET_DAYS)[number];

/** Each day in a range is its own count query, so very long ranges are capped. */
export const MAX_RANGE_DAYS = 366;

const COUNT_CONCURRENCY = 25;

export const PUSH_KIND_LABELS: Record<string, string> = {
  listing: "Saved listing alerts",
  inactivity: "Come-back nudges",
  downpayment: "Down payment reminders",
  viewing: "Viewing updates",
  reminder: "Viewing reminders",
  client: "Client requests",
};

const ATLANTIC_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Halifax",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Today's Atlantic date, the day the API is currently writing into. */
export function todayKey(now = new Date()): string {
  return ATLANTIC_DATE.format(now);
}

export function isDayKey(value: string): boolean {
  if (!DAY_KEY.test(value)) return false;
  const [year, month, date] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.toISOString().slice(0, 10) === value;
}

/** Calendar arithmetic on a day key; no time zone is involved. */
export function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

export function rangeLength(range: DateRange): number {
  const [sy, sm, sd] = range.start.split("-").map(Number);
  const [ey, em, ed] = range.end.split("-").map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / DAY_MS) + 1;
}

/** Day keys, oldest first. */
export function daysIn(range: DateRange): string[] {
  const length = rangeLength(range);
  const keys: string[] = [];
  for (let offset = 0; offset < length; offset += 1) {
    keys.push(addDays(range.start, offset));
  }
  return keys;
}

/** The last `days` days, ending today. */
export function presetRange(days: number, now = new Date()): DateRange {
  const end = todayKey(now);
  return { start: addDays(end, -(days - 1)), end };
}

/** The window of the same length that ends the day before `range` starts. */
export function previousRange(range: DateRange): DateRange {
  const length = rangeLength(range);
  return { start: addDays(range.start, -length), end: addDays(range.start, -1) };
}

/** Why a picked range cannot be loaded, or null when it can. */
export function validateRange(range: DateRange, now = new Date()): string | null {
  if (!isDayKey(range.start) || !isDayKey(range.end)) return "Pick a valid date.";
  if (range.start > range.end) return "The start date must be on or before the end date.";
  if (range.end > todayKey(now)) return "Dates cannot be in the future.";
  if (rangeLength(range) > MAX_RANGE_DAYS) {
    return `Ranges are limited to ${MAX_RANGE_DAYS} days.`;
  }
  return null;
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
    propertyShares: 0,
    profileShares: 0,
    pushesSent: 0,
    foregroundSeconds: 0,
    activeUsers: 0,
    screens: {},
    pushes: {},
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

function toCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const counts: Record<string, number> = {};
  for (const [name, count] of Object.entries(value as Record<string, unknown>)) {
    const total = toNumber(count);
    if (total) counts[name] = total;
  }
  return counts;
}

function addCounts(into: Map<string, number>, counts: Record<string, number>) {
  for (const [name, count] of Object.entries(counts)) {
    into.set(name, (into.get(name) ?? 0) + count);
  }
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

async function inBatches<T, R>(items: T[], size: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    results.push(...(await Promise.all(items.slice(index, index + size).map(task))));
  }
  return results;
}

/** One-week retention for the selected range and the one before it.
 *
 * A cohort only counts once every install in it has had a full week to come
 * back, so a window that reaches into the last `RETENTION_DAYS` days is slid
 * back until it no longer does. Firestore cannot compare two fields in a
 * query, so the `lastSeen >= firstSeen + 7d` test happens here over the cohort
 * documents.
 */
async function fetchRetention(range: DateRange, now: Date): Promise<[Retention, Retention]> {
  const db = getFirebaseDb();
  const span = rangeLength(range) * DAY_MS;
  const matureLimit = now.getTime() - RETENTION_DAYS * DAY_MS;
  const rangeEnd = atlanticMidnight(addDays(range.end, 1)).getTime();
  const matureEnd = new Date(Math.min(rangeEnd, matureLimit));
  const currentStart = new Date(matureEnd.getTime() - span);
  const priorStart = new Date(currentStart.getTime() - span);
  // The window ends are exclusive, so the labels show the moment just before.
  const lastIn = (end: Date) => ATLANTIC_DATE.format(new Date(end.getTime() - 1));

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
    end: lastIn(matureEnd),
  };
  const prior: Retention = {
    cohort: 0,
    retained: 0,
    rate: null,
    start: ATLANTIC_DATE.format(priorStart),
    end: lastIn(currentStart),
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
    propertyShares: sumBy(days, "propertyShares"),
    profileShares: sumBy(days, "profileShares"),
    pushesSent: sumBy(days, "pushesSent"),
    foregroundSeconds,
    secondsPerUserDay: userDays ? foregroundSeconds / userDays : 0,
  };
}

export async function fetchAnalyticsSummary(range: DateRange): Promise<AnalyticsSummary> {
  const db = getFirebaseDb();
  const now = new Date();
  const currentKeys = daysIn(range);
  const previousKeys = daysIn(previousRange(range));
  const keys = [...previousKeys, ...currentKeys];
  const byDay = new Map(keys.map((day) => [day, emptyDay(day)]));
  const endsToday = range.end === todayKey(now);

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
    existing.propertyShares = toNumber(data.propertyShares);
    existing.profileShares = toNumber(data.profileShares);
    existing.pushesSent = toNumber(data.pushesSent);
    existing.foregroundSeconds = toNumber(data.foregroundSeconds);
    existing.screens = toCounts(data.screens);
    existing.pushes = toCounts(data.pushes);
  }

  // Unique devices per day live in a subcollection, so each day is its own
  // aggregation query. Only days that saw a session can have one.
  const withSessions = keys.filter((day) => (byDay.get(day)?.sessions ?? 0) > 0);
  const activeCounts = await inBatches(withSessions, COUNT_CONCURRENCY, async (day) => {
    return [day, await countActiveUsers(day)] as const;
  });
  for (const [day, count] of activeCounts) {
    const existing = byDay.get(day);
    if (existing) existing.activeUsers = count;
  }

  const [totalUsers, uniqueUsers, [retention, previousRetention]] = await Promise.all([
    getCountFromServer(
      query(
        collection(db, "analytics_users"),
        where("firstSeen", "<", atlanticMidnight(addDays(range.end, 1))),
      ),
    ).then((snap) => snap.data().count),
    endsToday
      ? getCountFromServer(
          query(
            collection(db, "analytics_users"),
            where("lastSeen", ">=", atlanticMidnight(range.start)),
          ),
        ).then((snap) => snap.data().count)
      : Promise.resolve(null),
    fetchRetention(range, now),
  ]);

  const current = currentKeys.map((day) => byDay.get(day) ?? emptyDay(day));
  const earlier = previousKeys.map((day) => byDay.get(day) ?? emptyDay(day));

  const screenTotals = new Map<string, number>();
  const pushTotals = new Map<string, number>();
  for (const day of current) {
    addCounts(screenTotals, day.screens);
    addCounts(pushTotals, day.pushes);
  }

  return {
    range,
    endsToday,
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
    pushKinds: Array.from(pushTotals.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
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

export function formatDayLong(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Sep 22, 2026", "Sep 1 – 22, 2026" style labels, keeping the year only where
 * it is needed to be unambiguous. */
export function formatRangeLabel(range: DateRange): string {
  if (range.start === range.end) return formatDayLong(range.start);
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  const start = sameYear ? formatDayLabel(range.start) : formatDayLong(range.start);
  return `${start} – ${formatDayLong(range.end)}`;
}
