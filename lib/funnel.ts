"use client";

import { logEvent } from "@/lib/analytics";

// Tracking for the /for-agents sales funnel. Events are queued briefly and sent
// in batches to the API, which counts them into Firestore for the admin
// analytics page (see Acres-API/agent_sites.py). Each is mirrored to GA too.
//
// Attribution is first touch: the UTM tags and referrer from a visitor's first
// landing are kept in storage and sent with every batch, so a visitor who
// comes back directly a week later still counts toward the ad that found them.

export type FunnelEventName =
  | "landing_view"
  | "demo_click"
  | "pricing_view"
  | "cta_click"
  | "faq_open"
  | "scroll_depth"
  | "engaged_time"
  | "checkout_cancelled"
  | "welcome_view";

type FunnelEvent = {
  name: FunnelEventName;
  ts: string;
  label?: string;
  value?: number;
};

type FunnelContext = {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  device: string;
  path: string;
};

type Touch = Omit<FunnelContext, "device" | "path">;

const ANON_KEY = "acres:funnel-id";
const TOUCH_KEY = "acres:funnel-touch";
const ENDPOINT = "/acres-api/agent-sites/events";
const FLUSH_DELAY_MS = 1500;
const MAX_BATCH = 50;

let queue: FunnelEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let memoryId: string | null = null;
let memoryTouch: Touch | null = null;

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function funnelAnonId(): string {
  if (memoryId) return memoryId;
  try {
    const stored = window.localStorage.getItem(ANON_KEY);
    if (stored) {
      memoryId = stored;
      return stored;
    }
    const created = randomId();
    window.localStorage.setItem(ANON_KEY, created);
    memoryId = created;
    return created;
  } catch {
    // Private browsing can refuse storage; the id then lasts for this page.
    memoryId = randomId();
    return memoryId;
  }
}

function deviceType(): string {
  const width = window.innerWidth;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && width < 768) return "mobile";
  if (coarse && width < 1200) return "tablet";
  return "desktop";
}

/** The first landing's source, captured once and reused afterwards. */
function firstTouch(): Touch {
  if (memoryTouch) return memoryTouch;
  try {
    const stored = window.localStorage.getItem(TOUCH_KEY);
    if (stored) {
      memoryTouch = JSON.parse(stored) as Touch;
      return memoryTouch;
    }
  } catch {
    // Fall through and capture a fresh touch.
  }

  const params = new URLSearchParams(window.location.search);
  const touch: Touch = {
    source: params.get("utm_source") || params.get("ref") || undefined,
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
    referrer: document.referrer || undefined,
  };
  if (!touch.source && params.get("fbclid")) {
    touch.source = "facebook";
    touch.medium = touch.medium || "paid";
  }
  if (!touch.source && params.get("gclid")) {
    touch.source = "google";
    touch.medium = touch.medium || "cpc";
  }
  memoryTouch = touch;
  try {
    window.localStorage.setItem(TOUCH_KEY, JSON.stringify(touch));
  } catch {
    // Attribution still works for this page.
  }
  return touch;
}

export function funnelContext(): FunnelContext {
  return { ...firstTouch(), device: deviceType(), path: window.location.pathname };
}

function payload(events: FunnelEvent[]) {
  return JSON.stringify({ anon_id: funnelAnonId(), context: funnelContext(), events });
}

/** Send what is queued. With `beacon`, uses sendBeacon so it survives the
 * page closing, which is when engaged time is reported. */
export function flushFunnel({ beacon = false }: { beacon?: boolean } = {}) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0 || typeof window === "undefined") return;
  const events = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  const body = payload(events);

  if (beacon && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Tracking is best effort; a lost batch is not worth retrying.
  });

  if (queue.length > 0) flushFunnel({ beacon });
}

export function trackFunnel(
  name: FunnelEventName,
  details: { label?: string; value?: number } = {},
) {
  if (typeof window === "undefined") return;
  queue.push({ name, ts: new Date().toISOString(), ...details });
  logEvent(`agent_funnel_${name}`, {
    label: details.label,
    value: details.value,
  });
  if (!timer) timer = setTimeout(() => flushFunnel(), FLUSH_DELAY_MS);
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === "string" && data.detail) return data.detail;
  } catch {
    // Not JSON; use the fallback.
  }
  return fallback;
}

/** Create a Stripe Checkout session and return its URL. */
export async function startAgentCheckout(cta: string): Promise<string> {
  flushFunnel();
  const response = await fetch("/acres-api/agent-sites/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anon_id: funnelAnonId(), cta, context: funnelContext() }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Could not start checkout. Please try again."));
  }
  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error("Could not start checkout. Please try again.");
  return data.url;
}

export type AgentCheckoutSession = {
  paid: boolean;
  email: string;
  first_name: string;
  onboarded: boolean;
};

export async function fetchAgentCheckoutSession(sessionId: string): Promise<AgentCheckoutSession> {
  const response = await fetch(`/acres-api/agent-sites/session/${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error(await readError(response, "We could not find that checkout."));
  }
  return (await response.json()) as AgentCheckoutSession;
}

export type OnboardingAnswers = {
  phone?: string;
  brokerage?: string;
  domain?: string;
  service_areas?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  headshot_url?: string;
  bio?: string;
  notes?: string;
};

export async function submitAgentOnboarding(sessionId: string, answers: OnboardingAnswers) {
  const response = await fetch("/acres-api/agent-sites/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, ...answers }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Could not send your details. Please try again."));
  }
}
