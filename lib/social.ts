"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";
import {
  displayNameOf,
  followDocId,
  nextSlugCandidate,
  reviewDocId,
  slugifyName,
} from "@/lib/slug";

const nowIso = () => new Date().toISOString();

export type SocialLink = { label: string; url: string };

export type AgentProfile = {
  slug: string;
  uid: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  yearsAsAgent?: string;
  about?: string;
  photoUrl?: string;
  socialLinks?: SocialLink[];
  phoneNumber?: string;
  email?: string;
  published?: boolean;
  followerCount?: number;
  updatedAt?: string;
};

export type FollowRecord = {
  id: string;
  followerId: string;
  agentId: string;
  claimedClient?: boolean;
  clientStatus?: "none" | "pending" | "confirmed" | "declined";
};

export type OpenHouseRecord = {
  id: string;
  authorId: string;
  authorSlug?: string;
  authorName?: string;
  authorPhotoUrl?: string;
  propertyId: string;
  pid?: string;
  address?: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
  createdAt?: string;
};

export type PostRecord = {
  id: string;
  authorId: string;
  authorSlug?: string;
  authorName?: string;
  authorPhotoUrl?: string;
  text?: string;
  photoUrls?: string[];
  propertyIds?: string[];
  pids?: string[];
  likeCount?: number;
  commentCount?: number;
  createdAt?: string;
};

export type ReviewRecord = {
  id: string;
  agentId: string;
  authorId: string;
  authorName?: string;
  rating: number;
  text?: string;
  createdAt?: string;
};

export type CommentRecord = {
  id: string;
  authorId: string;
  authorName?: string;
  authorPhotoUrl?: string;
  authorSlug?: string;
  authorAccountType?: string;
  text: string;
  createdAt?: string;
};

function db() {
  return getFirebaseDb();
}

export async function getAgentProfileBySlug(slug: string): Promise<AgentProfile | null> {
  if (!slug) return null;
  const snap = await getDoc(doc(db(), "agentProfiles", slug));
  if (!snap.exists()) return null;
  return { slug: snap.id, ...(snap.data() as Omit<AgentProfile, "slug">) };
}

export async function allocateUniqueSlug(
  firstName: string,
  lastName: string,
  uid: string,
  preferred?: string | null,
) {
  const base = preferred || slugifyName(firstName, lastName);
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const candidate = nextSlugCandidate(base, attempt);
    const existing = await getAgentProfileBySlug(candidate);
    if (!existing || existing.uid === uid) return candidate;
  }
  return `${base}-${String(uid).slice(0, 6)}`;
}

export function publicProfilePayload(
  userId: string,
  data: Record<string, unknown>,
  slug: string,
): Omit<AgentProfile, "slug"> & { slug: string } {
  return {
    uid: userId,
    displayName: displayNameOf(data),
    firstName: String(data.firstName || ""),
    lastName: String(data.lastName || ""),
    company: String(data.company || ""),
    yearsAsAgent: String(data.yearsAsAgent || ""),
    about: String(data.about || ""),
    photoUrl: String(data.profilePictureUrl || data.photoUrl || ""),
    socialLinks: Array.isArray(data.socialLinks) ? (data.socialLinks as SocialLink[]) : [],
    phoneNumber: String(data.phoneNumber || ""),
    email: String(data.email || ""),
    published: data.profilePublic !== false,
    followerCount: typeof data.followerCount === "number" ? data.followerCount : 0,
    updatedAt: nowIso(),
    slug,
  };
}

export async function publishAgentProfile(
  userId: string,
  data: Record<string, unknown>,
  options: { keepSlug?: boolean } = {},
) {
  const current = options.keepSlug ? String(data.slug || "") : "";
  const slug = await allocateUniqueSlug(
    String(data.firstName || ""),
    String(data.lastName || ""),
    userId,
    current || String(data.slug || "") || null,
  );
  const payload = publicProfilePayload(userId, { ...data, profilePublic: true }, slug);

  if (data.slug && data.slug !== slug) {
    await deleteDoc(doc(db(), "agentProfiles", String(data.slug))).catch(() => undefined);
  }

  await setDoc(doc(db(), "agentProfiles", slug), payload, { merge: true });
  return slug;
}

