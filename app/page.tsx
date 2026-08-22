import type { Metadata } from "next";
import Link from "next/link";
import { APP_STORE_URL, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — Find your dream home`,
  },
  description: SITE_DESCRIPTION,
};

export default function HomePage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Home search, made simple</p>
        <h1>Find your dream home with {SITE_NAME}</h1>
        <p className={styles.lead}>
          Acres is a one-of-a-kind real estate app that makes browsing listings feel easy. Swipe
          through homes, save the ones you love, and come back to them anytime — on your phone or
          here on the web, with the same account.
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
      </section>

      <section className={styles.features} aria-labelledby="features-heading">
        <h2 id="features-heading">What you can do</h2>
        <div className={styles.featureGrid}>
          <article className={styles.feature}>
            <h3>Swipe through listings</h3>
            <p>
              The app shows one home at a time. Swipe right to save a favorite, swipe left to pass,
              and keep going until something feels right.
            </p>
          </article>
          <article className={styles.feature}>
            <h3>Save favorites</h3>
            <p>
              Every property you save lives in your account. Open Favorites on your phone or on this
              website and pick up exactly where you left off.
            </p>
          </article>
          <article className={styles.feature}>
            <h3>See the real numbers</h3>
            <p>
              Cost estimates and a rental calculator help you look past the listing price and
              understand what a home might actually cost to own.
            </p>
          </article>
          <article className={styles.feature}>
            <h3>Browse on the web</h3>
            <p>
              Prefer a bigger screen? Browse the same listings here, open any property page, and
              save homes with the same email you use in the app.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.download} aria-labelledby="download-heading">
        <h2 id="download-heading">Get the app</h2>
        <p>
          Acres is free on the App Store for iPhone and iPad. Download it to start swiping, then
          sign in here anytime to review your saved homes.
        </p>
        <a
          className={styles.storeButton}
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className={styles.storeLabel}>Download on the</span>
          <span className={styles.storeName}>App Store</span>
        </a>
      </section>
    </div>
  );
}
