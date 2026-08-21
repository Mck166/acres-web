import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides and notes from Acres on browsing homes, saving favorites, and buying property.",
};

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Blog</h1>
        <p>Tips and updates to help you find your next property with Acres.</p>
      </section>
      {posts.length === 0 ? (
        <p className={styles.empty}>No posts yet. Check back soon.</p>
      ) : (
        <div className={styles.list}>
          {posts.map((post) => (
            <article key={post.slug}>
              <Link href={`/blog/${post.slug}`} className={styles.card}>
                <h2>{post.title}</h2>
                {post.date ? <p className={styles.date}>{formatDate(post.date)}</p> : null}
                <p>{post.description}</p>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
