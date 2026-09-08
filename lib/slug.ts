const SLUG_RE = /[^a-z0-9]+/g;

export function slugifyName(firstName?: string | null, lastName?: string | null) {
  const raw = [firstName, lastName].filter(Boolean).join(" ").trim().toLowerCase();
  const slug = raw.replace(SLUG_RE, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || "agent";
}

export function nextSlugCandidate(base: string, attempt: number) {
  if (attempt <= 1) return base;
  return `${base}-${attempt}`;
}

export function followDocId(followerId: string, agentId: string) {
  return `${followerId}_${agentId}`;
}

export function reviewDocId(agentId: string, authorId: string) {
  return `${agentId}_${authorId}`;
}

export function displayNameOf(profile?: {
  firstName?: string;
  lastName?: string;
  displayName?: string;
} | null) {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  return name || profile?.displayName || "Acres user";
}

export function isAgentAccount(profile?: { accountType?: string; profilePublic?: boolean } | null) {
  return profile?.accountType === "agent" && profile?.profilePublic !== false;
}
