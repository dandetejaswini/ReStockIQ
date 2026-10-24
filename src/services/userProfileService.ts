import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

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

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${uid}`);
  }
}

export async function syncUserProfileOnLogin(
  firebaseUser: FirebaseUser,
  additionalData?: { storeName?: string; onboardingCompleted?: boolean }
): Promise<UserProfile> {
  const docRef = doc(db, COLLECTION_NAME, firebaseUser.uid);
  const path = `${COLLECTION_NAME}/${firebaseUser.uid}`;

  try {
    const existingSnap = await getDoc(docRef);
    const providerId = firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google.com' : 'password';

    if (existingSnap.exists()) {
      const existing = existingSnap.data() as UserProfile;
      const updates: Partial<UserProfile> = {
        // Preserve existing profile fields; only fill in missing displayName or photoURL
        displayName: existing.displayName || firebaseUser.displayName || 'Store Procurement Manager',
        photoURL: existing.photoURL || firebaseUser.photoURL || '',
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Only set storeName if not already configured or explicitly completing onboarding
      if (additionalData?.storeName && !existing.storeName) {
        updates.storeName = additionalData.storeName;
      }
      if (typeof additionalData?.onboardingCompleted === 'boolean' && !existing.onboardingCompleted) {
        updates.onboardingCompleted = additionalData.onboardingCompleted;
      }

      await updateDoc(docRef, updates);
      return {
        ...existing,
        ...updates,
      };
    } else {
      // First-time registration
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Store Procurement Lead',
        photoURL: firebaseUser.photoURL || '',
        provider: providerId,
        storeName: additionalData?.storeName || '',
        onboardingCompleted: additionalData?.onboardingCompleted ?? (additionalData?.storeName ? true : false),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };

      await setDoc(docRef, newProfile);
      return newProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function completeStoreOnboarding(
  uid: string,
  storeName: string
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const path = `${COLLECTION_NAME}/${uid}`;

  try {
    await updateDoc(docRef, {
      storeName,
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
