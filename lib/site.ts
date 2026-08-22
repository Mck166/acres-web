export const SITE_NAME = "Acres";

export const SITE_DESCRIPTION =
  "Acres is a swipe-based home search app. Browse listings, save favorites, and find your next property — then pick up where you left off on the web.";

export const APP_STORE_URL = "https://apps.apple.com/us/app/acres/id6670382546";

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const FEED_PAGE_SIZE = 24;
