"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/components/AuthProvider";
import AppleSignInButton from "@/components/AppleSignInButton";
import GlassButton from "@/components/GlassButton";
import { isAuthCancelled } from "@/lib/appleAuth";
import { pathAfterSignIn } from "@/lib/completeAuth";
import { logEvent } from "@/lib/analytics";
import styles from "@/components/AuthForm.module.css";

function messageForError(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/network-request-failed":
      return "No connection. Check your network and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email. Log in with email and password instead.";
    case "auth/popup-blocked":
      return "Your browser blocked the Apple sign-in window. Allow popups and try again.";
    default:
      return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, signInWithApple, pendingOAuth, clearPendingOAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const oauthHandled = useRef(false);

  const nextPath = searchParams.get("next") || "/";

  const finishAppleAuth = useCallback(async (isNewUser: boolean) => {
    logEvent(isNewUser ? "sign_up" : "login", { method: "apple" });
    router.push(await pathAfterSignIn(nextPath));
  }, [nextPath, router]);

  useEffect(() => {
    if (!pendingOAuth || oauthHandled.current) return;
    oauthHandled.current = true;
    setLoading(true);
    finishAppleAuth(pendingOAuth.isNewUser)
      .catch((error) => {
        oauthHandled.current = false;
        setErrors({ form: messageForError(error) });
      })
      .finally(() => {
        clearPendingOAuth();
        setLoading(false);
      });
  }, [clearPendingOAuth, finishAppleAuth, pendingOAuth]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    const nextErrors: { email?: string; password?: string } = {};
    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    if (!password) nextErrors.password = "Enter your password.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await login(trimmedEmail, password);
      logEvent("login", { method: "password" });
      router.push(await pathAfterSignIn(nextPath));
    } catch (error) {
      setErrors({ form: messageForError(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    if (loading) return;
    setErrors({});
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (result.redirected) return;
      await finishAppleAuth(result.isNewUser);
    } catch (error) {
      if (!isAuthCancelled(error)) {
        setErrors({ form: messageForError(error) });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Login</h1>
        <p className={styles.subtitle}>Sign in to your account</p>
        <AppleSignInButton
          onClick={handleApple}
          loading={loading}
          className={styles.appleButton}
        />
        <div className={styles.divider} role="separator">
          or
        </div>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ""}`}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined, form: undefined }));
            }}
            disabled={loading}
          />
          {errors.email ? <p className={styles.fieldError}>{errors.email}</p> : null}

          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className={`${styles.input}${errors.password ? ` ${styles.inputError}` : ""}`}
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined, form: undefined }));
            }}
            disabled={loading}
          />
          {errors.password ? <p className={styles.fieldError}>{errors.password}</p> : null}

          {errors.form ? <div className={styles.formError}>{errors.form}</div> : null}

          <GlassButton title="Login" type="submit" loading={loading} className={styles.submit} />
        </form>
        <p className={styles.switch}>
          Don&apos;t have an account?{" "}
          <Link href={nextPath !== "/" ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup"}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
