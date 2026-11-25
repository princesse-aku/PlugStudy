"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { backend } from "@/lib/backend";
import type { AppUser, Profile } from "@/lib/types";

interface AuthContextValue {
  /** false tant que l'état de connexion et le profil ne sont pas connus. */
  ready: boolean;
  user: AppUser | null;
  profile: Profile | null;
  demo: boolean;
  signInWithEmail(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signUpWithEmail(name: string, email: string, password: string): Promise<void>;
  resendVerification(): Promise<void>;
  /** Relit le compte ; renvoie true si l'adresse e-mail est confirmée. */
  refreshUser(): Promise<boolean>;
  discardAccount(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  saveProfile(profile: Profile): Promise<void>;
  /** Change le nom affiché du compte. */
  updateName(name: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = backend.onAuthChange(async (nextUser) => {
      if (!nextUser) {
        if (cancelled) return;
        setUser(null);
        setProfile(null);
        setReady(true);
        return;
      }
      let nextProfile: Profile | null = null;
      try {
        nextProfile = await backend.getProfile(nextUser.uid);
      } catch {
        nextProfile = null;
      }
      if (cancelled) return;
      setUser(nextUser);
      setProfile(nextProfile);
      setReady(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await backend.signInWithEmail(email, password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await backend.signInWithGoogle();
  }, []);

  const signUpWithEmail = useCallback(async (name: string, email: string, password: string) => {
    await backend.signUpWithEmail(name, email, password);
  }, []);

  const resendVerification = useCallback(async () => {
    await backend.sendVerificationEmail();
  }, []);

  const refreshUser = useCallback(async () => {
    const next = await backend.refreshUser();
    if (next) setUser(next);
    return next?.emailVerified !== false;
  }, []);

  const discardAccount = useCallback(async () => {
    await backend.discardAccount();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await backend.sendPasswordReset(email);
  }, []);

  const signOut = useCallback(async () => {
    await backend.signOut();
  }, []);

  const saveProfile = useCallback(
    async (next: Profile) => {
      if (!user) return;
      await backend.saveProfile(user, next);
      setProfile(next);
    },
    [user]
  );

  const updateName = useCallback(
    async (name: string) => {
      if (!user) return;
      await backend.updateDisplayName(user, name);
      setUser({ ...user, displayName: name });
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      profile,
      demo: backend.demo,
      signInWithEmail,
      signInWithGoogle,
      signUpWithEmail,
      resendVerification,
      refreshUser,
      discardAccount,
      sendPasswordReset,
      signOut,
      saveProfile,
      updateName,
    }),
    [
      ready,
      user,
      profile,
      signInWithEmail,
      signInWithGoogle,
      signUpWithEmail,
      resendVerification,
      refreshUser,
      discardAccount,
      sendPasswordReset,
      signOut,
      saveProfile,
      updateName,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans <AuthProvider>.");
  return context;
}

/** Où envoyer l'étudiant selon son état : connexion, vérification de l'e-mail, onboarding ou accueil. */
export function destinationFor(user: AppUser | null, profile: Profile | null): string {
  if (!user) return "/connexion";
  if (user.emailVerified === false) return "/verification-email";
  if (!profile) return "/onboarding";
  return "/accueil";
}

/**
 * Garde des écrans de l'application : renvoie l'étudiant vers la connexion, la vérification de l'e-mail
 * ou l'onboarding s'il n'est pas prêt. `ok` n'est vrai que lorsque l'écran peut s'afficher.
 */
export function useRequireStudent(): { ok: boolean; user: AppUser | null; profile: Profile | null } {
  const router = useRouter();
  const { ready, user, profile } = useAuth();
  const target = ready ? (user && profile && user.emailVerified !== false ? null : destinationFor(user, profile)) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  return { ok: ready && target === null && Boolean(user && profile), user, profile };
}
