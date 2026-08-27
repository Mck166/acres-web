import { getFirebaseAuth } from "@/lib/firebase";
import { getUserData } from "@/lib/firestore";

export function safeNextPath(nextPath: string, fallback = "/") {
  return nextPath.startsWith("/") ? nextPath : fallback;
}

export async function pathAfterSignIn(nextPath: string) {
  const dest = safeNextPath(nextPath);
  const uid = getFirebaseAuth().currentUser?.uid;
  if (uid) {
    const profile = await getUserData(uid);
    if (!profile) {
      return `/onboarding?next=${encodeURIComponent(dest)}`;
    }
  }
  return dest;
}