export async function unpublishAgentProfile(userId: string, slug?: string | null) {
  if (!slug) return;
  const refDoc = doc(db(), "agentProfiles", slug);
  const snap = await getDoc(refDoc);
  if (!snap.exists() || snap.data()?.uid !== userId) return;
  await setDoc(refDoc, { published: false, updatedAt: nowIso() }, { merge: true });
}

export async function getFollow(followerId: string, agentId: string): Promise<FollowRecord | null> {
  if (!followerId || !agentId) return null;
  const snap = await getDoc(doc(db(), "follows", followDocId(followerId, agentId)));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<FollowRecord, "id">) };
}

export async function createFollow(followerId: string, agentId: string, options: { claimedClient?: boolean } = {}) {
  const id = followDocId(followerId, agentId);
  const existing = await getFollow(followerId, agentId);
  if (existing) return existing;
  const claimedClient = Boolean(options.claimedClient);
  const payload = {
    followerId,
    agentId,
    claimedClient,
    clientStatus: claimedClient ? "pending" : "none",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await setDoc(doc(db(), "follows", id), payload, { merge: true });
  if (!existing) {
    const profileSnap = await getDocs(
      query(collection(db(), "agentProfiles"), where("uid", "==", agentId), limit(1)),
    );
    if (!profileSnap.empty) {
      await updateDoc(profileSnap.docs[0].ref, { followerCount: increment(1) }).catch(() => undefined);
    }
  }
  return { id, ...payload };
}

export async function deleteFollow(followerId: string, agentId: string) {
  const existing = await getFollow(followerId, agentId);
  if (!existing) return;
  await deleteDoc(doc(db(), "follows", followDocId(followerId, agentId)));
  const profileSnap = await getDocs(
    query(collection(db(), "agentProfiles"), where("uid", "==", agentId), limit(1)),
  );
  if (!profileSnap.empty) {
    await updateDoc(profileSnap.docs[0].ref, { followerCount: increment(-1) }).catch(() => undefined);
  }
}

export async function listOpenHouses(options: { authorId?: string; pageSize?: number } = {}): Promise<OpenHouseRecord[]> {
  const housesRef = collection(db(), "openHouses");
  const pageSize = options.pageSize || 100;
  const q = options.authorId
    ? query(housesRef, where("authorId", "==", options.authorId), orderBy("startsAt", "asc"), limit(pageSize))
    : query(housesRef, orderBy("startsAt", "asc"), limit(pageSize));
  const snap = await getDocs(q);
  const now = Date.now();
  return snap.docs
    .map((item) => ({ id: item.id, ...(item.data() as Omit<OpenHouseRecord, "id">) }))
    .filter((item) => {
      const end = Date.parse(item.endsAt || "");
      return Number.isFinite(end) && end > now;
    });
}

export async function createOpenHouse(
  author: { uid: string; slug?: string; displayName?: string; photoUrl?: string; profilePictureUrl?: string },
  data: { propertyId: string; pid?: string; address?: string; startsAt: string; endsAt: string; notes?: string },
) {
  const payload = {
    authorId: author.uid,
    authorSlug: author.slug || "",
    authorName: author.displayName || displayNameOf(author),
    authorPhotoUrl: author.photoUrl || author.profilePictureUrl || "",
    propertyId: String(data.propertyId || ""),
    pid: String(data.pid || "").trim(),
    address: String(data.address || "").trim(),
    startsAt: String(data.startsAt || ""),
    endsAt: String(data.endsAt || ""),
    notes: String(data.notes || "").trim(),
    createdAt: nowIso(),
  };
  const refDoc = await addDoc(collection(db(), "openHouses"), payload);
  return { id: refDoc.id, ...payload };
}

export async function deleteOpenHouse(openHouseId: string) {
  if (!openHouseId) return;
  await deleteDoc(doc(db(), "openHouses", openHouseId));
}

export async function listPosts(options: { authorId?: string; pageSize?: number } = {}): Promise<PostRecord[]> {
  const postsRef = collection(db(), "posts");
  const pageSize = options.pageSize || 30;
  const q = options.authorId
    ? query(postsRef, where("authorId", "==", options.authorId), orderBy("createdAt", "desc"), limit(pageSize))
    : query(postsRef, orderBy("createdAt", "desc"), limit(pageSize));
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<PostRecord, "id">) }));
}

