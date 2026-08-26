import type { AnchorHTMLAttributes } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  getAllPosts,
  getPublishedPostBySlug,
  getRelatedPosts,
} from "@/lib/blog";
import { SITE_NAME, getSiteUrl } from "@/lib/site";
import styles from "./page.module.css";

export const revalidate = 3600;

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

const mdxComponents = {
  a: function MdxAnchor({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const url = href || "";
    const isExternal = /^https?:\/\//i.test(url);
    if (isExternal) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    }
    return (
      <a href={url} {...props}>
        {children}
      </a>
    );
  },
};

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPublishedPostBySlug(slug);
  if (!post) {
    return { title: "Post not found" };
  }

  const canonical = `/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: canonical,
      publishedTime: post.date || undefined,
    },
  };
}

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

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPublishedPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post);
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    mainEntityOfPage: canonical,
    url: canonical,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl,
    },
  };

  return (
    <article className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/blog" className={styles.back}>
        Back to blog
      </Link>
      <header className={styles.header}>
        <h1>{post.title}</h1>
        {post.date ? <p className={styles.date}>{formatDate(post.date)}</p> : null}
      </header>
      <div className={styles.content}>
        <MDXRemote source={post.content} components={mdxComponents} />
      </div>
      {related.length > 0 ? (
        <nav className={styles.related} aria-labelledby="related-heading">
          <h2 id="related-heading">Related reading</h2>
          <ul>
            {related.map((item) => (
              <li key={item.slug}>
                <Link href={`/blog/${item.slug}`}>{item.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
