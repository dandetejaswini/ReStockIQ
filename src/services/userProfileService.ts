import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import {
  auth,
  db,
  ensureFirestoreOnline,
  handleFirestoreError,
  isFirestoreOfflineError,
  OperationType,
} from '../lib/firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  provider: 'google.com' | 'password' | 'custom';
  storeName: string;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
  lastLoginAt?: Timestamp | any;
  onboardingCompleted: boolean;
}

const COLLECTION_NAME = 'users';
const PROFILE_CACHE_PREFIX = 'restockiq_user_profile_';

function getProfileCacheKey(uid: string): string {
  return `${PROFILE_CACHE_PREFIX}${uid}`;
}

export function getCachedUserProfile(uid: string): UserProfile | null {
  if (!uid || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getProfileCacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed && parsed.uid === uid) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

export function setCachedUserProfile(profile: UserProfile): void {
  if (!profile?.uid || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const serializable: UserProfile = {
      uid: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      provider: profile.provider,
      storeName: profile.storeName || '',
      onboardingCompleted: Boolean(profile.onboardingCompleted && profile.storeName),
    };
    window.localStorage.setItem(getProfileCacheKey(profile.uid), JSON.stringify(serializable));
  } catch {
    // Ignore storage quota / privacy errors
  }
}

export function buildFallbackUserProfile(
  firebaseUser: FirebaseUser,
  additionalData?: { storeName?: string; onboardingCompleted?: boolean }
): UserProfile {
  const cached = getCachedUserProfile(firebaseUser.uid);
  const providerId: 'google.com' | 'password' =
    firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google.com' : 'password';

  const resolvedStoreName = (
    additionalData?.storeName ||
    cached?.storeName ||
    ''
  )
    .trim()
    .slice(0, 150);

  const resolvedDisplayName = (
    cached?.displayName ||
    firebaseUser.displayName ||
    firebaseUser.email?.split('@')[0] ||
    'Store Procurement Lead'
  )
    .trim()
    .slice(0, 120);

  const resolvedOnboarding =
    typeof additionalData?.onboardingCompleted === 'boolean'
      ? additionalData.onboardingCompleted
      : Boolean(cached?.onboardingCompleted && resolvedStoreName) || Boolean(resolvedStoreName);

  const fallback: UserProfile = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || cached?.email || '',
    displayName: resolvedDisplayName || 'Store Procurement Lead',
    photoURL: (firebaseUser.photoURL || cached?.photoURL || '').slice(0, 2000),
    provider: providerId,
    storeName: resolvedStoreName,
    onboardingCompleted: resolvedOnboarding,
  };

  setCachedUserProfile(fallback);
  return fallback;
}

async function withFirestoreRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      await ensureFirestoreOnline();
      await new Promise(resolve => setTimeout(resolve, 250));
      return await operation();
    }
    throw error;
  }
}

