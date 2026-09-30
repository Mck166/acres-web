import type { Metadata } from "next";
import Link from "next/link";
import { fetchFeed, type Property } from "@/lib/api";
import PropertyGrid from "@/components/PropertyGrid";
import styles from "./page.module.css";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Properties",
  description: "Browse homes for sale, filter by price and beds, save favorites, and find your next property with Acres.",
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
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Browse listings</p>
          <h1>Find a home that fits</h1>
          <p>
            Search by city or address, narrow by price and bedrooms, then open any listing for the
            full story — or jump to the map when you want to look around.
          </p>
        </div>
        <Link href="/map" className={styles.mapCta}>
          Open map
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <PropertyGrid
        initialProperties={properties}
        initialCursor={nextCursor}
        initialHasMore={hasMore}
        initialError={error}
      />
    </div>
  );
}
