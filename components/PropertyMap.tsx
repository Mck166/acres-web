"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import styles from "@/components/PropertyMap.module.css";

const PropertyMapCanvas = dynamic(() => import("@/components/PropertyMapCanvas"), {
  ssr: false,
  loading: () => <div className={styles.page} />,
});

export default function PropertyMap() {
  useEffect(() => {
    document.body.setAttribute("data-map-page", "");
    return () => {
      document.body.removeAttribute("data-map-page");
    };
  }, []);

  return <PropertyMapCanvas />;
}
