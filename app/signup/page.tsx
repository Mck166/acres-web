import { Suspense } from "react";
import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create an Acres account to save favorite properties and browse listings.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={<p style={{ padding: 32, textAlign: "center" }}>Loading…</p>}>
      <SignupForm />
    </Suspense>
  );
}
