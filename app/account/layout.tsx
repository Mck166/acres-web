import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your Acres profile, notifications, and open houses.",
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
