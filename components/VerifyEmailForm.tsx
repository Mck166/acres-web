"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import GlassButton from "@/components/GlassButton";
import { onboardingPath, pathAfterSignIn } from "@/lib/completeAuth";
import {
  messageForVerificationError,
  needsEmailVerification,
  sendVerificationEmail,
} from "@/lib/emailVerification";
import { getFirebaseAuth } from "@/lib/firebase";
import styles from "@/components/AuthForm.module.css";

export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser, logout } = useAuth();
  const nextPath = searchParams.get("next") || "/onboarding";
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const checkedOnLoad = useRef(false);

  const continueIfVerified = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current || needsEmailVerification(current)) return false;
    router.replace(await pathAfterSignIn(nextPath));
    return true;
  }, [nextPath, router]);

  useEffect(() => {
    if (authLoading || checkedOnLoad.current) return;
    checkedOnLoad.current = true;

    let cancelled = false;
    (async () => {
      await refreshUser();
      if (cancelled) return;
      await continueIfVerified();
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, continueIfVerified, refreshUser]);

  const handleConfirmed = async () => {
    if (checking) return;
    setError(null);
    setSuccess(null);
    setChecking(true);
    try {
      await refreshUser();
      const redirected = await continueIfVerified();
      if (!redirected) {
        setError("We still don't see a confirmed email. Open the link in your inbox, then try again.");
      }
    } catch (confirmError) {
      setError(messageForVerificationError(confirmError));
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (resending || !user) return;
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      await sendVerificationEmail(user);
      setSuccess("A new confirmation email is on the way.");
    } catch (resendError) {
      setError(messageForVerificationError(resendError));
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace(`/login?next=${encodeURIComponent(onboardingPath(nextPath))}`);
  };

  if (authLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.subtitle}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Confirm your email</h1>
          <p className={styles.subtitle}>
            If you just clicked the link we sent, your email is confirmed. Log in to continue.
          </p>
          <p className={styles.switch}>
            <Link href={`/login?next=${encodeURIComponent(onboardingPath(nextPath))}`}>Login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Confirm your email</h1>
        <p className={styles.subtitle}>
          We sent a confirmation link to{" "}
          <span className={styles.email}>{user.email || "your email"}</span>. Open it,
          then come back here.
        </p>

        {error ? <div className={styles.formError}>{error}</div> : null}
        {success ? <div className={styles.formSuccess}>{success}</div> : null}

        <GlassButton
          title="I've confirmed my email"
          onClick={handleConfirmed}
          loading={checking}
          className={styles.submit}
        />

        <p className={styles.switch}>
          <button
            type="button"
            className={styles.textButton}
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Sending…" : "Resend email"}
          </button>
        </p>
        <p className={styles.switch}>
          Wrong address?{" "}
          <button type="button" className={styles.textButton} onClick={handleLogout}>
            Use a different email
          </button>
        </p>
      </div>
    </div>
  );
}
