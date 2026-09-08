import { getFirebaseAuth } from "@/lib/firebase";
import { needsEmailVerification } from "@/lib/emailVerification";

export function safeNextPath(nextPath: string, fallback = "/") {
  return nextPath.startsWith("/") ? nextPath : fallback;
}

function isAuthFlowPath(path: string) {
  return (
    path === "/onboarding" ||
    path.startsWith("/onboarding?") ||
    path === "/verify-email" ||
    path.startsWith("/verify-email?") ||
    path === "/login" ||
    path.startsWith("/login?") ||
    path === "/signup" ||
    path.startsWith("/signup?")
  );
}

export function destinationAfterOnboarding(nextPath: string) {
  const dest = safeNextPath(nextPath, "/properties");
  return isAuthFlowPath(dest) ? "/properties" : dest;
}

export function verifyEmailPath(nextPath: string) {
  return `/verify-email?next=${encodeURIComponent(safeNextPath(nextPath))}`;
}

export async function pathAfterSignIn(nextPath: string) {
  const dest = destinationAfterOnboarding(nextPath);
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    return `/login?next=${encodeURIComponent(dest)}`;
  }
  if (needsEmailVerification(user)) {
    return verifyEmailPath(dest);
  }
  return dest;
}
