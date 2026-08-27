"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getUserData, saveUserOnboarding } from "@/lib/firestore";
import { splitDisplayName } from "@/lib/appleAuth";
import { needsEmailVerification } from "@/lib/emailVerification";
import { verifyEmailPath } from "@/lib/completeAuth";
import styles from "@/app/onboarding/page.module.css";

const QUESTIONS = [
  {
    id: "firstName",
    question: "What is your first name?",
    type: "text" as const,
    placeholder: "Enter your first name",
    autoComplete: "given-name",
  },
  {
    id: "lastName",
    question: "What is your last name?",
    type: "text" as const,
    placeholder: "Enter your last name",
    autoComplete: "family-name",
  },
  {
    id: "isFirstTimeHomebuyer",
    question: "Are you a first time homebuyer?",
    type: "yesno" as const,
  },
  {
    id: "browsingStatus",
    question: "Are you ready to buy or just browsing?",
    type: "choice" as const,
    options: ["Ready to Buy", "Just Browsing"],
  },
];

type Answers = {
  firstName: string;
  lastName: string;
  isFirstTimeHomebuyer: boolean | null;
  browsingStatus: string | null;
};

export default function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({
    firstName: "",
    lastName: "",
    isFirstTimeHomebuyer: null,
    browsingStatus: null,
  });

  const nextPath = searchParams.get("next") || "/properties";
  const currentQuestion = QUESTIONS[currentStep];
  const appleNames = splitDisplayName(user?.displayName);
  const resolvedAnswers: Answers = {
    ...answers,
    firstName: answers.firstName || appleNames.firstName,
    lastName: answers.lastName || appleNames.lastName,
  };

  useEffect(() => {
    if (!user) return;
    if (needsEmailVerification(user)) {
      router.replace(verifyEmailPath(nextPath));
      return;
    }

    let cancelled = false;
    getUserData(user.uid)
      .then((profile) => {
        if (cancelled) return;
        if (profile?.firstName) {
          const dest = nextPath.startsWith("/") ? nextPath : "/";
          router.replace(dest);
          return;
        }
        setChecking(false);
      })
      .catch((loadError) => {
        console.error("Error checking onboarding:", loadError);
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nextPath, router, user]);

  const canProceed = useMemo(() => {
    const value = resolvedAnswers[currentQuestion.id as keyof Answers];
    if (currentQuestion.type === "text") {
      return typeof value === "string" && value.trim().length > 0;
    }
    return value !== null && value !== undefined;
  }, [currentQuestion, resolvedAnswers]);

  const handleComplete = async () => {
    if (loading || !user) return;
    if (!resolvedAnswers.firstName.trim() || !resolvedAnswers.lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    if (answers.isFirstTimeHomebuyer === null || !answers.browsingStatus) {
      setError("Please answer every question.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await saveUserOnboarding(user.uid, {
        firstName: resolvedAnswers.firstName.trim(),
        lastName: resolvedAnswers.lastName.trim(),
        isFirstTimeHomebuyer: answers.isFirstTimeHomebuyer,
        browsingStatus: answers.browsingStatus,
      });
      router.push(nextPath.startsWith("/") ? nextPath : "/");
    } catch (saveError) {
      console.error("Error saving onboarding:", saveError);
      setError("We could not save your details. Please try again.");
      setLoading(false);
    }
  };

  const handleNext = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canProceed || loading) return;
    if (currentStep < QUESTIONS.length - 1) {
      setError(null);
      setCurrentStep((step) => step + 1);
      return;
    }
    void handleComplete();
  };

  const handleBack = () => {
    if (currentStep === 0 || loading) return;
    setError(null);
    setCurrentStep((step) => step - 1);
  };

  if (authLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.status}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <p className={styles.status}>
          <Link href="/signup">Sign up</Link> to create your Acres account.
        </p>
      </div>
    );
  }

  if (needsEmailVerification(user)) {
    return (
      <div className={styles.page}>
        <p className={styles.status}>Loading…</p>
      </div>
    );
  }

  if (checking) {
    return (
      <div className={styles.page}>
        <p className={styles.status}>Loading…</p>
      </div>
    );
  }

  const isLastStep = currentStep === QUESTIONS.length - 1;
  const value = resolvedAnswers[currentQuestion.id as keyof Answers];

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.progress}>
          <div className={styles.progressBar} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
            />
          </div>
          <p className={styles.progressText}>
            {currentStep + 1} of {QUESTIONS.length}
          </p>
        </div>

        <form onSubmit={handleNext}>
          <div className={styles.question}>
            <h1>{currentQuestion.question}</h1>

            {currentQuestion.type === "yesno" ? (
              <div className={styles.options} role="radiogroup" aria-label={currentQuestion.question}>
                {[
                  { label: "Yes", optionValue: true },
                  { label: "No", optionValue: false },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`${styles.option}${value === option.optionValue ? ` ${styles.optionSelected}` : ""}`}
                    onClick={() => {
                      setError(null);
                      setAnswers((current) => ({
                        ...current,
                        isFirstTimeHomebuyer: option.optionValue,
                      }));
                    }}
                    aria-pressed={value === option.optionValue}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {currentQuestion.type === "choice" ? (
              <div className={styles.options} role="radiogroup" aria-label={currentQuestion.question}>
                {currentQuestion.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.option}${value === option ? ` ${styles.optionSelected}` : ""}`}
                    onClick={() => {
                      setError(null);
                      setAnswers((current) => ({ ...current, browsingStatus: option }));
                    }}
                    aria-pressed={value === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}

            {currentQuestion.type === "text" ? (
              <input
                className={`${styles.input}${error ? ` ${styles.inputError}` : ""}`}
                type="text"
                name={currentQuestion.id}
                autoComplete={currentQuestion.autoComplete}
                placeholder={currentQuestion.placeholder}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => {
                  setError(null);
                  setAnswers((current) => ({
                    ...current,
                    [currentQuestion.id]: event.target.value,
                  }));
                }}
                autoCapitalize="words"
                autoCorrect="off"
                disabled={loading}
              />
            ) : null}

            {error ? <p className={styles.error}>{error}</p> : null}
          </div>

          <div className={styles.actions}>
            {currentStep > 0 ? (
              <button type="button" className={styles.back} onClick={handleBack} disabled={loading}>
                Back
              </button>
            ) : null}
            <button type="submit" className={styles.next} disabled={!canProceed || loading}>
              {loading ? "Saving…" : isLastStep ? "Complete" : "Next"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
