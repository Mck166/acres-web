"use client";

import {
  collection,
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
  addDays,
  atlanticMidnight,
  daysIn,
  previousRange,
  toCounts,
  toDate,
  toNumber,
  todayKey,
  type DateRange,
} from "@/lib/adminAnalytics";

// Reads what the API writes for the /for-agents sales funnel. See
// Acres-API/agent_sites.py for the shape. Admin-only at the rules level.
//
// Two views of the same funnel are loaded:
//
// * Daily counters, for the time series and event totals (views, clicks,
//   checkouts, sales, revenue), for the selected range and the one before it.
// * Visitor documents for everyone whose first visit falls in either range.
//   Each records when that visitor first reached each step, so the funnel and
//   the source table count people rather than clicks.

export type FunnelDay = {
  day: string;
  views: number;
  newVisitors: number;
  demoClicks: number;
  pricingViews: number;
  ctaClicks: number;
  faqOpens: number;
  checkoutStarts: number;
  checkoutCancels: number;
  welcomeViews: number;
  purchases: number;
  payments: number;
  revenueCents: number;
  cancellations: number;
  onboardings: number;
  engagedSeconds: number;
  engagedVisits: number;
  ctas: Record<string, number>;
  faqs: Record<string, number>;
  demos: Record<string, number>;
  scroll: Record<string, number>;
  sources: Record<string, number>;
  devices: Record<string, number>;
  saleSources: Record<string, number>;
};

type NumericKey = {
  [K in keyof FunnelDay]: FunnelDay[K] extends number ? K : never;
}[keyof FunnelDay];

type MapKey = {
  [K in keyof FunnelDay]: FunnelDay[K] extends Record<string, number> ? K : never;
}[keyof FunnelDay];

const NUMERIC_KEYS: NumericKey[] = [
  "views",
  "newVisitors",
  "demoClicks",
  "pricingViews",
  "ctaClicks",
  "faqOpens",
  "checkoutStarts",
  "checkoutCancels",
  "welcomeViews",
  "purchases",
  "payments",
  "revenueCents",
  "cancellations",
  "onboardings",
  "engagedSeconds",
  "engagedVisits",
];

const MAP_KEYS: MapKey[] = ["ctas", "faqs", "demos", "scroll", "sources", "devices", "saleSources"];

export type FunnelTotals = Record<NumericKey, number>;

/** How far the visitors who first arrived in a window got. */
export type Cohort = {
  visitors: number;
  pricing: number;
  demo: number;
  checkout: number;
  purchased: number;
  /** Purchases among visitors who opened the demo, to show what it is worth. */
  demoPurchased: number;
  /** Average hours from first visit to purchase, or null with no purchases. */
  hoursToBuy: number | null;
};

export type BreakdownRow = {
  name: string;
  visitors: number;
  demo: number;
  checkout: number;
  purchased: number;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  brokerage: string;
  source: string;
  status: string;
  monthlyCents: number;
  currency: string;
  createdAt: Date | null;
  onboarded: boolean;
  cancelAtPeriodEnd: boolean;
};

export type FunnelSummary = {
  range: DateRange;
  endsToday: boolean;
  days: FunnelDay[];
  previousDays: FunnelDay[];
  totals: FunnelTotals;
  previous: FunnelTotals;
  cohort: Cohort;
  previousCohort: Cohort;
  sources: BreakdownRow[];
  devices: BreakdownRow[];
  ctas: { name: string; value: number }[];
  faqs: { name: string; value: number }[];
  demos: { name: string; value: number }[];
  scroll: { name: string; value: number }[];
  activeSubscribers: number;
  mrrCents: number;
  totalCustomers: number;
  currency: string;
  recentCustomers: Customer[];
  /** True when the visitor read hit its cap and the cohort is a sample. */
  capped: boolean;
};

/** Visitor documents read per load. A funnel this size is well past needing it. */
const MAX_VISITORS = 20000;
const RECENT_CUSTOMERS = 12;
const LIVE_STATUSES = ["active", "trialing", "past_due"];

