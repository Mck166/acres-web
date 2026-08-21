import { fetchFeed, type Property } from "@/lib/api";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import PropertyGrid from "@/components/PropertyGrid";
import styles from "./page.module.css";

export const revalidate = 60;

export default async function HomePage() {
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
        <h1>{SITE_NAME}</h1>
        <p>{SITE_DESCRIPTION}</p>
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
