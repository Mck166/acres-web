import type { Metadata } from "next";
import { fetchFeed, type Property } from "@/lib/api";
import PropertyGrid from "@/components/PropertyGrid";
import { parsePropertyListFilters, toFeedQuery } from "@/lib/propertyFilters";
import styles from "./page.module.css";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Properties",
  description: "Browse homes for sale in Nova Scotia. Filter by city, bedrooms, bathrooms, and price, then save your favorites with Acres.",
};

export default async function PropertiesPage(props: PageProps<"/properties">) {
  const query = await props.searchParams;
  const filters = parsePropertyListFilters(query);
  let properties: Property[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;
  let totalAvailable = 0;
  let error: string | null = null;

  try {
    const feed = await fetchFeed({ revalidate: 60, filters: toFeedQuery(filters) });
    properties = feed.properties;
    nextCursor = feed.nextCursor;
    hasMore = feed.hasMore;
    totalAvailable = feed.totalAvailable;
  } catch (loadError) {
    console.error("Error loading property feed:", loadError);
    error = "Could not load properties. Please try again.";
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Properties</h1>
        <p>Browse current listings by place, size, and price. Save the ones you like, and open any home for full details.</p>
      </section>
      <PropertyGrid
        initialProperties={properties}
        initialCursor={nextCursor}
        initialHasMore={hasMore}
        initialTotal={totalAvailable}
        initialFilters={filters}
        initialError={error}
      />
    </div>
  );
}
