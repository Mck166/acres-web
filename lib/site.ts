export const SITE_NAME = "Acres";

export const SITE_DESCRIPTION =
  "Browse homes for sale, save your favorites, and find your next property with Acres.";

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export const FEED_PAGE_SIZE = 24;
