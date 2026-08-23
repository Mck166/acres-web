import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchFeed, type Property } from "@/lib/api";
import PropertyGrid from "@/components/PropertyGrid";
import styles from "./page.module.css";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Properties",
  description: "Browse homes for sale, save your favorites, and find your next property with Acres.",
};

export default async function PropertiesPage() {
  let properties: Property[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;
  let error: string | null = null;

  try {
    const feed = await fetchFeed({ revalidate: 60 });
    properties = feed.properties;
    nextCursor = feed.nextCursor;
    hasMore = feed.hasMore;
  } catch (loadError) {
    console.error("Error loading property feed:", loadError);
    error = "Could not load properties. Please try again.";
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Properties</h1>
        <p>Browse current listings, save the ones you like, and open any home for full details.</p>
      </section>
      <Suspense fallback={null}>
        <PropertyGrid
          initialProperties={properties}
          initialCursor={nextCursor}
          initialHasMore={hasMore}
          initialError={error}
        />
      </Suspense>
    </div>
  );
}
