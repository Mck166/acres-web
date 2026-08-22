import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <h1>Page not found</h1>
      <p>That page does not exist. Head back home, browse listings, or read the blog.</p>
      <p className={styles.links}>
        <Link href="/">Home</Link>
        <Link href="/properties">Properties</Link>
        <Link href="/blog">Blog</Link>
      </p>
    </div>
  );
}
