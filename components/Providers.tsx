"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import GoogleAnalytics from "@/components/GoogleAnalytics";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <GoogleAnalytics />
      {children}
    </AuthProvider>
  );
}
