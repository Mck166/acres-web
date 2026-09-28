import { OFFER } from "@/lib/agentOffer";

/** Public pixel id. It is visible in the page source either way. */
export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "674443274891377";

/**
 * Facebook's installer searches the raw HTML for this exact text. Keep the
 * line breaks and do not indent it, or the checker reports that the pixel
 * is missing even though the browser still runs it.
 */
export const META_PIXEL_SCRIPT = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
`;

export const META_PIXEL_NOSCRIPT = `<img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1"
/>`;

const PRODUCT_ID = "agent-website";

type MetaValue = string | number | string[] | Array<{ id: string; quantity: number; item_price: number }>;

type MetaParams = Record<string, MetaValue>;

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: Fbq;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

type Queued = {
  name: string;
  params?: MetaParams;
  eventID?: string;
};

const queue: Queued[] = [];
const sentPurchases = new Set<string>();
let waitTimer: number | null = null;

function productParams(): MetaParams {
  return {
    content_name: OFFER.name,
    content_ids: [PRODUCT_ID],
    content_type: "product",
    content_category: "subscription",
    contents: [{ id: PRODUCT_ID, quantity: 1, item_price: OFFER.monthlyPrice }],
    num_items: 1,
    value: OFFER.monthlyPrice,
    currency: OFFER.currency,
  };
}

function send(item: Queued) {
  if (!window.fbq) return;
  if (item.eventID) {
    window.fbq("track", item.name, item.params ?? {}, { eventID: item.eventID });
    return;
  }
  if (item.params) {
    window.fbq("track", item.name, item.params);
    return;
  }
  window.fbq("track", item.name);
}

/** The base snippet defines `fbq` before the network script arrives, so events
 * queued here still go out. */
export function flushMetaPixel() {
  if (typeof window === "undefined" || !window.fbq) return;
  const batch = queue.splice(0);
  for (const item of batch) send(item);
}

function track(name: string, params?: MetaParams, eventID?: string) {
  if (typeof window === "undefined") return;
  queue.push({ name, params, eventID });
  flushMetaPixel();
  if (window.fbq || waitTimer !== null) return;
  const started = Date.now();
  waitTimer = window.setInterval(() => {
    if (window.fbq || Date.now() - started > 10000) {
      if (waitTimer !== null) window.clearInterval(waitTimer);
      waitTimer = null;
      flushMetaPixel();
    }
  }, 100);
}

export function trackMetaPageView() {
  track("PageView");
}

/** The offer page. Facebook uses this as a product view. */
export function trackAgentViewContent() {
  track("ViewContent", productParams());
}

/** Stripe Checkout is about to open. */
export function trackAgentInitiateCheckout() {
  track("InitiateCheckout", productParams());
}

/** A paid welcome-page load. Refreshes of the same Stripe session do not count again. */
export function trackAgentPurchase(sessionId: string) {
  if (!sessionId || sentPurchases.has(sessionId)) return;
  const key = `acres:meta-purchase:${sessionId}`;
  try {
    if (window.sessionStorage.getItem(key) === "1") {
      sentPurchases.add(sessionId);
      return;
    }
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage can be blocked; the in-memory set still covers this page load.
  }
  sentPurchases.add(sessionId);
  track("Purchase", productParams(), sessionId);
}
