"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

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
