import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts } from "@/lib/blog";
import styles from "./page.module.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Nova Scotia Real Estate Blog",
  description:
    "Guides to buying a house in Nova Scotia, Halifax neighbourhoods, closing costs, and how to browse live listings with Acres.",
};

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA", {
    timeZone: "America/Halifax",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const posts = getPublishedPosts();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Nova Scotia real estate blog</h1>
        <p>
          Practical guides for buying a home in Nova Scotia — from Halifax neighbourhoods and
          closing costs to browsing live listings on Acres.
        </p>
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
