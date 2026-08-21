import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create an Acres account to save favorite properties and browse listings.",
};

export default function SignupPage() {
  return <SignupForm />;
}
