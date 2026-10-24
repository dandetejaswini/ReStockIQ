import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  auth,
  ensureFirestoreOnline,
  googleProvider,
  isFirestoreOfflineError,
  isFirestorePermissionError,
  sanitizeUserFacingError,
} from '../lib/firebase';
import {
  UserProfile,
  buildFallbackUserProfile,
  getUserProfile,
  setCachedUserProfile,
  syncUserProfileOnLogin,
  completeStoreOnboarding,
} from '../services/userProfileService';
import { syncFirebaseWorkspaceAndWelcomeEmail } from '../services/emailAutomationService';

export interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  authError: string | null;
  workspaceError: string | null;
  clearError: () => void;
  retryWorkspaceLoad: () => Promise<{ success: boolean; profile?: UserProfile; error?: string }>;
  signInWithGoogle: () => Promise<{
    success: boolean;
    profile?: UserProfile;
    needsOnboarding?: boolean;
    error?: string;
  }>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string,
    storeName: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  submitOnboarding: (storeName: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function formatAuthError(error: any): string {
  const code = String(error?.code || '');
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled. The Google sign-in window was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Sign-in popup blocked. Please allow popups in your browser settings to continue with Google.';
    case 'auth/cancelled-popup-request':
      return 'A Google sign-in popup is already open. Please complete or close the existing popup.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address under a different sign-in provider. Please sign in with your original method.';
    case 'auth/unauthorized-domain':
      return 'This domain is not yet authorized in Firebase Console for project stockpilotai-2dcae. Please add it under Authentication > Settings > Authorized domains.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/network-request-failed':
      return "We couldn't load your workspace. Check your connection and try again.";
    case 'auth/too-many-requests':
      return 'Access temporarily disabled due to too many failed attempts. Please try again later.';
    default:
      if (isFirestoreOfflineError(error)) {
        return "We couldn't load your workspace. Check your connection and try again.";
      }
      if (isFirestorePermissionError(error)) {
        return 'Your account was authenticated, but workspace profile permissions could not be verified. Please try again.';
      }
      return sanitizeUserFacingError(error, 'Authentication error. Please try again.');
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const isGooglePopupInFlight = useRef<boolean>(false);
  const isExplicitAuthFlowRef = useRef<boolean>(false);
  const inFlightWorkspaceSyncRef = useRef<{ uid: string; promise: Promise<UserProfile> } | null>(null);

  const initializeUserWorkspace = async (
    user: FirebaseUser,
    options?: {
      fullName?: string;
      storeName?: string;
      onboardingCompleted?: boolean;
      isSignup?: boolean;
      force?: boolean;
    }
  ): Promise<UserProfile> => {
    // Reuse in-flight initialization for the same user unless explicitly forced with new overrides
    if (
      !options?.force &&
      !options?.storeName &&
      inFlightWorkspaceSyncRef.current &&
      inFlightWorkspaceSyncRef.current.uid === user.uid
    ) {
      return inFlightWorkspaceSyncRef.current.promise;
    }

    const syncTask = (async (): Promise<UserProfile> => {
      setWorkspaceError(null);

      // Ensure auth token is available before Firestore / API calls
      try {
        await user.getIdToken();
      } catch {
        // Proceed with cached auth state if offline
      }

      let existingProfile: UserProfile | null = null;
      try {
        existingProfile = await getUserProfile(user.uid, { allowOfflineFallback: true });
      } catch (readErr) {
        if (isFirestoreOfflineError(readErr)) {
          setWorkspaceError("We couldn't load your workspace. Check your connection and try again.");
        }
      }

      const isNewAccount = Boolean(options?.isSignup || !existingProfile);
      const candidateStoreName = options?.storeName || existingProfile?.storeName || undefined;
      const candidateFullName =
        options?.fullName ||
        existingProfile?.displayName ||
        user.displayName ||
        user.email?.split('@')[0] ||
        'Store Procurement Lead';

      // Sync canonical Supabase workspace & welcome email
      const wsRes = await syncFirebaseWorkspaceAndWelcomeEmail(user, {
        fullName: candidateFullName,
        storeName: candidateStoreName,
        isSignup: isNewAccount,
        ensureWelcomeEmail: isNewAccount,
        force: options?.force,
      });

      // Reconcile storeName from canonical Supabase workspace if Firestore profile didn't have it yet
      const supabaseOrgName = wsRes.workspace?.organization_name?.trim() || '';
      const hasCustomSupabaseStore =
        Boolean(supabaseOrgName) &&
        !supabaseOrgName.endsWith("'s Store") &&
        supabaseOrgName.toLowerCase() !== 'default store';

      const resolvedStoreName =
        options?.storeName ||
        existingProfile?.storeName ||
        (hasCustomSupabaseStore ? supabaseOrgName : '');

      const resolvedOnboarding =
        typeof options?.onboardingCompleted === 'boolean'
          ? options.onboardingCompleted
          : Boolean(existingProfile?.onboardingCompleted && existingProfile?.storeName) ||
            Boolean(resolvedStoreName);

      try {
        const syncedProfile = await syncUserProfileOnLogin(user, {
          storeName: resolvedStoreName || undefined,
          onboardingCompleted: resolvedOnboarding,
          existingProfile,
          allowOfflineFallback: true,
        });
        setUserProfile(syncedProfile);
        return syncedProfile;
      } catch (writeErr) {
        console.warn('Firestore profile sync warning, using authenticated fallback profile:', writeErr);
        if (isFirestoreOfflineError(writeErr)) {
          setWorkspaceError("We couldn't load your workspace. Check your connection and try again.");
        }
        const fallbackProfile = buildFallbackUserProfile(user, {
          storeName: resolvedStoreName,
          onboardingCompleted: resolvedOnboarding,
        });
        setUserProfile(fallbackProfile);
        return fallbackProfile;
      }
    })();

    inFlightWorkspaceSyncRef.current = { uid: user.uid, promise: syncTask };
    try {
      return await syncTask;
    } finally {
      if (inFlightWorkspaceSyncRef.current?.promise === syncTask) {
        inFlightWorkspaceSyncRef.current = null;
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // If an explicit login/signup method is actively handling initialization, wait for it
        if (isExplicitAuthFlowRef.current) {
          setFirebaseUser(currentUser);
          return;
        }
        try {
          await initializeUserWorkspace(currentUser, { isSignup: false });
        } catch (err) {
          console.error('Failed to initialize user profile on session restore:', err);
          const fallback = buildFallbackUserProfile(currentUser);
          setUserProfile(fallback);
        }
        setFirebaseUser(currentUser);
      } else {
        setFirebaseUser(null);
        setUserProfile(null);
        setWorkspaceError(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearError = () => {
    setAuthError(null);
    setWorkspaceError(null);
  };

  const retryWorkspaceLoad = async (): Promise<{
    success: boolean;
    profile?: UserProfile;
    error?: string;
  }> => {
    const activeUser = auth.currentUser || firebaseUser;
    if (!activeUser) {
      return {
        success: false,
        error: 'No authenticated user session found. Please sign in again.',
      };
    }

    setIsLoading(true);
    setAuthError(null);
    setWorkspaceError(null);

    try {
      await ensureFirestoreOnline();
      const profile = await initializeUserWorkspace(activeUser, { force: true });
      setUserProfile(profile);
      setIsLoading(false);
      return { success: true, profile };
    } catch (err: any) {
      setIsLoading(false);
      const friendlyMsg = formatAuthError(err);
      setWorkspaceError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const signInWithGoogle = async (): Promise<{
    success: boolean;
    profile?: UserProfile;
    needsOnboarding?: boolean;
    error?: string;
  }> => {
    if (isGooglePopupInFlight.current) {
      return { success: false, error: 'A Google sign-in request is already in progress.' };
    }
    isGooglePopupInFlight.current = true;
    isExplicitAuthFlowRef.current = true;
    setIsLoading(true);
    setAuthError(null);
    setWorkspaceError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const additionalInfo = getAdditionalUserInfo(result);
      const isNewGoogleUser = Boolean(additionalInfo?.isNewUser);

      const profile = await initializeUserWorkspace(user, {
        isSignup: isNewGoogleUser,
        force: true,
      });

      setFirebaseUser(user);
      setUserProfile(profile);
      setIsLoading(false);
      isGooglePopupInFlight.current = false;
      isExplicitAuthFlowRef.current = false;

      const needsOnboarding = !profile.onboardingCompleted || !profile.storeName;
      return { success: true, profile, needsOnboarding };
    } catch (err: any) {
      // If Firebase Auth itself succeeded (auth.currentUser exists) and only a post-login step threw,
      // preserve the authenticated session and use the fallback profile rather than failing Google Sign-In.
      const authenticatedUser = auth.currentUser;
      if (authenticatedUser && !String(err?.code || '').startsWith('auth/')) {
        const fallbackProfile = buildFallbackUserProfile(authenticatedUser);
        setFirebaseUser(authenticatedUser);
        setUserProfile(fallbackProfile);
        setIsLoading(false);
        isGooglePopupInFlight.current = false;
        isExplicitAuthFlowRef.current = false;
        if (isFirestoreOfflineError(err)) {
          setWorkspaceError("We couldn't load your workspace. Check your connection and try again.");
        }
        const needsOnboarding = !fallbackProfile.onboardingCompleted || !fallbackProfile.storeName;
        return { success: true, profile: fallbackProfile, needsOnboarding };
      }

      setIsLoading(false);
      isGooglePopupInFlight.current = false;
      isExplicitAuthFlowRef.current = false;
      const friendlyMsg = formatAuthError(err);
      setAuthError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    isExplicitAuthFlowRef.current = true;
    setIsLoading(true);
    setAuthError(null);
    setWorkspaceError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const profile = await initializeUserWorkspace(result.user, {
        isSignup: false,
        force: true,
      });
      setFirebaseUser(result.user);
      setUserProfile(profile);
      setIsLoading(false);
      isExplicitAuthFlowRef.current = false;
      return { success: true };
    } catch (err: any) {
      const authenticatedUser = auth.currentUser;
      if (authenticatedUser && !String(err?.code || '').startsWith('auth/')) {
        const fallbackProfile = buildFallbackUserProfile(authenticatedUser);
        setFirebaseUser(authenticatedUser);
        setUserProfile(fallbackProfile);
        setIsLoading(false);
        isExplicitAuthFlowRef.current = false;
        return { success: true };
      }

      setIsLoading(false);
      isExplicitAuthFlowRef.current = false;
      const friendlyMsg = formatAuthError(err);
      setAuthError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    storeName: string
  ): Promise<{ success: boolean; error?: string }> => {
    isExplicitAuthFlowRef.current = true;
    setIsLoading(true);
    setAuthError(null);
    setWorkspaceError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (fullName) {
        await updateProfile(result.user, { displayName: fullName }).catch(() => {});
      }

      const resolvedStoreName = storeName || 'Main Store Branch';
      const profile = await initializeUserWorkspace(result.user, {
        fullName,
        storeName: resolvedStoreName,
        onboardingCompleted: true,
        isSignup: true,
        force: true,
      });

      setFirebaseUser(result.user);
      setUserProfile(profile);
      setIsLoading(false);
      isExplicitAuthFlowRef.current = false;
      return { success: true };
    } catch (err: any) {
      const authenticatedUser = auth.currentUser;
      if (authenticatedUser && !String(err?.code || '').startsWith('auth/')) {
        const fallbackProfile = buildFallbackUserProfile(authenticatedUser, {
          storeName: storeName || 'Main Store Branch',
          onboardingCompleted: true,
        });
        setFirebaseUser(authenticatedUser);
        setUserProfile(fallbackProfile);
        setIsLoading(false);
        isExplicitAuthFlowRef.current = false;
        return { success: true };
      }

      setIsLoading(false);
      isExplicitAuthFlowRef.current = false;
      const friendlyMsg = formatAuthError(err);
      setAuthError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setUserProfile(null);
      setAuthError(null);
      setWorkspaceError(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const submitOnboarding = async (
    storeName: string
  ): Promise<{ success: boolean; error?: string }> => {
    const activeUser = firebaseUser || auth.currentUser;
    if (!activeUser) return { success: false, error: 'No active session' };
    const cleanStoreName = storeName.trim();
    try {
      await completeStoreOnboarding(activeUser.uid, cleanStoreName, activeUser);
      await syncFirebaseWorkspaceAndWelcomeEmail(activeUser, {
        fullName: userProfile?.displayName || activeUser.displayName || undefined,
        storeName: cleanStoreName,
        isSignup: false,
        ensureWelcomeEmail: true,
        force: true,
      });
      setUserProfile(prev => {
        const updated: UserProfile = prev
          ? { ...prev, storeName: cleanStoreName, onboardingCompleted: true }
          : buildFallbackUserProfile(activeUser, {
              storeName: cleanStoreName,
              onboardingCompleted: true,
            });
        setCachedUserProfile(updated);
        return updated;
      });
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: formatAuthError(err) || 'Failed to complete store onboarding',
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        isLoading,
        authError,
        workspaceError,
        clearError,
        retryWorkspaceLoad,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
        submitOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
