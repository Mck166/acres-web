import { Suspense } from "react";
import type { Metadata } from "next";
import VerifyEmailForm from "@/components/VerifyEmailForm";

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Confirm your email address to finish creating your Acres account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p style={{ padding: 32, textAlign: "center" }}>Loading…</p>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
