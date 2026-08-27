import { FirebaseError } from "firebase/app";
import {
  OAuthProvider,
  getAdditionalUserInfo,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export type AppleSignInResult = {
  isNewUser: boolean;
  redirected: boolean;
};

export function isAuthCancelled(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : "";
  return (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  );
}

function appleProvider() {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return provider;
}

function isNewFirebaseUser(result: UserCredential) {
  return getAdditionalUserInfo(result)?.isNewUser ?? false;
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  const auth = getFirebaseAuth();
  const provider = appleProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    return { isNewUser: isNewFirebaseUser(result), redirected: false };
  } catch (error) {
    const code = error instanceof FirebaseError ? error.code : "";
    if (code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider);
      return { isNewUser: false, redirected: true };
    }
    throw error;
  }
}

export async function completeAppleRedirect(): Promise<AppleSignInResult | null> {
  const result = await getRedirectResult(getFirebaseAuth());
  if (!result) return null;
  return { isNewUser: isNewFirebaseUser(result), redirected: true };
}

export function splitDisplayName(displayName: string | null | undefined) {
  const trimmed = String(displayName || "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}
