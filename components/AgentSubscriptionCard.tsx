"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  cancelAgentSubscription,
  claimAgentSubscription,
  fetchAgentSubscription,
  resumeAgentSubscription,
  type AgentSubscription,
} from "@/lib/api";
import { AGENT_DEMO_URL, OFFER } from "@/lib/agentOffer";
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

function checkoutSessionId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const fromQuery = new URL(trimmed).searchParams.get("session_id");
    if (fromQuery && fromQuery.startsWith("cs_")) return fromQuery;
  } catch {
    // A bare session id is fine too.
  }
  const match = trimmed.match(/cs_[A-Za-z0-9_]+/);
  return match ? match[0] : "";
}

function SitePreview() {
  return (
    <div className={styles.preview}>
      <div className={styles.frame}>
        <iframe title="Example of the agent website" src={AGENT_DEMO_URL} loading="lazy" />
      </div>
      <p className={styles.caption}>
        This is the website. Yours carries your name, your photo and your listings.{" "}
        <a href={AGENT_DEMO_URL} target="_blank" rel="noreferrer">
          Open the example
        </a>
      </p>
    </div>
  );
}

type Load =
  | { status: "loading" }
  | { status: "ready"; subscription: AgentSubscription | null }
  | { status: "error" };

export default function AgentSubscriptionCard({ agent }: { agent: boolean }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [receipt, setReceipt] = useState("");
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
    setError(null);
    fetchAgentSubscription()
      .then((subscription) => setLoad({ status: "ready", subscription }))
      .catch(() => setLoad({ status: "error" }));
  };

  if (load.status === "loading") {
    if (!agent) return null;
    return (
      <section className={styles.studio} aria-busy="true">
        <div className={styles.panel}>
          <p className={styles.kicker}>Your website</p>
          <h2>Loading your plan…</h2>
        </div>
        <SitePreview />
      </section>
    );
  }

  if (load.status === "error") {
    if (!agent) return null;
    return (
      <section className={styles.studio}>
        <div className={styles.panel}>
          <p className={styles.kicker}>Your website</p>
          <h2>We could not load your plan.</h2>
          <p className={styles.lead}>Your payment is safe. This is only the account view.</p>
          <button type="button" className={styles.primary} onClick={loadSubscription}>
            Try again
          </button>
        </div>
        <SitePreview />
      </section>
    );
  }

  const subscription = load.subscription;

  const attachReceipt = async (event: FormEvent) => {
    event.preventDefault();
    const sessionId = checkoutSessionId(receipt);
    if (!sessionId) {
      setError("Paste the link from the page you landed on right after checkout.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const next = await claimAgentSubscription(sessionId);
      if (!next) {
        setError("That checkout does not have a website on it yet.");
        return;
      }
      setLoad({ status: "ready", subscription: next });
      setReceipt("");
    } catch {
      setError("Could not add that checkout. Use the link from the page right after you paid.");
    } finally {
      setWorking(false);
    }
  };

  if (!subscription) {
    if (!agent) {
      return (
        <form className={styles.claimStrip} onSubmit={attachReceipt}>
          <div>
            <h2>Already bought a website?</h2>
            <p>Paste the link from the page right after checkout. It does not have to match this login email.</p>
          </div>
          <input
            value={receipt}
            onChange={(event) => setReceipt(event.target.value)}
            placeholder="https://…/for-agents/welcome?session_id=cs_…"
            autoComplete="off"
            aria-label="Checkout link"
          />
          {error ? <p className={styles.stripError}>{error}</p> : null}
          <button type="submit" disabled={working || !receipt.trim()}>
            {working ? "Adding…" : "Add it to this account"}
          </button>
        </form>
      );
    }
    return (
      <section className={styles.studio}>
        <div className={styles.panel}>
          <p className={styles.kicker}>{OFFER.name}</p>
          <h2>A website with your name on the door.</h2>
          <p className={styles.price}>
            {formatMoney(OFFER.monthlyPrice * 100, "cad")}
            <span>/month</span>
          </p>
          <p className={styles.lead}>
            We write it, design it and launch it in {OFFER.launchDays} days. Your photo, your
            brokerage, your areas and a live map of your listings.
          </p>
          <ul className={styles.points}>
            <li>Custom site, written for you</li>
            <li>Live listings on a map</li>
            <li>Edits included, every month</li>
          </ul>
          <Link href="/for-agents" className={styles.primary}>
            Get this website
          </Link>
          <form className={styles.claim} onSubmit={attachReceipt}>
            <label>
              Already paid?
              <input
                value={receipt}
                onChange={(event) => setReceipt(event.target.value)}
                placeholder="Paste the link from after checkout"
                autoComplete="off"
              />
            </label>
            <p className={styles.hint}>
              Any Acres login works, even when it is not the email you paid with.
            </p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="submit" className={styles.secondary} disabled={working || !receipt.trim()}>
              {working ? "Adding…" : "Add it to this account"}
            </button>
          </form>
        </div>
        <SitePreview />
      </section>
    );
  }

  const date = formatDate(subscription.current_period_end);
  const ended = subscription.status === "canceled" || subscription.status === "incomplete_expired";
  const dateLabel = subscription.renews ? "Next billing date" : ended ? "Ended" : "Access until";
  const price = subscription.monthly_cents
    ? formatMoney(subscription.monthly_cents, subscription.currency)
    : formatMoney(OFFER.monthlyPrice * 100, "cad");
  const welcomeHref = subscription.checkout_session_id
    ? `/for-agents/welcome?session_id=${encodeURIComponent(subscription.checkout_session_id)}`
    : "";

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
    <section className={styles.studio}>
      <div className={styles.panel}>
        <div className={styles.head}>
          <p className={styles.kicker}>Your website</p>
          <span className={`${styles.pill} ${ended ? styles.pillEnded : styles.pillLive}`}>
            {subscription.cancel_at_period_end
              ? "Cancels soon"
              : STATUS_LABELS[subscription.status] || subscription.status}
          </span>
        </div>
        <h2>{OFFER.name}</h2>
        <p className={styles.price}>
          {price}
          <span>/month</span>
        </p>
        {date ? (
          <p className={styles.meta}>
            <strong>{dateLabel}</strong>
            <span>{date}</span>
          </p>
        ) : null}
        <p className={styles.lead}>
          {ended
            ? "This plan has ended. Start again and we will build the site from your details."
            : subscription.onboarded
              ? `Your details are in${
                  subscription.domain ? `, including ${subscription.domain}` : ""
                }. We launch within ${OFFER.launchDays} days of when you sent them.`
              : `Payment is in. Send your details and the ${OFFER.launchDays}-day launch clock starts.`}
        </p>
        {subscription.status === "past_due" || subscription.status === "unpaid" ? (
          <p className={styles.lead}>
            The last payment did not go through. Update the card from the link in your Stripe
            receipt, or email {OFFER.supportEmail}.
          </p>
        ) : null}
        {subscription.cancel_at_period_end ? (
          <p className={styles.lead}>
            The site stays up until the date above. You will not be billed again unless you keep
            the plan.
          </p>
        ) : null}
        {!ended && !subscription.onboarded && welcomeHref ? (
          <Link href={welcomeHref} className={styles.primary}>
            Send your details
          </Link>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.billing}>
          {ended ? (
            <Link href="/for-agents" className={styles.primary}>
              Start a new website
            </Link>
          ) : subscription.cancel_at_period_end ? (
            <button type="button" className={styles.primary} disabled={working} onClick={() => change("resume")}>
              {working ? "Saving…" : "Keep my website"}
            </button>
          ) : confirming ? (
            <div className={styles.confirm}>
              <p>
                Cancel at the end of this period? The site stays up
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
            <button type="button" className={styles.ghost} onClick={() => setConfirming(true)}>
              Cancel subscription
            </button>
          )}
        </div>
      </div>
      <SitePreview />
    </section>
  );
}
