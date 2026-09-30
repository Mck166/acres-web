import type { Metadata } from "next";
import { Suspense } from "react";
import PropertyFilters from "@/components/PropertyFilters";
import PropertyGrid from "@/components/PropertyGrid";
import PropertyListFallback from "@/components/PropertyListFallback";
import {
  emptyListingResult,
  listingQueryFromRecord,
  listingQueryKey,
  loadPropertyListings,
} from "@/lib/listingBrowse";
import styles from "./page.module.css";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Properties",
  description: "Browse homes for sale, save your favorites, and find your next property with Acres.",
};

export default function PropertiesPage(props: PageProps<"/properties">) {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Properties</h1>
        <p>Find a home by place, price, or size, then open any listing for the full details.</p>
      </section>
      <Suspense fallback={<div className={styles.filtersFallback} />}>
        <PropertyFilters />
      </Suspense>
      <Suspense fallback={<PropertyListFallback />}>
        <PropertyListingSection searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function PropertyListingSection({
  searchParams,
}: {
  searchParams: PageProps<"/properties">["searchParams"];
}) {
  const query = listingQueryFromRecord(await searchParams);

  try {
    const result = await loadPropertyListings(query);
    return <PropertyGrid key={listingQueryKey(query) || "all"} query={query} result={result} />;
  } catch (loadError) {
    console.error("Error loading property listings:", loadError);
    return (
      <PropertyGrid
        key={listingQueryKey(query) || "all"}
        query={query}
        result={emptyListingResult("Could not load properties. Please try again.")}
      />
    );
  }
}
