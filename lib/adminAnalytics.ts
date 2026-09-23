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

export type AnalyticsSummary = {
  days: DayStats[];
  totalUsers: number;
  usersInRange: number;
  topScreens: { screen: string; views: number }[];
};

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

export async function fetchAnalyticsSummary(days: RangeDays): Promise<AnalyticsSummary> {
  const db = getFirebaseDb();
  const keys = rangeDays(days);
  const byDay = new Map(keys.map((day) => [day, emptyDay(day)]));

  // One ranged read over document ids rather than a get per day.
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

  const [totalUsers, usersInRange] = await Promise.all([
    getCountFromServer(collection(db, "analytics_users")).then((snap) => snap.data().count),
    getCountFromServer(
      query(
        collection(db, "analytics_users"),
        where("lastSeen", ">=", atlanticMidnight(keys[0])),
      ),
    ).then((snap) => snap.data().count),
  ]);

  const screenTotals = new Map<string, number>();
  for (const day of byDay.values()) {
    for (const [screen, views] of Object.entries(day.screens)) {
      screenTotals.set(screen, (screenTotals.get(screen) ?? 0) + views);
    }
  }

  return {
    days: keys.map((day) => byDay.get(day) ?? emptyDay(day)),
    totalUsers,
    usersInRange,
    topScreens: Array.from(screenTotals.entries())
      .map(([screen, views]) => ({ screen, views }))
      .sort((a, b) => b.views - a.views),
  };
}

export function sumBy(days: DayStats[], key: keyof DayStats): number {
  return days.reduce((total, day) => total + toNumber(day[key]), 0);
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
