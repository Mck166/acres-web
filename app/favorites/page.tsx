import type { Metadata } from "next";
import FavoritesView from "@/components/FavoritesView";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Favorites",
  description: "See the properties you have saved to your Acres favorites.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FavoritesPage() {
  return (
    <div className={styles.page}>
      <FavoritesView />
    </div>
  );
}
