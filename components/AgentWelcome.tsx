"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import GlassButton from "@/components/GlassButton";
import { claimAgentSubscription } from "@/lib/api";
import { OFFER } from "@/lib/agentOffer";
import {
  fetchAgentCheckoutSession,
  submitAgentOnboarding,
  type AgentCheckoutSession,
  type OnboardingAnswers,
} from "@/lib/funnel";
import styles from "@/components/AgentWelcome.module.css";

type Field = {
  name: keyof OnboardingAnswers;
  label: string;
  placeholder?: string;
  hint?: string;
  type?: "text" | "tel" | "url";
  multiline?: boolean;
  wide?: boolean;
};

const FIELDS: Field[] = [
  { name: "phone", label: "Phone number for your site", type: "tel", placeholder: "(902) 555-0142" },
  { name: "brokerage", label: "Brokerage", placeholder: "Harbourview Realty" },
  {
    name: "domain",
    label: "Domain you own or want",
    placeholder: "janesellshalifax.ca",
    hint: "Leave blank and we will suggest a few.",
  },
  {
    name: "service_areas",
    label: "Areas you serve",
    placeholder: "Halifax, Dartmouth, Bedford",
  },
  { name: "instagram", label: "Instagram", placeholder: "@janesellshalifax" },
  { name: "tiktok", label: "TikTok", placeholder: "@janerealestate" },
  { name: "facebook", label: "Facebook page", placeholder: "facebook.com/janerealestate" },
  {
    name: "headshot_url",
    label: "Link to your headshot",
    type: "url",
    placeholder: "https://…",
    hint: `A Dropbox, Google Drive or brokerage page link works. Or email the photo to ${OFFER.supportEmail}.`,
  },
  {
    name: "bio",
    label: "A few notes about you",
    multiline: true,
    wide: true,
    placeholder:
      "Years in the business, what you specialise in, why clients pick you. Bullet points are fine, we will write it up.",
  },
  {
    name: "notes",
    label: "Anything else",
    multiline: true,
    wide: true,
    placeholder: "Brand colours, testimonials, sites you like, brokerage rules we should follow.",
  },
];

type LoadState =
  | { status: "loading" }
  | { status: "ready"; session: AgentCheckoutSession }
  | { status: "error"; message: string };

export default function AgentWelcome({ sessionId }: { sessionId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [load, setLoad] = useState<LoadState>(
    sessionId ? { status: "loading" } : { status: "error", message: "missing" },
  );
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!sessionId || authLoading || !user) return;
    claimAgentSubscription(sessionId).catch(() => {
      // The studio can still attach this checkout from the receipt link.
    });
  }, [authLoading, sessionId, user]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetchAgentCheckoutSession(sessionId)
      .then((session) => {
        if (!cancelled) setLoad({ status: "ready", session });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({
          status: "error",
          message: error instanceof Error ? error.message : "We could not find that checkout.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const filled = Object.values(answers).some((value) => value && value.trim());
    if (!filled) {
      setSubmitError("Fill in at least one field so we have something to start with.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitAgentOnboarding(sessionId, answers);
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not send your details.");
    } finally {
      setSubmitting(false);
    }
  };

  if (load.status === "loading") {
    return (
      <div className={styles.card}>
        <div className={styles.spinner} aria-hidden="true" />
        <p className={styles.muted}>Confirming your payment…</p>
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className={styles.card}>
        <p className={styles.kicker}>Almost there</p>
        <h1>We could not load your checkout.</h1>
        <p className={styles.muted}>
          If you just paid, your spot is safe and a receipt is on its way. Email{" "}
          <a href={`mailto:${OFFER.supportEmail}?subject=My%20agent%20website`}>
            {OFFER.supportEmail}
          </a>{" "}
          with your headshot, brokerage and service areas and we will take it from there.
        </p>
        <Link href="/for-agents" className={styles.link}>
          Back to the offer
        </Link>
      </div>
    );
  }

  const { session } = load;
  const greeting = session.first_name ? `You're in, ${session.first_name}.` : "You're in.";
  const done = sent || session.onboarded;

  if (done) {
    return (
      <div className={styles.card}>
        <div className={styles.badge} aria-hidden="true">
          ✓
        </div>
        <p className={styles.kicker}>Details received</p>
        <h1>Your {OFFER.launchDays}-day launch clock has started.</h1>
        <p className={styles.muted}>
          We will be in touch at {session.email || "your email"} within one business day with a
          first look. Want to add something? Email{" "}
          <a href={`mailto:${OFFER.supportEmail}?subject=My%20agent%20website`}>
            {OFFER.supportEmail}
          </a>
          .
        </p>
        <ol className={styles.timeline}>
          <li>
            <strong>Today</strong> We review your details and reserve your domain.
          </li>
          <li>
            <strong>Days 2 to 5</strong> We write your copy and build your site.
          </li>
          <li>
            <strong>By day {OFFER.launchDays}</strong> Your site goes live and we walk you through
            your dashboard.
          </li>
        </ol>
        {authLoading ? (
          <p className={styles.accountNote}>Checking your account…</p>
        ) : user ? (
          <Link href="/account" className={styles.account}>
            Open your website studio
          </Link>
        ) : (
          <>
            <p className={styles.accountNote}>
              Sign in to put this website on your Acres account. Any login works, even when it is
              not the email you paid with.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/for-agents/welcome?session_id=${sessionId}`)}`}
              className={styles.account}
            >
              Sign in and add it to my account
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <div className={styles.badge} aria-hidden="true">
          ✓
        </div>
        <p className={styles.kicker}>Payment confirmed</p>
        <h1>{greeting} Let&apos;s build your site.</h1>
        <p className={styles.muted}>
          Ten minutes here is all we need. Fill in what you can, skip what you cannot, and we will
          ask about the rest. Your {OFFER.launchDays}-day launch clock starts when you hit send.
        </p>
      </div>

      <form className={styles.form} onSubmit={submit} noValidate>
        {FIELDS.map((field) => {
          const id = `onboarding-${field.name}`;
          const value = answers[field.name] ?? "";
          const update = (next: string) =>
            setAnswers((current) => ({ ...current, [field.name]: next }));
          return (
            <label
              key={field.name}
              htmlFor={id}
              className={`${styles.field} ${field.wide ? styles.fieldWide : ""}`}
            >
              <span className={styles.label}>{field.label}</span>
              {field.multiline ? (
                <textarea
                  id={id}
                  className={styles.input}
                  rows={5}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(event) => update(event.target.value)}
                />
              ) : (
                <input
                  id={id}
                  className={styles.input}
                  type={field.type ?? "text"}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(event) => update(event.target.value)}
                />
              )}
              {field.hint ? <span className={styles.hint}>{field.hint}</span> : null}
            </label>
          );
        })}

        <div className={styles.actions}>
          {submitError ? (
            <p className={styles.error} role="alert">
              {submitError}
            </p>
          ) : null}
          <GlassButton
            type="submit"
            title="Send my details"
            loading={submitting}
            className={styles.submit}
          />
        </div>
      </form>
    </div>
  );
}
