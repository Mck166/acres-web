"use client";

import { useState } from "react";
import { startAgentCheckout, trackFunnel } from "@/lib/funnel";
import { trackAgentInitiateCheckout } from "@/lib/metaPixel";
import styles from "@/components/AgentCheckoutButton.module.css";

type Props = {
  /** Where on the page the button sits, e.g. "hero" or "offer". */
  cta: string;
  label: string;
  sublabel?: string;
  size?: "regular" | "large";
  className?: string;
};

export default function AgentCheckoutButton({
  cta,
  label,
  sublabel,
  size = "regular",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    trackFunnel("cta_click", { label: cta });
    try {
      const url = await startAgentCheckout(cta);
      trackAgentInitiateCheckout();
      // Give the pixel a moment to leave before Stripe replaces the page.
      window.setTimeout(() => window.location.assign(url), 300);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not start checkout.");
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.wrap}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className={`${styles.button} ${size === "large" ? styles.large : ""}`}
        onClick={start}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          <>
            <span className={styles.label}>{label}</span>
            {sublabel ? <span className={styles.sublabel}>{sublabel}</span> : null}
          </>
        )}
        {loading ? <span className="sr-only">Opening secure checkout</span> : null}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
