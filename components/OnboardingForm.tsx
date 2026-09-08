"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getUserData, saveUserOnboarding, updateUserData } from "@/lib/firestore";
import { requestWelcomeEmail } from "@/lib/api";
import { publishAgentProfile } from "@/lib/social";
import { splitDisplayName } from "@/lib/appleAuth";
import { needsEmailVerification } from "@/lib/emailVerification";
import { destinationAfterOnboarding, verifyEmailPath } from "@/lib/completeAuth";
import { getFirebaseAuth } from "@/lib/firebase";
import styles from "@/app/onboarding/page.module.css";

function parseLinks(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((url) => ({
      label: url.replace(/^https?:\/\//, ""),
      url: url.includes("://") ? url : `https://${url}`,
    }));
}

function questionsFor(accountType: string | null) {
  const shared = [
    {
      id: "accountType",
      question: "What kind of account do you want?",
      type: "choice" as const,
      options: ["Looking for a home", "I am an agent"],
    },
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
  ];
  if (accountType === "I am an agent") {
    return [
      ...shared,
      { id: "yearsAsAgent", question: "How many years have you been an agent?", type: "text" as const, placeholder: "Optional", skippable: true, autoComplete: "off" },
      { id: "company", question: "Which company do you work for?", type: "text" as const, placeholder: "Optional", skippable: true, autoComplete: "organization" },
      { id: "about", question: "Tell people a bit about you", type: "textarea" as const, placeholder: "Optional", skippable: true },
      { id: "socialLinks", question: "Add social or website links", type: "textarea" as const, placeholder: "One link per line", skippable: true },
    ];
  }
  return [
    ...shared,
    { id: "isFirstTimeHomebuyer", question: "Are you a first time homebuyer?", type: "yesno" as const },
    { id: "browsingStatus", question: "Are you ready to buy or just browsing?", type: "choice" as const, options: ["Ready to Buy", "Just Browsing"] },
  ];
}

type Answers = {
  accountType: string | null;
  firstName: string;
  lastName: string;
  isFirstTimeHomebuyer: boolean | null;
  browsingStatus: string | null;
  yearsAsAgent: string;
  company: string;
  about: string;
  socialLinks: string;
};

export default function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [checking, setChecking] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({
    accountType: null,
    firstName: "",
    lastName: "",
    isFirstTimeHomebuyer: null,
    browsingStatus: null,
    yearsAsAgent: "",
    company: "",
    about: "",
    socialLinks: "",
  });

  const nextPath = searchParams.get("next") || "/properties";
  const QUESTIONS = questionsFor(answers.accountType);
  const currentQuestion = QUESTIONS[Math.min(currentStep, QUESTIONS.length - 1)];
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
          router.replace(destinationAfterOnboarding(nextPath));
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
    if ("skippable" in currentQuestion && currentQuestion.skippable) return true;
    const value = resolvedAnswers[currentQuestion.id as keyof Answers];
    if (currentQuestion.type === "text" || currentQuestion.type === "textarea") {
      return typeof value === "string" && value.trim().length > 0;
    }
    return value !== null && value !== undefined && value !== "";
  }, [currentQuestion, resolvedAnswers]);

  const handleComplete = async () => {
    if (loading || !user) return;
    if (!resolvedAnswers.firstName.trim() || !resolvedAnswers.lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    const type = answers.accountType === "I am an agent" ? "agent" : "client";
    if (type === "client" && (answers.isFirstTimeHomebuyer === null || !answers.browsingStatus)) {
      setError("Please answer every question.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await refreshUser();
      const current = getFirebaseAuth().currentUser;
      if (!current || needsEmailVerification(current)) {
        router.replace(verifyEmailPath(nextPath));
        return;
      }
      const payload = {
        firstName: resolvedAnswers.firstName.trim(),
        lastName: resolvedAnswers.lastName.trim(),
        accountType: type as "client" | "agent",
        isFirstTimeHomebuyer: type === "client" ? answers.isFirstTimeHomebuyer : null,
        browsingStatus: type === "client" ? answers.browsingStatus : null,
        yearsAsAgent: answers.yearsAsAgent,
        company: answers.company,
        about: answers.about,
        socialLinks: parseLinks(answers.socialLinks),
      };
      await saveUserOnboarding(current.uid, payload);
      if (type === "agent") {
        const slug = await publishAgentProfile(current.uid, { ...payload, profilePublic: true });
        await updateUserData(current.uid, { slug, profilePublic: true, accountType: "agent" });
      }
      void requestWelcomeEmail();
      router.push(type === "agent" ? "/feed" : destinationAfterOnboarding(nextPath));
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
          <Link href={`/login?next=${encodeURIComponent("/onboarding")}`}>Log in</Link> to finish setting up your account.
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
                      setAnswers((current) => ({
                        ...current,
                        [currentQuestion.id]: option,
                      }));
                    }}
                    aria-pressed={value === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}

            {currentQuestion.type === "textarea" ? (
              <textarea
                className={`${styles.input} ${styles.textarea}${error ? ` ${styles.inputError}` : ""}`}
                name={currentQuestion.id}
                placeholder={currentQuestion.placeholder}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => {
                  setError(null);
                  setAnswers((current) => ({
                    ...current,
                    [currentQuestion.id]: event.target.value,
                  }));
                }}
                disabled={loading}
              />
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
            {"skippable" in currentQuestion && currentQuestion.skippable ? (
              <button type="button" className={styles.back} onClick={() => handleNext()} disabled={loading}>
                Skip
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
