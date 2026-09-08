"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addComment, hasLiked, listComments, toggleLike, type CommentRecord, type PostRecord } from "@/lib/social";
import styles from "./PostCard.module.css";

type Viewer = {
  uid?: string;
  displayName?: string;
  photoUrl?: string;
  slug?: string;
  accountType?: string;
};

export default function PostCard({
  post,
  viewer,
}: {
  post: PostRecord;
  viewer?: Viewer | null;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!viewer?.uid) return;
    hasLiked(post.id, viewer.uid).then(setLiked);
  }, [post.id, viewer?.uid]);

  return (
    <article className={styles.card}>
      <Link href={post.authorSlug ? `/agents/${post.authorSlug}` : "/feed"} className={styles.author}>
        {post.authorPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.authorPhotoUrl} alt="" className={styles.avatar} />
        ) : (
          <span className={styles.avatarFallback}>{(post.authorName || "A").slice(0, 1)}</span>
        )}
        <span>
          <strong>{post.authorName || "Agent"}</strong>
          <em>{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ""}</em>
        </span>
      </Link>
      {post.text ? <p>{post.text}</p> : null}
      {(post.photoUrls || []).map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" className={styles.photo} />
      ))}
      {(post.propertyIds || []).map((id) => (
        <Link key={id} href={`/properties/${id}`} className={styles.listing}>
          View listing
        </Link>
      ))}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={async () => {
            if (!viewer?.uid) return;
            const next = await toggleLike(post.id, viewer.uid);
            setLiked(next);
            setLikeCount((count) => count + (next ? 1 : -1));
          }}
        >
          {liked ? "Liked" : "Like"} · {Math.max(0, likeCount)}
        </button>
        <button
          type="button"
          onClick={async () => {
            const next = !open;
            setOpen(next);
            if (next) setComments(await listComments(post.id));
          }}
        >
          Comments
        </button>
      </div>
      {open ? (
        <div className={styles.comments}>
          {comments.map((comment) => (
            <p key={comment.id}>
              <strong>
                {comment.authorSlug ? (
                  <Link href={`/agents/${comment.authorSlug}`}>{comment.authorName}</Link>
                ) : (
                  comment.authorName
                )}
              </strong>{" "}
              {comment.text}
            </p>
          ))}
          {viewer?.uid ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!draft.trim()) return;
                const created = await addComment(post.id, viewer, draft.trim());
                setComments((current) => [...current, created]);
                setDraft("");
              }}
            >
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a comment" />
              <button type="submit">Post</button>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