export const FUNNEL_LABELS: Record<string, string> = {
  hero: "Hero",
  offer: "Offer box",
  final: "Final call to action",
  sticky: "Sticky mobile bar",
  preview: "Demo preview",
  contract: "Is there a contract?",
  guarantee: "What if I do not like it?",
  listings: "Where do the listings come from?",
  domain: "Can I use my own domain?",
  brokerage: "Will my brokerage allow it?",
  effort: "How much work is it for me?",
  leads: "Will it actually bring me leads?",
  changes: "What counts as an edit?",
  direct: "Direct / unknown",
  mobile: "Phone",
  tablet: "Tablet",
  desktop: "Desktop",
};

export function funnelLabel(name: string): string {
  return FUNNEL_LABELS[name] ?? name;
}

function emptyDay(day: string): FunnelDay {
  const numbers = Object.fromEntries(NUMERIC_KEYS.map((key) => [key, 0])) as Record<
    NumericKey,
    number
  >;
  const maps = Object.fromEntries(MAP_KEYS.map((key) => [key, {}])) as Record<
    MapKey,
    Record<string, number>
  >;
  return { day, ...numbers, ...maps };
}

function emptyCohort(): Cohort {
  return {
    visitors: 0,
    pricing: 0,
    demo: 0,
    checkout: 0,
    purchased: 0,
    demoPurchased: 0,
    hoursToBuy: null,
  };
}

function totalsOf(days: FunnelDay[]): FunnelTotals {
  const totals = Object.fromEntries(NUMERIC_KEYS.map((key) => [key, 0])) as FunnelTotals;
  for (const day of days) {
    for (const key of NUMERIC_KEYS) totals[key] += day[key];
  }
  return totals;
}

