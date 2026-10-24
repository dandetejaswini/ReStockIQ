import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import localConfig from '../../firebase-applet-config.json';

// Helper to resolve public Firebase configuration from NEXT_PUBLIC_FIREBASE_* or VITE_FIREBASE_* env vars
function resolveFirebaseEnv(nextKey: string, viteKey: string, fallback: string): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env[nextKey] || import.meta.env[viteKey];
    if (val && typeof val === 'string' && val.trim().length > 0 && !val.includes('your_firebase_')) {
      return val.trim();
    }
  }
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[nextKey] || process.env[viteKey];
    if (val && typeof val === 'string' && val.trim().length > 0 && !val.includes('your_firebase_')) {
      return val.trim();
    }
  }
  return fallback;
}

// Configuration resolution with NEXT_PUBLIC_FIREBASE_* priority and provisioned firebase-applet-config.json fallback
export const firebaseConfig = {
  apiKey: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY', localConfig.apiKey),
  authDomain: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN', localConfig.authDomain),
  projectId: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID', localConfig.projectId),
  storageBucket: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET', localConfig.storageBucket),
  messagingSenderId: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', localConfig.messagingSenderId),
  appId: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID', localConfig.appId),
  firestoreDatabaseId: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID', 'VITE_FIREBASE_FIRESTORE_DATABASE_ID', localConfig.firestoreDatabaseId),
};

export const ACTIVE_FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const ACTIVE_FIREBASE_PROJECT_NUMBER = firebaseConfig.messagingSenderId;

// Singleton App Initialization (safe across hot reloads)
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Auth instance & Google Provider
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Firestore instance with designated database ID
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// ====================================================================
// FIRESTORE HARDENED ERROR HANDLING (Per Firebase Skill Specification)
// ====================================================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Security / Operation Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connectivity sanity test
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

if (typeof window !== 'undefined') {
  testFirestoreConnection().catch(() => {});
}

export default app;
