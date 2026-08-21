"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import styles from "@/components/Header.module.css";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/favorites", label: "Favorites" },
  { href: "/blog", label: "Blog" },
];

export default function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.wordmark} aria-label="Acres home">
          Acres
        </Link>
        <nav className={styles.nav} aria-label="Main">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.link}${isActive ? ` ${styles.linkActive}` : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          <div className={styles.account}>
            {user ? (
              <>
                <span className={styles.email} title={user.email || undefined}>
                  {user.email}
                </span>
                <button type="button" className={styles.logout} onClick={() => logout()}>
                  Logout
                </button>
              </>
            ) : (
              <Link href="/login" className={styles.loginLink}>
                Login
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