function rankedMap(days: FunnelDay[], key: MapKey): { name: string; value: number }[] {
  const merged = new Map<string, number>();
  for (const day of days) {
    for (const [name, count] of Object.entries(day[key])) {
      merged.set(name, (merged.get(name) ?? 0) + count);
    }
  }
  return Array.from(merged.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

type VisitorDoc = {
  firstSeen: Date;
  pricing: boolean;
  demo: boolean;
  checkout: boolean;
  purchasedAt: Date | null;
  landedAt: Date | null;
  source: string;
  device: string;
};

function cohortOf(visitors: VisitorDoc[]): Cohort {
  const cohort = emptyCohort();
  let hours = 0;
  for (const visitor of visitors) {
    cohort.visitors += 1;
    if (visitor.pricing) cohort.pricing += 1;
    if (visitor.demo) cohort.demo += 1;
    if (visitor.checkout) cohort.checkout += 1;
    if (visitor.purchasedAt) {
      cohort.purchased += 1;
      if (visitor.demo) cohort.demoPurchased += 1;
      const start = visitor.landedAt ?? visitor.firstSeen;
      hours += Math.max(0, visitor.purchasedAt.getTime() - start.getTime()) / 3_600_000;
    }
  }
  cohort.hoursToBuy = cohort.purchased ? hours / cohort.purchased : null;
  return cohort;
}

function breakdown(visitors: VisitorDoc[], key: "source" | "device"): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  for (const visitor of visitors) {
    const name = visitor[key] || (key === "source" ? "direct" : "desktop");
    const row = rows.get(name) ?? { name, visitors: 0, demo: 0, checkout: 0, purchased: 0 };
    row.visitors += 1;
    if (visitor.demo) row.demo += 1;
    if (visitor.checkout) row.checkout += 1;
    if (visitor.purchasedAt) row.purchased += 1;
    rows.set(name, row);
  }
  return Array.from(rows.values()).sort(
    (a, b) => b.purchased - a.purchased || b.visitors - a.visitors,
  );
}

async function fetchVisitors(range: DateRange) {
  const db = getFirebaseDb();
  const earlier = previousRange(range);
  const start = atlanticMidnight(earlier.start);
  const split = atlanticMidnight(range.start);
  const end = atlanticMidnight(addDays(range.end, 1));

  const snapshot = await getDocs(
    query(
      collection(db, "agent_funnel_visitors"),
      where("firstSeen", ">=", start),
      where("firstSeen", "<", end),
      orderBy("firstSeen"),
      limit(MAX_VISITORS),
    ),
  );

  const current: VisitorDoc[] = [];
  const prior: VisitorDoc[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const firstSeen = toDate(data.firstSeen);
    if (!firstSeen) continue;
    const landedAt = toDate(data.landedAt);
    // Someone who only ever saw the welcome page bought on another device;
    // they are not a landing page visitor.
    if (!landedAt) continue;
    const visitor: VisitorDoc = {
      firstSeen,
      landedAt,
      pricing: Boolean(data.pricingAt),
      demo: Boolean(data.demoAt),
      checkout: Boolean(data.checkoutAt),
      purchasedAt: toDate(data.purchasedAt),
      source: typeof data.source === "string" ? data.source : "direct",
      device: typeof data.device === "string" ? data.device : "desktop",
    };
    (firstSeen >= split ? current : prior).push(visitor);
  }
  return { current, prior, capped: snapshot.size >= MAX_VISITORS };
}

async function fetchCustomers() {
  const db = getFirebaseDb();
  const customers = collection(db, "agent_site_customers");
  const [recent, live, total] = await Promise.all([
    getDocs(query(customers, orderBy("createdAt", "desc"), limit(RECENT_CUSTOMERS))),
    getDocs(query(customers, where("status", "in", LIVE_STATUSES))),
    getCountFromServer(customers).then((snap) => snap.data().count),
  ]);

  const toCustomer = (id: string, data: Record<string, unknown>): Customer => ({
    id,
    name: typeof data.name === "string" ? data.name : "",
    email: typeof data.email === "string" ? data.email : "",
    brokerage: typeof data.brokerage === "string" ? data.brokerage : "",
    source: typeof data.source === "string" ? data.source : "direct",
    status: typeof data.status === "string" ? data.status : "active",
    monthlyCents: toNumber(data.monthlyCents),
    currency: typeof data.currency === "string" && data.currency ? data.currency : "cad",
    createdAt: toDate(data.createdAt),
    onboarded: Boolean(data.onboardedAt),
    cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
  });

  const liveCustomers = live.docs.map((doc) => toCustomer(doc.id, doc.data()));
  return {
    recent: recent.docs.map((doc) => toCustomer(doc.id, doc.data())),
    activeSubscribers: liveCustomers.length,
    mrrCents: liveCustomers.reduce((sum, customer) => sum + customer.monthlyCents, 0),
    currency: liveCustomers[0]?.currency ?? "cad",
    total,
  };
}

export async function fetchFunnelSummary(range: DateRange): Promise<FunnelSummary> {
  const db = getFirebaseDb();
  const currentKeys = daysIn(range);
  const previousKeys = daysIn(previousRange(range));
  const keys = [...previousKeys, ...currentKeys];
  const byDay = new Map(keys.map((day) => [day, emptyDay(day)]));

  const [counters, visitors, customers] = await Promise.all([
    getDocs(
      query(
        collection(db, "agent_funnel_daily"),
        where(documentId(), ">=", keys[0]),
        where(documentId(), "<=", keys[keys.length - 1]),
        orderBy(documentId()),
      ),
    ),
    fetchVisitors(range),
    fetchCustomers(),
  ]);

  for (const snapshot of counters.docs) {
    const existing = byDay.get(snapshot.id);
    if (!existing) continue;
    const data = snapshot.data();
    for (const key of NUMERIC_KEYS) existing[key] = toNumber(data[key]);
    for (const key of MAP_KEYS) existing[key] = toCounts(data[key]);
  }

  const days = currentKeys.map((day) => byDay.get(day) ?? emptyDay(day));
  const previousDays = previousKeys.map((day) => byDay.get(day) ?? emptyDay(day));
  const scroll = rankedMap(days, "scroll").sort((a, b) => Number(a.name) - Number(b.name));

  return {
    range,
    endsToday: range.end === todayKey(),
    days,
    previousDays,
    totals: totalsOf(days),
    previous: totalsOf(previousDays),
    cohort: cohortOf(visitors.current),
    previousCohort: cohortOf(visitors.prior),
    sources: breakdown(visitors.current, "source"),
    devices: breakdown(visitors.current, "device"),
    ctas: rankedMap(days, "ctas"),
    faqs: rankedMap(days, "faqs"),
    demos: rankedMap(days, "demos"),
    scroll,
    activeSubscribers: customers.activeSubscribers,
    mrrCents: customers.mrrCents,
    totalCustomers: customers.total,
    currency: customers.currency,
    recentCustomers: customers.recent,
    capped: visitors.capped,
  };
}

export function formatCents(cents: number, currency = "cad", fractionDigits = 0): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100);
}

export function rate(part: number, whole: number): number | null {
  return whole ? (part / whole) * 100 : null;
}
