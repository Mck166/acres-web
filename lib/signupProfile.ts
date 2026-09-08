import { getFirebaseAuth } from "@/lib/firebase";
import { needsEmailVerification } from "@/lib/emailVerification";
import { getUserData, saveUserOnboarding, updateUserData, type UserProfile } from "@/lib/firestore";
import { publishAgentProfile } from "@/lib/social";

export type SignupAnswers = {
  accountType: string | null;
  firstName: string;
  lastName: string;
  isFirstTimeHomebuyer: boolean | null;
  browsingStatus: string | null;
  yearsAsAgent: string;
  company: string;
  about: string;
  socialLinks: string;
};

export function parseSocialLinks(text: string) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((url) => ({
      label: url.replace(/^https?:\/\//, ""),
      url: url.includes("://") ? url : `https://${url}`,
    }));
}

export function buildSignupPayload(answers: SignupAnswers) {
  const type = answers.accountType === "I am an agent" ? "agent" : "client";
  return {
    firstName: String(answers.firstName || "").trim(),
    lastName: String(answers.lastName || "").trim(),
    accountType: type as "client" | "agent",
    isFirstTimeHomebuyer: type === "client" ? answers.isFirstTimeHomebuyer : null,
    browsingStatus: type === "client" ? answers.browsingStatus || null : null,
    yearsAsAgent: answers.yearsAsAgent || "",
    company: answers.company || "",
    about: answers.about || "",
    socialLinks: parseSocialLinks(answers.socialLinks),
    profilePublic: type === "agent",
  };
}

export function validateSignupProfile(answers: SignupAnswers) {
  const errors: Partial<Record<keyof SignupAnswers, string>> = {};
  if (!answers.accountType) errors.accountType = "Choose an account type.";
  if (!String(answers.firstName || "").trim()) errors.firstName = "Enter your first name.";
  if (!String(answers.lastName || "").trim()) errors.lastName = "Enter your last name.";
  if (answers.accountType === "Looking for a home") {
    if (answers.isFirstTimeHomebuyer !== true && answers.isFirstTimeHomebuyer !== false) {
      errors.isFirstTimeHomebuyer = "Tell us if this is your first home.";
    }
    if (!answers.browsingStatus) errors.browsingStatus = "Tell us if you are ready to buy.";
  }
  return errors;
}

export async function saveSignupProfile(userId: string, answers: SignupAnswers): Promise<UserProfile> {
  const existing = await getUserData(userId);
  if (existing?.firstName) return existing;

  const payload = buildSignupPayload(answers);
  await saveUserOnboarding(userId, payload);

  let slug = existing?.slug || "";
  const current = getFirebaseAuth().currentUser;
  if (payload.accountType === "agent" && current && !needsEmailVerification(current)) {
    slug = await publishAgentProfile(current.uid, { ...payload, profilePublic: true });
    await updateUserData(userId, { slug, profilePublic: true, accountType: "agent" });
  }

  return { ...payload, slug };
}

export async function publishAgentProfileIfNeeded(userId: string) {
  const profile = await getUserData(userId);
  if (!profile || profile.accountType !== "agent" || profile.slug) return profile;
  const slug = await publishAgentProfile(userId, { ...profile, profilePublic: true });
  await updateUserData(userId, { slug, profilePublic: true, accountType: "agent" });
  return { ...profile, slug, profilePublic: true };
}
