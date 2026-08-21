import Link from "next/link";
import styles from "@/components/SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p>
        © {new Date().getFullYear()} Acres.{" "}
        <Link href="/blog">Read the blog</Link>
      </p>
    </footer>
  );
}
