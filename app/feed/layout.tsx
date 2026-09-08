import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Open Houses",
  description: "Upcoming open houses listed by Acres agents, soonest first.",
};

export default function FeedLayout({ children }: { children: ReactNode }) {
  return children;
}
