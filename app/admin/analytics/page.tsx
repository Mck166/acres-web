import type { Metadata } from "next";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "App analytics",
  description: "Acres admin dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminAnalyticsPage() {
  return (
    <div className={styles.page}>
      <AnalyticsDashboard />
    </div>
  );
}
