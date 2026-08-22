import Link from "next/link";
import { APP_STORE_URL } from "@/lib/site";
import styles from "@/components/SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer} data-site-footer>
      <p>
        © {new Date().getFullYear()} Acres.{" "}
        <Link href="/properties">Browse properties</Link>
        {" · "}
        <Link href="/blog">Read the blog</Link>
        {" · "}
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
          Download the app
        </a>
      </p>
    </footer>
  );
}
