"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { flushMetaPixel, trackMetaPageView } from "@/lib/metaPixel";

// The base snippet already sends the first PageView. Later client navigations
// need their own, or Facebook only sees the landing page.
let lastUrl = "";

function MetaPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    flushMetaPixel();
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (lastUrl === url) return;
    const first = lastUrl === "";
    lastUrl = url;
    if (!first) trackMetaPageView();
  }, [pathname, searchParams]);

  return null;
}

export default function MetaPixel() {
  return (
    <Suspense fallback={null}>
      <MetaPageViews />
    </Suspense>
  );
}
