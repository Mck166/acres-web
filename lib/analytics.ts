export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-J0J8XQ2CEP";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function pageview(url: string) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_title: document.title,
    page_location: `${window.location.origin}${url}`,
    page_path: url,
  });
}

export function logEvent(name: string, params?: Record<string, unknown>) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

export function setAnalyticsUserId(userId: string | null) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("set", { user_id: userId || undefined });
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
    user_id: userId || undefined,
  });
}

export function parsePriceValue(price: string | null | undefined) {
  if (!price) return undefined;
  const num = parseFloat(String(price).replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : undefined;
}
