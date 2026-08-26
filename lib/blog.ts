import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content/blog");
const PUBLISH_TIMEZONE = "America/Halifax";

export type BlogCluster =
  | "buyers-playbook"
  | "hrm"
  | "regions"
  | "property-types"
  | "ownership-costs"
  | "research-tools";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  cluster: BlogCluster | "";
  primaryKeyword: string;
  relatedSlugs: string[];
  content: string;
};

function isMdxFile(filename: string) {
  return filename.endsWith(".mdx") || filename.endsWith(".md");
}

function parseRelatedSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeDate(value: unknown): string {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return "";
}

export function halifaxDateString(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: PUBLISH_TIMEZONE });
}

export function isPublished(date: string, now = new Date()): boolean {
  if (!date) return false;
  const postDay = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postDay)) return false;
  return postDay <= halifaxDateString(now);
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  return fs
    .readdirSync(BLOG_DIR)
    .filter(isMdxFile)
    .map((filename) => {
      const slug = filename.replace(/\.mdx?$/, "");
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8");
      const { data, content } = matter(raw);

      return {
        slug: typeof data.slug === "string" ? data.slug : slug,
        title: String(data.title || slug),
        description: String(data.description || ""),
        date: normalizeDate(data.date),
        cluster: (typeof data.cluster === "string" ? data.cluster : "") as BlogCluster | "",
        primaryKeyword: String(data.primaryKeyword || ""),
        relatedSlugs: parseRelatedSlugs(data.relatedSlugs),
        content,
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function getPublishedPosts(now = new Date()): BlogPost[] {
  return getAllPosts().filter((post) => isPublished(post.date, now));
}

export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find((post) => post.slug === slug) || null;
}

export function getPublishedPostBySlug(slug: string, now = new Date()): BlogPost | null {
  const post = getPostBySlug(slug);
  if (!post || !isPublished(post.date, now)) return null;
  return post;
}

export function getRelatedPosts(post: BlogPost, limit = 4, now = new Date()): BlogPost[] {
  const published = getPublishedPosts(now).filter((candidate) => candidate.slug !== post.slug);
  const bySlug = new Map(published.map((candidate) => [candidate.slug, candidate]));
  const related: BlogPost[] = [];

  for (const slug of post.relatedSlugs) {
    const found = bySlug.get(slug);
    if (found) related.push(found);
    if (related.length >= limit) return related;
  }

  if (post.cluster) {
    for (const candidate of published) {
      if (candidate.cluster !== post.cluster) continue;
      if (related.some((item) => item.slug === candidate.slug)) continue;
      related.push(candidate);
      if (related.length >= limit) break;
    }
  }

  return related.slice(0, limit);
}
