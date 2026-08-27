import { getFirebaseAuth } from "@/lib/firebase";
import { needsEmailVerification } from "@/lib/emailVerification";
import { getUserData, type UserProfile } from "@/lib/firestore";

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

export function onboardingPath(nextPath: string) {
  const dest = destinationAfterOnboarding(nextPath);
  if (dest === "/properties") return "/onboarding";
  return `/onboarding?next=${encodeURIComponent(dest)}`;
}

export function verifyEmailPath(nextPath: string) {
  return `/verify-email?next=${encodeURIComponent(safeNextPath(nextPath))}`;
}

export function needsOnboarding(profile: UserProfile | null | undefined) {
  return !profile?.firstName;
}

export async function pathAfterSignIn(nextPath: string) {
  const dest = destinationAfterOnboarding(nextPath);
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    return `/login?next=${encodeURIComponent(onboardingPath(dest))}`;
  }
  if (needsEmailVerification(user)) {
    return verifyEmailPath(dest);
  }
  const profile = await getUserData(user.uid);
  if (needsOnboarding(profile)) {
    return onboardingPath(dest);
  }
  return dest;
}
