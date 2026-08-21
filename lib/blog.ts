import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  content: string;
};

function isMdxFile(filename: string) {
  return filename.endsWith(".mdx") || filename.endsWith(".md");
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
        date: String(data.date || ""),
        content,
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find((post) => post.slug === slug) || null;
}
