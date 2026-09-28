"use client";

import { useEffect } from "react";
import { flushFunnel, trackFunnel } from "@/lib/funnel";
import { trackAgentViewContent } from "@/lib/metaPixel";

const SCROLL_MARKS = [25, 50, 75, 100] as const;

// React runs mount effects twice in development; these keep a page load from
// counting as two views.
let trackedPath: string | null = null;

type Props = {
  page: "landing" | "welcome";
  /** Element id whose appearance on screen counts as "saw the price". */
  pricingId?: string;
};

export default function AgentFunnelTracker({ page, pricingId }: Props) {
  useEffect(() => {
    const key = `${page}:${window.location.pathname}${window.location.search}`;
    if (trackedPath !== key) {
      trackedPath = key;
      trackFunnel(page === "landing" ? "landing_view" : "welcome_view");
      if (page === "landing") trackAgentViewContent();
      const params = new URLSearchParams(window.location.search);
      if (page === "landing" && params.get("checkout") === "cancelled") {
        trackFunnel("checkout_cancelled");
      }
    }
  }, [page]);

  useEffect(() => {
    if (page !== "landing") return;
    const reached = new Set<number>();
    let frame = 0;

    const measure = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const percent = scrollable <= 0 ? 100 : ((window.scrollY + 1) / scrollable) * 100;
      for (const mark of SCROLL_MARKS) {
        if (percent >= mark && !reached.has(mark)) {
          reached.add(mark);
          trackFunnel("scroll_depth", { value: mark });
        }
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [page]);

  useEffect(() => {
    if (!pricingId) return;
    const target = document.getElementById(pricingId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    let seen = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (seen || !entries.some((entry) => entry.isIntersecting)) return;
        seen = true;
        trackFunnel("pricing_view");
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [pricingId]);

  // Time with the page actually on screen, reported whenever it is hidden so a
  // closed tab still reports what it had.
  useEffect(() => {
    let visibleSince = document.visibilityState === "visible" ? Date.now() : null;
    let banked = 0;

    const report = () => {
      if (visibleSince !== null) {
        banked += Date.now() - visibleSince;
        visibleSince = null;
      }
      const seconds = Math.round(banked / 1000);
      banked = 0;
      if (seconds >= 1) trackFunnel("engaged_time", { value: seconds, label: page });
      flushFunnel({ beacon: true });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        report();
      } else if (visibleSince === null) {
        visibleSince = Date.now();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", report);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", report);
      report();
    };
  }, [page]);

  return null;
}
