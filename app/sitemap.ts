import type { MetadataRoute } from "next";
import { fetchFeed } from "@/lib/api";
import { getPublishedPosts } from "@/lib/blog";
import { getPropertyHref, getPropertyId } from "@/lib/properties";
import { getPropertyLastModified } from "@/lib/propertySeo";
import { getSiteUrl } from "@/lib/site";

export const revalidate = 3600;

const SITEMAP_PAGE_SIZE = 100;
const SITEMAP_MAX_PAGES = 40;

async function collectPropertyEntries(siteUrl: string): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  let hasMore = true;
  let pages = 0;

  while (hasMore && pages < SITEMAP_MAX_PAGES) {
    const feed = await fetchFeed({
      limit: SITEMAP_PAGE_SIZE,
      cursor,
      revalidate: 3600,
    });

    for (const property of feed.properties) {
      const id = getPropertyId(property);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      entries.push({
        url: `${siteUrl}${getPropertyHref(id)}`,
        lastModified: getPropertyLastModified(property),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    cursor = feed.nextCursor;
    hasMore = Boolean(feed.hasMore && cursor);
    pages += 1;
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const posts = getPublishedPosts().map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  let propertyEntries: MetadataRoute.Sitemap = [];
  try {
    propertyEntries = await collectPropertyEntries(siteUrl);
  } catch (error) {
    console.error("Could not add properties to sitemap:", error);
  }

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/properties`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/map`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...posts,
    ...propertyEntries,
  ];
}
