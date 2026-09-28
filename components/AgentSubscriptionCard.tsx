"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  cancelAgentSubscription,
  fetchAgentSubscription,
  resumeAgentSubscription,
  type AgentSubscription,
} from "@/lib/api";
import { OFFER } from "@/lib/agentOffer";
import styles from "@/components/AgentSubscriptionCard.module.css";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment past due",
  unpaid: "Unpaid",
  canceled: "Cancelled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  paused: "Paused",
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: (currency || "cad").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type Load =
  | { status: "loading" }
  | { status: "ready"; subscription: AgentSubscription | null }
  | { status: "error" };

export default function AgentSubscriptionCard({ agent }: { agent: boolean }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAgentSubscription()
      .then((subscription) => {
        if (!cancelled) setLoad({ status: "ready", subscription });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSubscription = () => {
    setLoad({ status: "loading" });
    fetchAgentSubscription()
      .then((subscription) => setLoad({ status: "ready", subscription }))
      .catch(() => setLoad({ status: "error" }));
  };

  if (load.status === "loading") return null;

  if (load.status === "error") {
    if (!agent) return null;
    return (
      <section className={styles.card}>
        <h2>Website plan</h2>
        <p className={styles.meta}>Could not load your website subscription.</p>
        <button type="button" className={styles.secondary} onClick={loadSubscription}>
          Try again
        </button>
      </section>
    );
  }

  const subscription = load.subscription;
  if (!subscription) {
    if (!agent) return null;
    return (
      <section className={styles.card}>
        <h2>Website plan</h2>
        <p className={styles.meta}>
          No website subscription is on this account. If you paid with a different email, sign in
          with that one.
        </p>
        <Link href="/for-agents">Get a website</Link>
      </section>
    );
  }

  const date = formatDate(subscription.current_period_end);
  const ended = subscription.status === "canceled" || subscription.status === "incomplete_expired";
  const dateLabel = subscription.renews ? "Next billing date" : ended ? "Ended" : "Access until";

  const change = async (action: "cancel" | "resume") => {
    setWorking(true);
    setError(null);
    try {
      const next =
        action === "cancel" ? await cancelAgentSubscription() : await resumeAgentSubscription();
      setLoad({ status: "ready", subscription: next });
      setConfirming(false);
    } catch {
      setError(
        action === "cancel"
          ? "Could not cancel. Please try again."
          : "Could not restart billing. Please try again.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2>Website plan</h2>
        <span className={`${styles.pill} ${ended ? styles.pillEnded : styles.pillLive}`}>
          {subscription.cancel_at_period_end
            ? "Cancels soon"
            : STATUS_LABELS[subscription.status] || subscription.status}
        </span>
      </div>
      <p className={styles.price}>
        {formatMoney(subscription.monthly_cents, subscription.currency)}
        <span>/month</span>
      </p>
      {date ? (
        <p className={styles.meta}>
          <strong>{dateLabel}</strong> {date}
        </p>
      ) : null}
      {subscription.status === "past_due" || subscription.status === "unpaid" ? (
        <p className={styles.meta}>
          The last payment did not go through. Update the card from the link in your Stripe receipt,
          or email {OFFER.supportEmail}.
        </p>
      ) : null}
      {subscription.cancel_at_period_end ? (
        <p className={styles.meta}>
          Your website stays up until the date above. You will not be billed again unless you keep
          the plan.
        </p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {ended ? (
        <Link href="/for-agents">Start a new website</Link>
      ) : subscription.cancel_at_period_end ? (
        <button type="button" disabled={working} onClick={() => change("resume")}>
          {working ? "Saving…" : "Keep my website"}
        </button>
      ) : confirming ? (
        <div className={styles.confirm}>
          <p>
            Cancel at the end of this period? Your website stays up
            {date ? ` until ${date}` : " until then"}, and you will not be billed again.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.danger} disabled={working} onClick={() => change("cancel")}>
              {working ? "Cancelling…" : "Yes, cancel"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={working}
              onClick={() => setConfirming(false)}
            >
              Never mind
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.secondary} onClick={() => setConfirming(true)}>
          Cancel subscription
        </button>
      )}
    </section>
  );
}
