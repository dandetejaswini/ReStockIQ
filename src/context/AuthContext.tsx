import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
   getAdditionalUserInfo,
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { 
  UserProfile, 
  getUserProfile, 
  syncUserProfileOnLogin, 
  completeStoreOnboarding 
} from '../services/userProfileService';
import { syncFirebaseWorkspaceAndWelcomeEmail } from '../services/emailAutomationService';

export interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  authError: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<{ success: boolean; profile?: UserProfile; needsOnboarding?: boolean; error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, fullName: string, storeName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  submitOnboarding: (storeName: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function formatAuthError(error: any): string {
  const code = error?.code || '';
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
      return 'Network connection failed. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Access temporarily disabled due to too many failed attempts. Please try again later.';
    default:
      return error?.message || 'Authentication error. Please try again.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const isGooglePopupInFlight = useRef<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          if (profile) {
            setUserProfile(profile);
            await syncFirebaseWorkspaceAndWelcomeEmail(currentUser, {
              fullName: profile.displayName,
              storeName: profile.storeName || undefined,
              isSignup: false,
            });
          } else {
            // First time or unsynced profile
            const synced = await syncUserProfileOnLogin(currentUser);
            setUserProfile(synced);
            await syncFirebaseWorkspaceAndWelcomeEmail(currentUser, {
              fullName: synced.displayName,
              storeName: synced.storeName || undefined,
              isSignup: false,
            });
          }
        } catch (err) {
          console.error('Failed to load user profile from Firestore:', err);
        }
      } else {
        setUserProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearError = () => setAuthError(null);

  const signInWithGoogle = async (): Promise<{ 
    success: boolean; 
    profile?: UserProfile; 
    needsOnboarding?: boolean; 
    error?: string 
  }> => {
    if (isGooglePopupInFlight.current) {
      return { success: false, error: 'A Google sign-in request is already in progress.' };
    }
    isGooglePopupInFlight.current = true;
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const additionalInfo = getAdditionalUserInfo(result);
      const existingProfile = await getUserProfile(user.uid);
      const isNewGoogleRegistration = Boolean(additionalInfo?.isNewUser || !existingProfile);

      const profile = await syncUserProfileOnLogin(user);
      await syncFirebaseWorkspaceAndWelcomeEmail(user, {
        fullName: profile.displayName,
        storeName: profile.storeName || undefined,
        isSignup: isNewGoogleRegistration,
        force: true,
      });

      setUserProfile(profile);
      setIsLoading(false);
      isGooglePopupInFlight.current = false;

      const needsOnboarding = !profile.onboardingCompleted || !profile.storeName;
      return { success: true, profile, needsOnboarding };
    } catch (err: any) {
      setIsLoading(false);
      isGooglePopupInFlight.current = false;
      const friendlyMsg = formatAuthError(err);
      setAuthError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const profile = await syncUserProfileOnLogin(result.user);
      await syncFirebaseWorkspaceAndWelcomeEmail(result.user, {
        fullName: profile.displayName,
        storeName: profile.storeName || undefined,
        isSignup: false,
      });
      setUserProfile(profile);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
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
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (fullName) {
        await updateProfile(result.user, { displayName: fullName });
      }

      const resolvedStoreName = storeName || 'Main Store Branch';
      const profile = await syncUserProfileOnLogin(result.user, {
        storeName: resolvedStoreName,
        onboardingCompleted: true,
      });

      await syncFirebaseWorkspaceAndWelcomeEmail(result.user, {
        fullName: fullName || profile.displayName,
        storeName: resolvedStoreName,
        isSignup: true,
        force: true,
      });

      setUserProfile(profile);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
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
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const submitOnboarding = async (storeName: string): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser) return { success: false, error: 'No active session' };
    try {
      await completeStoreOnboarding(firebaseUser.uid, storeName);
      await syncFirebaseWorkspaceAndWelcomeEmail(firebaseUser, {
        fullName: userProfile?.displayName || firebaseUser.displayName || undefined,
        storeName,
        isSignup: false,
        force: true,
      });
      setUserProfile(prev => prev ? { ...prev, storeName, onboardingCompleted: true } : null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to complete store onboarding' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        isLoading,
        authError,
        clearError,
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
