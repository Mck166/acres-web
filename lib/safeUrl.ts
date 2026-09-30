/** Keep profile and listing links on http(s). Anything else is dropped. */
export function httpUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 500) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseSocialLinkLines(text: string) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const url = httpUrl(line);
      if (!url) return null;
      return {
        label: url.replace(/^https?:\/\//, ""),
        url,
      };
    })
    .filter((link): link is { label: string; url: string } => Boolean(link));
}

export function isStripeCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}
