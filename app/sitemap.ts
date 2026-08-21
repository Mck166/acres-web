import type { MetadataRoute } from "next";
import { fetchFeed } from "@/lib/api";
import { getAllPosts } from "@/lib/blog";
import { getPropertyHref, getPropertyId } from "@/lib/properties";
import { getSiteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const posts = getAllPosts().map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  let propertyEntries: MetadataRoute.Sitemap = [];
  try {
    const feed = await fetchFeed({ limit: 100, revalidate: 3600 });
    propertyEntries = feed.properties
      .map((property) => getPropertyId(property))
      .filter(Boolean)
      .map((id) => ({
        url: `${siteUrl}${getPropertyHref(id)}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));
  } catch (error) {
    console.error("Could not add properties to sitemap:", error);
  }

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
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
