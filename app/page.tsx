import type { Metadata } from "next";
import Link from "next/link";
import { fetchFeed, type Property } from "@/lib/api";
import { getPropertyPhotos } from "@/lib/properties";
import { APP_STORE_URL, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import HomePosts from "@/components/HomePosts";
import PropertyCard from "@/components/PropertyCard";
import PropertyImage from "@/components/PropertyImage";
import styles from "./page.module.css";

export const revalidate = 60;

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — Find your dream home`,
  },
  description: SITE_DESCRIPTION,
};

const FEATURES = [
  {
    title: "Swipe through listings",
    detail:
      "The app shows one home at a time. Swipe right to save a favorite, swipe left to pass, and keep going until something feels right.",
  },
  {
    title: "Save favorites",
    detail:
      "Every property you save lives in your account. Open Favorites on your phone or on this website and pick up exactly where you left off.",
  },
  {
    title: "See the real numbers",
    detail:
      "Cost estimates and a rental calculator help you look past the listing price and understand what a home might actually cost to own.",
  },
  {
    title: "Browse on the web",
    detail:
      "Prefer a bigger screen? Browse the same listings here, open any property page, and save homes with the same email you use in the app.",
  },
] as const;

async function loadFeaturedProperties(): Promise<Property[]> {
  try {
    const feed = await fetchFeed({ limit: 12, revalidate: 60 });
    return feed.properties.filter((property) => getPropertyPhotos(property).length > 0).slice(0, 6);
  } catch (error) {
    console.error("Error loading homepage featured properties:", error);
    return [];
  }
}

export default async function HomePage() {
  const featured = await loadFeaturedProperties();
  const heroPhoto = featured[0] ? getPropertyPhotos(featured[0])[0] : null;

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-hero-heading">
        <div className={styles.heroMedia} aria-hidden="true">
          {heroPhoto ? (
            <PropertyImage
              src={heroPhoto}
              alt=""
              className={styles.heroImage}
              priority
            />
          ) : (
            <div className={styles.heroFallback} />
          )}
          <div className={styles.heroScrim} />
        </div>

        <div className={styles.heroInner}>
          <p className={styles.brand}>{SITE_NAME}</p>
          <h1 id="home-hero-heading" className={styles.headline}>
            Find your dream home
          </h1>
          <p className={styles.lead}>
            Swipe through listings, save the ones you love, and pick up where you left off on the
            web.
          </p>
          <div className={styles.actions}>
            <a
              className={styles.storeButton}
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.storeLabel}>Download on the</span>
              <span className={styles.storeName}>App Store</span>
            </a>
            <Link className={styles.secondaryButton} href="/properties">
              Browse properties
            </Link>
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className={styles.featured} aria-labelledby="featured-heading">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>On the market</p>
            <div className={styles.sectionTitleRow}>
              <h2 id="featured-heading">Homes worth a look</h2>
              <Link href="/properties" className={styles.sectionLink}>
                See all properties
              </Link>
            </div>
            <p>Fresh listings from the same feed you swipe through in the app.</p>
          </div>
          <div className={styles.featuredGrid}>
            {featured.map((property) => (
              <PropertyCard key={property._id} property={property} />
            ))}
          </div>
        </section>
      ) : null}

      <HomePosts />

      <section className={styles.features} aria-labelledby="features-heading">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>What you can do</p>
          <h2 id="features-heading">Home search, without the noise</h2>
          <p>One account across phone and web. Save once, come back anytime.</p>
        </div>
        <div className={styles.featureList}>
          {FEATURES.map((feature, index) => (
            <article key={feature.title} className={styles.feature}>
              <span className={styles.featureIndex}>{String(index + 1).padStart(2, "0")}</span>
              <div className={styles.featureCopy}>
                <h3>{feature.title}</h3>
                <p>{feature.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.download} aria-labelledby="download-heading">
        <div className={styles.downloadInner}>
          <p className={styles.kickerLight}>Get the app</p>
          <h2 id="download-heading">Start swiping on your phone</h2>
          <p>
            Acres is free on the App Store for iPhone and iPad. Download it to start browsing, then
            sign in here anytime to review your saved homes.
          </p>
          <div className={styles.downloadActions}>
            <a
              className={styles.storeButtonLight}
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.storeLabel}>Download on the</span>
              <span className={styles.storeName}>App Store</span>
            </a>
            <Link className={styles.mapLink} href="/map">
              Explore the map <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
