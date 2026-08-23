"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buildPropertyBackHref } from "@/lib/navigationState";
import styles from "@/app/properties/[id]/page.module.css";

type PropertyBackLinkProps = {
  propertyId: string;
};

export default function PropertyBackLink({ propertyId }: PropertyBackLinkProps) {
  const searchParams = useSearchParams();
  const { href, label } = buildPropertyBackHref(propertyId, searchParams);

  return (
    <Link href={href} className={styles.back}>
      {label}
    </Link>
  );
}
