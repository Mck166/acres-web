import { Suspense } from "react";
import type { Metadata } from "next";
import OnboardingForm from "@/components/OnboardingForm";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Tell us a bit about yourself so we can personalize Acres.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p style={{ padding: 32, textAlign: "center" }}>Loading…</p>}>
      <OnboardingForm />
    </Suspense>
  );
}