export async function createPost(
  author: { uid: string; slug?: string; displayName?: string; photoUrl?: string; profilePictureUrl?: string },
  data: { text: string; photoUrls?: string[]; propertyIds?: string[]; pids?: string[] },
) {
  const payload = {
    authorId: author.uid,
    authorSlug: author.slug || "",
    authorName: author.displayName || displayNameOf(author),
    authorPhotoUrl: author.photoUrl || author.profilePictureUrl || "",
    text: String(data.text || "").trim(),
    photoUrls: data.photoUrls || [],
    propertyIds: data.propertyIds || [],
    pids: data.pids || [],
    likeCount: 0,
    commentCount: 0,
    createdAt: nowIso(),
  };
  const refDoc = await addDoc(collection(db(), "posts"), payload);
  return { id: refDoc.id, ...payload };
}

export async function uploadPostPhoto(userId: string, file: Blob) {
  const storage = getFirebaseStorage();
  const photoRef = ref(storage, `postPhotos/${userId}/${Date.now()}.jpg`);
  await uploadBytes(photoRef, file);
  return getDownloadURL(photoRef);
}

export async function toggleLike(postId: string, uid: string) {
  const likeRef = doc(db(), "posts", postId, "likes", uid);
  const snap = await getDoc(likeRef);
  if (snap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(doc(db(), "posts", postId), { likeCount: increment(-1) });
    return false;
  }
  await setDoc(likeRef, { uid, createdAt: nowIso() });
  await updateDoc(doc(db(), "posts", postId), { likeCount: increment(1) });
  return true;
}

export async function hasLiked(postId: string, uid: string) {
  if (!uid) return false;
  const snap = await getDoc(doc(db(), "posts", postId, "likes", uid));
  return snap.exists();
}

export async function listComments(postId: string): Promise<CommentRecord[]> {
  const snap = await getDocs(query(collection(db(), "posts", postId, "comments"), orderBy("createdAt", "asc")));
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<CommentRecord, "id">) }));
}

export async function addComment(
  postId: string,
  author: {
    uid: string;
    displayName?: string;
    photoUrl?: string;
    profilePictureUrl?: string;
    slug?: string;
    accountType?: string;
  },
  text: string,
) {
  const payload = {
    authorId: author.uid,
    authorName: author.displayName || displayNameOf(author),
    authorPhotoUrl: author.photoUrl || author.profilePictureUrl || "",
    authorSlug: author.slug || "",
    authorAccountType: author.accountType || "client",
    text: String(text || "").trim(),
    createdAt: nowIso(),
  };
  const refDoc = await addDoc(collection(db(), "posts", postId, "comments"), payload);
  await updateDoc(doc(db(), "posts", postId), { commentCount: increment(1) });
  return { id: refDoc.id, ...payload };
}

export async function listReviews(agentId: string): Promise<ReviewRecord[]> {
  const snap = await getDocs(
    query(collection(db(), "reviews"), where("agentId", "==", agentId), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ReviewRecord, "id">) }));
}

export async function upsertReview(
  agentId: string,
  author: { uid: string; firstName?: string; displayName?: string },
  data: { rating: number; text: string },
) {
  const id = reviewDocId(agentId, author.uid);
  const payload = {
    agentId,
    authorId: author.uid,
    authorName: author.firstName || displayNameOf(author),
    rating: Math.max(1, Math.min(5, Number(data.rating) || 5)),
    text: String(data.text || "").trim(),
    createdAt: nowIso(),
  };
  await setDoc(doc(db(), "reviews", id), payload, { merge: true });
  return { id, ...payload };
}

export { followDocId };
