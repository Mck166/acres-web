"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import MetaPixel from "@/components/MetaPixel";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <GoogleAnalytics />
      <MetaPixel />
      {children}
    </AuthProvider>
  );
}
