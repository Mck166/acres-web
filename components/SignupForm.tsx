"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/components/AuthProvider";
import GlassButton from "@/components/GlassButton";
import styles from "@/components/AuthForm.module.css";

const MIN_PASSWORD_LENGTH = 6;

function messageForError(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try logging in instead.";
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/weak-password":
      return "That password is too weak. Try a longer one.";
    case "auth/network-request-failed":
      return "No connection. Check your network and try again.";
    case "auth/config":
    case "auth/config-not-found":
      return "Authentication is not configured correctly. Please try again later.";
    default:
      return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }
}

export default function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});

  const clearError = (key: "email" | "password" | "confirmPassword") => {
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    const nextErrors: { email?: string; password?: string; confirmPassword?: string } = {};
    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    if (!password) {
      nextErrors.password = "Choose a password.";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Re-enter your password.";
    } else if (password && password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await signup(trimmedEmail, password);
      router.push("/");
    } catch (error) {
      setErrors({ form: messageForError(error) });
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign Up</h1>
        <p className={styles.subtitle}>Create a new account</p>
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
              clearError("email");
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
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearError("password");
            }}
            disabled={loading}
          />
          {errors.password ? <p className={styles.fieldError}>{errors.password}</p> : null}

          <label className={styles.label} htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            className={`${styles.input}${errors.confirmPassword ? ` ${styles.inputError}` : ""}`}
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearError("confirmPassword");
            }}
            disabled={loading}
          />
          {errors.confirmPassword ? (
            <p className={styles.fieldError}>{errors.confirmPassword}</p>
          ) : null}

          {errors.form ? <div className={styles.formError}>{errors.form}</div> : null}

          <GlassButton title="Sign Up" type="submit" loading={loading} className={styles.submit} />
        </form>
        <p className={styles.switch}>
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
