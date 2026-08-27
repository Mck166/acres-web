import { getFirebaseAuth } from "@/lib/firebase";
import { needsEmailVerification } from "@/lib/emailVerification";
import { getUserData } from "@/lib/firestore";

export function safeNextPath(nextPath: string, fallback = "/") {
  return nextPath.startsWith("/") ? nextPath : fallback;
}

export function verifyEmailPath(nextPath: string) {
  return `/verify-email?next=${encodeURIComponent(safeNextPath(nextPath))}`;
}

export async function pathAfterSignIn(nextPath: string) {
  const dest = safeNextPath(nextPath);
  const user = getFirebaseAuth().currentUser;
  if (needsEmailVerification(user)) {
    return verifyEmailPath(dest);
  }
  if (user?.uid) {
    const profile = await getUserData(user.uid);
    if (!profile) {
      return `/onboarding?next=${encodeURIComponent(dest)}`;
    }
  }
  return dest;
}
