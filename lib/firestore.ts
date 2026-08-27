"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import { refreshAuthClaims } from "@/lib/emailVerification";

export type UserProfile = {
  firstName?: string;
  lastName?: string;
  isFirstTimeHomebuyer?: boolean;
  browsingStatus?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type OnboardingData = {
  firstName: string;
  lastName: string;
  isFirstTimeHomebuyer: boolean;
  browsingStatus: string;
};

export async function getUserData(userId: string): Promise<UserProfile | null> {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return null;
  return userSnap.data() as UserProfile;
}

export async function saveUserOnboarding(userId: string, onboardingData: OnboardingData) {
  const currentUser = getFirebaseAuth().currentUser;
  if (currentUser) {
    await refreshAuthClaims(currentUser);
  }

  const db = getFirebaseDb();
  const userRef = doc(db, "users", userId);
  const now = new Date().toISOString();

  await setDoc(
    userRef,
    {
      ...onboardingData,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  return true;
}

export type FavoriteRecord = {
  docId: string;
  propertyId: string;
  addedAt?: string;
};

const propertyDocId = (propertyId: string) => {
  const cleaned = String(propertyId || "").replace(/\//g, "_").trim();
  return cleaned.slice(0, 1400) || "unknown";
};

export async function addToFavorites(userId: string, propertyId: string) {
  const db = getFirebaseDb();
  const favoriteRef = doc(db, "users", userId, "favorites", propertyDocId(propertyId));

  await setDoc(
    favoriteRef,
    {
      propertyId: String(propertyId),
      addedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { success: true, docId: propertyDocId(propertyId) };
}

export async function getUserFavorites(userId: string): Promise<FavoriteRecord[]> {
  const db = getFirebaseDb();
  const favoritesRef = collection(db, "users", userId, "favorites");
  const querySnapshot = await getDocs(favoritesRef);

  const favorites: FavoriteRecord[] = [];
  querySnapshot.forEach((docSnap) => {
    favorites.push({
      docId: docSnap.id,
      propertyId: String(docSnap.data().propertyId || docSnap.id),
      addedAt: docSnap.data().addedAt as string | undefined,
    });
  });

  favorites.sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));
  return favorites;
}

export async function removeFromFavorites(userId: string, docId: string) {
  const db = getFirebaseDb();
  const favoriteRef = doc(db, "users", userId, "favorites", docId);
  await deleteDoc(favoriteRef);
  return { success: true };
}

export function favoriteDocIdForProperty(propertyId: string) {
  return propertyDocId(propertyId);
}
