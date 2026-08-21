import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Acres account to save properties and view your favorites.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<p style={{ padding: 32, textAlign: "center" }}>Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
