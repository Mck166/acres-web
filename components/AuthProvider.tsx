"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  completeAppleRedirect,
  signInWithApple as startAppleSignIn,
  type AppleSignInResult,
} from "@/lib/appleAuth";
import {
  needsEmailVerification,
  sendVerificationEmail,
} from "@/lib/emailVerification";

type PendingOAuth = {
  isNewUser: boolean;
};

type AuthContextValue = {
  user: User | null;
  emailVerified: boolean;
  loading: boolean;
  pendingOAuth: PendingOAuth | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<AppleSignInResult>;
  clearPendingOAuth: () => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingOAuth, setPendingOAuth] = useState<PendingOAuth | null>(null);

  const syncUser = useCallback((nextUser: User | null) => {
    setUser(nextUser);
    setEmailVerified(!!nextUser?.emailVerified);
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let unsubscribe = () => {};

    setPersistence(auth, browserLocalPersistence)
      .catch((error) => {
        console.error("Error setting auth persistence:", error);
      })
      .finally(() => {
        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          syncUser(nextUser);
          setLoading(false);
        });
        completeAppleRedirect()
          .then((result) => {
            if (!result) return;
            setPendingOAuth({ isNewUser: result.isNewUser });
          })
          .catch((error) => {
            console.error("Apple redirect error:", error);
          });
      });

    return () => unsubscribe();
  }, [syncUser]);

  const refreshUser = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) {
      syncUser(null);
      return;
    }
    await current.reload();
    syncUser(getFirebaseAuth().currentUser);
  }, [syncUser]);

  const login = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      email.trim(),
      password,
    );
    syncUser(cred.user);
    if (needsEmailVerification(cred.user)) {
      try {
        await sendVerificationEmail(cred.user);
      } catch (error) {
        console.error("Error sending verification email:", error);
      }
    }
  }, [syncUser]);

  const signup = useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email.trim(),
      password,
    );
    syncUser(cred.user);
    try {
      await sendVerificationEmail(cred.user);
    } catch (error) {
      console.error("Error sending verification email:", error);
    }
  }, [syncUser]);

  const signInWithApple = useCallback(async () => {
    return startAppleSignIn();
  }, []);

  const clearPendingOAuth = useCallback(() => {
    setPendingOAuth(null);
  }, []);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const value = useMemo(
    () => ({
      user,
      emailVerified,
      loading,
      pendingOAuth,
      login,
      signup,
      signInWithApple,
      clearPendingOAuth,
      refreshUser,
      logout,
    }),
    [
      user,
      emailVerified,
      loading,
      pendingOAuth,
      login,
      signup,
      signInWithApple,
      clearPendingOAuth,
      refreshUser,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
