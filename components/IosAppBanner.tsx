"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { APP_STORE_URL } from "@/lib/site";
import styles from "@/components/IosAppBanner.module.css";

const STORAGE_KEY = "acres-ios-app-banner-dismissed";

const listeners = new Set<() => void>();
let dismissedThisSession = false;

type AcresEmbedWindow = Window & {
  ReactNativeWebView?: unknown;
  __acresOverlayBottom?: number;
};

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function isStandaloneApp() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia("(display-mode: standalone)").matches;
}

function isAcresAppEmbed() {
  const embed = window as AcresEmbedWindow;
  return (
    Boolean(embed.ReactNativeWebView) ||
    typeof embed.__acresOverlayBottom === "number" ||
    document.documentElement.getAttribute("data-acres-embed") === "1"
  );
}

function isIosDevice() {
  const ua = window.navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return true;
  if (/iPad/.test(ua)) return true;
  return window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
}

function shouldShowBanner() {
  if (dismissedThisSession) {
    return false;
  }

  try {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") {
      return false;
    }
  } catch {
    // Private browsing can block storage; still show the prompt.
  }

  return isIosDevice() && !isStandaloneApp() && !isAcresAppEmbed();
}

export default function IosAppBanner() {
  const pathname = usePathname();
  const eligible = useSyncExternalStore(subscribe, shouldShowBanner, () => false);
  const visible = eligible && pathname !== "/map";

  useEffect(() => {
    if (!visible) {
      document.body.removeAttribute("data-ios-app-banner");
      return;
    }

    document.body.setAttribute("data-ios-app-banner", "");
    return () => document.body.removeAttribute("data-ios-app-banner");
  }, [visible]);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    dismissedThisSession = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures; hiding for this visit is enough.
    }
    emitChange();
  };

  return (
    <div
      className={styles.banner}
      data-acres-app-banner
      role="region"
      aria-label="Download the Acres iPhone app"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.icon} src="/icon.png" alt="" width={40} height={40} />
      <div className={styles.copy}>
        <p className={styles.title}>Get the Acres app</p>
        <p className={styles.subtitle}>Swipe homes on your iPhone</p>
      </div>
      <a
        className={styles.download}
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Download
      </a>
      <button type="button" className={styles.close} onClick={dismiss} aria-label="Dismiss app download prompt">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
