"use client";

import { useCallback, useState } from "react";
import ShareIcon from "@/components/ShareIcon";
import styles from "@/components/PropertyFavoriteButton.module.css";

type PropertyShareButtonProps = {
  url: string;
  title: string;
  text: string;
};

export default function PropertyShareButton({ url, title, text }: PropertyShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying listing link:", error);
    }
  }, [text, title, url]);

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleClick}
      aria-label="Share this property"
    >
      <ShareIcon size={20} color="#EAE6E5" />
      {copied ? "Copied" : "Share"}
    </button>
  );
}
