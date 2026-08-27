import { FirebaseError } from "firebase/app";
import { sendEmailVerification, type User } from "firebase/auth";
import { getSiteUrl } from "@/lib/site";

export function needsEmailVerification(user: User | null | undefined) {
  if (!user || user.emailVerified) return false;
  const providers = user.providerData || [];
  if (providers.some((provider) => provider.providerId !== "password")) {
    return false;
  }
  return true;
}

function continueUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/verify-email`;
  }
  return `${getSiteUrl()}/verify-email`;
}

export async function sendVerificationEmail(user: User) {
  await sendEmailVerification(user, {
    url: continueUrl(),
    handleCodeInApp: false,
  });
}

// reload() updates user.emailVerified, but Firestore still uses the ID token
// until it is force-refreshed. Without this, verified users fail writes.
export async function refreshAuthClaims(user: User) {
  await user.reload();
  await user.getIdToken(true);
}

export function messageForVerificationError(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/too-many-requests":
      return "Too many emails sent. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "No connection. Check your network and try again.";
    default:
      return error instanceof Error
        ? error.message
        : "Could not send the email. Please try again.";
  }
}
