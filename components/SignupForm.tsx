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
import { needsEmailVerification } from "@/lib/emailVerification";
import { logEvent } from "@/lib/analytics";
import { requestWelcomeEmail } from "@/lib/api";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  saveSignupProfile,
  validateSignupProfile,
  type SignupAnswers,
} from "@/lib/signupProfile";
import styles from "@/components/AuthForm.module.css";

const MIN_PASSWORD_LENGTH = 6;
const SIGNUP_ANSWERS_KEY = "acres-signup-profile";

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
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email. Log in with email and password instead.";
    case "auth/popup-blocked":
      return "Your browser blocked the Apple sign-in window. Allow popups and try again.";
    default:
      return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }
}

function storeAnswers(answers: SignupAnswers) {
  try {
    sessionStorage.setItem(SIGNUP_ANSWERS_KEY, JSON.stringify(answers));
  } catch {
    // Ignore storage failures.
  }
}

function readStoredAnswers(): SignupAnswers | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_ANSWERS_KEY);
    return raw ? (JSON.parse(raw) as SignupAnswers) : null;
  } catch {
    return null;
  }
}

function clearStoredAnswers() {
  try {
    sessionStorage.removeItem(SIGNUP_ANSWERS_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function ChoiceRow({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.options} role="radiogroup">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`${styles.option}${value === option ? ` ${styles.optionSelected}` : ""}`}
          onClick={() => onChange(option)}
          disabled={disabled}
          aria-pressed={value === option}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, signInWithApple, pendingOAuth, clearPendingOAuth, user } = useAuth();
  const nextPath = searchParams.get("next") || "/properties";
  const [accountType, setAccountType] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isFirstTimeHomebuyer, setIsFirstTimeHomebuyer] = useState<boolean | null>(null);
  const [browsingStatus, setBrowsingStatus] = useState<string | null>(null);
  const [yearsAsAgent, setYearsAsAgent] = useState("");
  const [company, setCompany] = useState("");
  const [about, setAbout] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const oauthHandled = useRef(false);
  const isAgent = accountType === "I am an agent";

  const profileAnswers = useCallback((): SignupAnswers => ({
    accountType,
    firstName,
    lastName,
    isFirstTimeHomebuyer,
    browsingStatus,
    yearsAsAgent,
    company,
    about,
    socialLinks,
  }), [about, accountType, browsingStatus, company, firstName, isFirstTimeHomebuyer, lastName, socialLinks, yearsAsAgent]);

  useEffect(() => {
    if (!user || loading || pendingOAuth) return;
    if (!needsEmailVerification(user)) return;
    router.replace(`/verify-email?next=${encodeURIComponent(nextPath)}`);
  }, [loading, nextPath, pendingOAuth, router, user]);

  const finishProfile = useCallback(async (userId: string, answers: SignupAnswers) => {
    await saveSignupProfile(userId, answers);
    clearStoredAnswers();
    void requestWelcomeEmail();
  }, []);

  const finishAppleAuth = useCallback(async (isNewUser: boolean) => {
    logEvent(isNewUser ? "sign_up" : "login", { method: "apple" });
    const current = getFirebaseAuth().currentUser;
    const answers = profileAnswers().accountType ? profileAnswers() : readStoredAnswers();
    if (current && answers) {
      await finishProfile(current.uid, answers);
    }
    router.push(await pathAfterSignIn(nextPath));
  }, [finishProfile, nextPath, profileAnswers, router]);

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

  const clearError = (key: string) => {
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    const nextErrors: Record<string, string> = { ...validateSignupProfile(profileAnswers()) };
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
      const current = getFirebaseAuth().currentUser;
      if (current) {
        await finishProfile(current.uid, profileAnswers());
      }
      logEvent("sign_up", { method: "password" });
      router.push(await pathAfterSignIn(nextPath));
    } catch (error) {
      setErrors({ form: messageForError(error) });
      setLoading(false);
    }
  };

  const handleApple = async () => {
    if (loading) return;
    const nextErrors = validateSignupProfile(profileAnswers());
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    storeAnswers(profileAnswers());
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (result.redirected) return;
      await finishAppleAuth(result.isNewUser);
    } catch (error) {
      if (!isAuthCancelled(error)) {
        setErrors({ form: messageForError(error) });
      }
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.cardWide}>
        <h1 className={styles.title}>Sign Up</h1>
        <p className={styles.subtitle}>Create your account</p>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.label}>Account type</label>
          <ChoiceRow
            options={["Looking for a home", "I am an agent"]}
            value={accountType}
            onChange={(value) => {
              setAccountType(value);
              clearError("accountType");
            }}
            disabled={loading}
          />
          {errors.accountType ? <p className={styles.fieldError}>{errors.accountType}</p> : null}

          <label className={styles.label} htmlFor="firstName">
            First name
          </label>
          <input
            id="firstName"
            className={`${styles.input}${errors.firstName ? ` ${styles.inputError}` : ""}`}
            type="text"
            name="firstName"
            autoComplete="given-name"
            placeholder="Enter your first name"
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              clearError("firstName");
            }}
            disabled={loading}
          />
          {errors.firstName ? <p className={styles.fieldError}>{errors.firstName}</p> : null}

          <label className={styles.label} htmlFor="lastName">
            Last name
          </label>
          <input
            id="lastName"
            className={`${styles.input}${errors.lastName ? ` ${styles.inputError}` : ""}`}
            type="text"
            name="lastName"
            autoComplete="family-name"
            placeholder="Enter your last name"
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              clearError("lastName");
            }}
            disabled={loading}
          />
          {errors.lastName ? <p className={styles.fieldError}>{errors.lastName}</p> : null}

          {accountType === "Looking for a home" ? (
            <>
              <label className={styles.label}>Are you a first time homebuyer?</label>
              <ChoiceRow
                options={["Yes", "No"]}
                value={isFirstTimeHomebuyer === true ? "Yes" : isFirstTimeHomebuyer === false ? "No" : null}
                onChange={(value) => {
                  setIsFirstTimeHomebuyer(value === "Yes");
                  clearError("isFirstTimeHomebuyer");
                }}
                disabled={loading}
              />
              {errors.isFirstTimeHomebuyer ? (
                <p className={styles.fieldError}>{errors.isFirstTimeHomebuyer}</p>
              ) : null}

              <label className={styles.label}>Are you ready to buy or just browsing?</label>
              <ChoiceRow
                options={["Ready to Buy", "Just Browsing"]}
                value={browsingStatus}
                onChange={(value) => {
                  setBrowsingStatus(value);
                  clearError("browsingStatus");
                }}
                disabled={loading}
              />
              {errors.browsingStatus ? <p className={styles.fieldError}>{errors.browsingStatus}</p> : null}
            </>
          ) : null}

          {isAgent ? (
            <>
              <label className={styles.label} htmlFor="yearsAsAgent">
                Years as an agent
              </label>
              <input
                id="yearsAsAgent"
                className={styles.input}
                type="text"
                placeholder="Optional"
                value={yearsAsAgent}
                onChange={(event) => setYearsAsAgent(event.target.value)}
                disabled={loading}
              />
              <label className={styles.label} htmlFor="company">
                Company
              </label>
              <input
                id="company"
                className={styles.input}
                type="text"
                autoComplete="organization"
                placeholder="Optional"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                disabled={loading}
              />
              <label className={styles.label} htmlFor="about">
                About you
              </label>
              <textarea
                id="about"
                className={`${styles.input} ${styles.textarea}`}
                placeholder="Optional"
                value={about}
                onChange={(event) => setAbout(event.target.value)}
                disabled={loading}
              />
              <label className={styles.label} htmlFor="socialLinks">
                Social or website links
              </label>
              <textarea
                id="socialLinks"
                className={`${styles.input} ${styles.textarea}`}
                placeholder="One link per line, optional"
                value={socialLinks}
                onChange={(event) => setSocialLinks(event.target.value)}
                disabled={loading}
              />
            </>
          ) : null}

          <AppleSignInButton
            onClick={handleApple}
            loading={loading}
            label="Sign up with Apple"
            className={styles.appleButton}
          />
          <div className={styles.divider} role="separator">
            or
          </div>

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
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