export async function getUserProfile(
  uid: string,
  options?: { allowOfflineFallback?: boolean }
): Promise<UserProfile | null> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const path = `${COLLECTION_NAME}/${uid}`;

  try {
    const docSnap = await withFirestoreRetry(() => getDoc(docRef));
    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      setCachedUserProfile(data);
      return data;
    }
    return null;
  } catch (error) {
    if (options?.allowOfflineFallback && isFirestoreOfflineError(error)) {
      const cached = getCachedUserProfile(uid);
      if (cached) {
        return cached;
      }
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function syncUserProfileOnLogin(
  firebaseUser: FirebaseUser,
  additionalData?: {
    storeName?: string;
    onboardingCompleted?: boolean;
    existingProfile?: UserProfile | null;
    allowOfflineFallback?: boolean;
  }
): Promise<UserProfile> {
  const docRef = doc(db, COLLECTION_NAME, firebaseUser.uid);
  const path = `${COLLECTION_NAME}/${firebaseUser.uid}`;
  const providerId: 'google.com' | 'password' =
    firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google.com' : 'password';

  try {
    let existing: UserProfile | null =
      additionalData?.existingProfile !== undefined ? additionalData.existingProfile : null;

    if (!existing) {
      const existingSnap = await withFirestoreRetry(() => getDoc(docRef));
      if (existingSnap.exists()) {
        existing = existingSnap.data() as UserProfile;
      }
    }

    if (existing) {
      const nextDisplayName = (
        existing.displayName ||
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'Store Procurement Manager'
      )
        .trim()
        .slice(0, 120);

      const nextPhotoURL = (existing.photoURL || firebaseUser.photoURL || '').slice(0, 2000);
      const nextStoreName = (existing.storeName || additionalData?.storeName || '')
        .trim()
        .slice(0, 150);
      const nextOnboardingCompleted =
        Boolean(existing.onboardingCompleted && existing.storeName) ||
        Boolean(additionalData?.onboardingCompleted) ||
        Boolean(nextStoreName);

      // Conform strictly to firestore.rules allowed update keys:
      // ['displayName', 'photoURL', 'storeName', 'onboardingCompleted', 'updatedAt', 'lastLoginAt', 'provider']
      const updates: Record<string, any> = {
        displayName: nextDisplayName,
        photoURL: nextPhotoURL,
        provider: providerId,
        storeName: nextStoreName,
        onboardingCompleted: nextOnboardingCompleted,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await withFirestoreRetry(() => updateDoc(docRef, updates));

      const merged: UserProfile = {
        ...existing,
        displayName: nextDisplayName,
        photoURL: nextPhotoURL,
        provider: providerId,
        storeName: nextStoreName,
        onboardingCompleted: nextOnboardingCompleted,
      };
      setCachedUserProfile(merged);
      return merged;
    } else {
      const cached = getCachedUserProfile(firebaseUser.uid);
      const resolvedStoreName = (additionalData?.storeName || cached?.storeName || '')
        .trim()
        .slice(0, 150);
      const resolvedDisplayName = (
        firebaseUser.displayName ||
        cached?.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'Store Procurement Lead'
      )
        .trim()
        .slice(0, 120);
      const resolvedOnboarding =
        additionalData?.onboardingCompleted ?? Boolean(resolvedStoreName);

      // First-time registration — conform strictly to firestore.rules create requirements
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: resolvedDisplayName || 'Store Procurement Lead',
        photoURL: (firebaseUser.photoURL || '').slice(0, 2000),
        provider: providerId,
        storeName: resolvedStoreName,
        onboardingCompleted: resolvedOnboarding,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };

      await withFirestoreRetry(() => setDoc(docRef, newProfile));
      setCachedUserProfile(newProfile);
      return newProfile;
    }
  } catch (error) {
    if (additionalData?.allowOfflineFallback !== false && isFirestoreOfflineError(error)) {
      console.warn(
        `[ReStockIQ] Firestore temporarily offline during profile sync for ${path}; using verified auth + workspace fallback.`
      );
      return buildFallbackUserProfile(firebaseUser, additionalData);
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function completeStoreOnboarding(
  uid: string,
  storeName: string,
  firebaseUser?: FirebaseUser | null
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const path = `${COLLECTION_NAME}/${uid}`;
  const cleanStoreName = storeName.trim().slice(0, 150);
  const currentUser = firebaseUser || auth.currentUser;

  // Update local cache immediately so session state stays consistent
  const cached = getCachedUserProfile(uid);
  if (cached) {
    setCachedUserProfile({
      ...cached,
      storeName: cleanStoreName,
      onboardingCompleted: true,
    });
  } else if (currentUser && currentUser.uid === uid) {
    buildFallbackUserProfile(currentUser, {
      storeName: cleanStoreName,
      onboardingCompleted: true,
    });
  }

  try {
    const existingSnap = await withFirestoreRetry(() => getDoc(docRef));
    if (existingSnap.exists()) {
      await withFirestoreRetry(() =>
        updateDoc(docRef, {
          storeName: cleanStoreName,
          onboardingCompleted: true,
          updatedAt: serverTimestamp(),
        })
      );
    } else if (currentUser && currentUser.uid === uid) {
      const providerId: 'google.com' | 'password' =
        currentUser.providerData[0]?.providerId === 'google.com' ? 'google.com' : 'password';
      const newProfile: UserProfile = {
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName: (
          currentUser.displayName ||
          currentUser.email?.split('@')[0] ||
          'Store Procurement Lead'
        )
          .trim()
          .slice(0, 120),
        photoURL: (currentUser.photoURL || '').slice(0, 2000),
        provider: providerId,
        storeName: cleanStoreName,
        onboardingCompleted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };
      await withFirestoreRetry(() => setDoc(docRef, newProfile));
      setCachedUserProfile(newProfile);
    } else {
      await withFirestoreRetry(() =>
        updateDoc(docRef, {
          storeName: cleanStoreName,
          onboardingCompleted: true,
          updatedAt: serverTimestamp(),
        })
      );
    }
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      console.warn(
        `[ReStockIQ] Firestore offline during store onboarding update for ${path}; storeName cached and synced via workspace API.`
      );
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
