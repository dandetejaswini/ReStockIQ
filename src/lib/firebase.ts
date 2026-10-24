import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  Firestore,
  doc,
  getDocFromServer,
  enableNetwork,
} from 'firebase/firestore';
import localConfig from '../../firebase-applet-config.json';

function isPlaceholderValue(val: string): boolean {
  const normalized = val.trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'undefined' ||
    normalized === 'null' ||
    normalized.includes('your_firebase_') ||
    normalized.includes('your_firestore_') ||
    normalized.includes('<your_') ||
    normalized.includes('placeholder')
  );
}

// Helper to resolve public Firebase configuration from NEXT_PUBLIC_FIREBASE_* or VITE_FIREBASE_* env vars
export function resolveFirebaseEnv(nextKey: string, viteKey: string, fallback: string): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env[nextKey] || import.meta.env[viteKey];
    if (val && typeof val === 'string' && !isPlaceholderValue(val)) {
      return val.trim();
    }
  }
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[nextKey] || process.env[viteKey];
    if (val && typeof val === 'string' && !isPlaceholderValue(val)) {
      return val.trim();
    }
  }
  return fallback;
}

const resolvedProjectId = resolveFirebaseEnv(
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_PROJECT_ID',
  localConfig.projectId
);

export function resolveFirestoreDatabaseId(projectId: string, envDatabaseId?: string): string {
  const rawCandidate =
    envDatabaseId !== undefined
      ? envDatabaseId
      : resolveFirebaseEnv(
          'NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID',
          'VITE_FIREBASE_FIRESTORE_DATABASE_ID',
          localConfig.firestoreDatabaseId
        );

  const trimmed = (rawCandidate || '').trim();
  const isDefaultAlias =
    !trimmed ||
    trimmed.toLowerCase() === '(default)' ||
    trimmed.toLowerCase() === 'default' ||
    isPlaceholderValue(trimmed);

  // Project stockpilotai-2dcae uses a named Enterprise Firestore database rather than (default).
  // Prevent accidental fallback to a non-existent (default) database when Vercel env vars omit or set (default).
  if (projectId === localConfig.projectId && isDefaultAlias) {
    return localConfig.firestoreDatabaseId;
  }

  return isDefaultAlias ? localConfig.firestoreDatabaseId : trimmed;
}

// Configuration resolution with NEXT_PUBLIC_FIREBASE_* priority and provisioned firebase-applet-config.json fallback
export const firebaseConfig = {
  apiKey: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY', localConfig.apiKey),
  authDomain: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN', localConfig.authDomain),
  projectId: resolvedProjectId,
  storageBucket: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET', localConfig.storageBucket),
  messagingSenderId: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', localConfig.messagingSenderId),
  appId: resolveFirebaseEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID', localConfig.appId),
  firestoreDatabaseId: resolveFirestoreDatabaseId(resolvedProjectId),
};

export const ACTIVE_FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const ACTIVE_FIREBASE_PROJECT_NUMBER = firebaseConfig.messagingSenderId;
export const ACTIVE_FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

// Singleton App Initialization (safe across hot reloads)
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Auth instance & Google Provider
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with named database ID and automatic long-polling fallback
// so browser privacy extensions, corporate proxies, or OAuth popup transitions do not stall WebChannel streams.
function createFirestoreInstance(firebaseApp: FirebaseApp, databaseId?: string): Firestore {
  try {
    return databaseId
      ? initializeFirestore(
          firebaseApp,
          { experimentalAutoDetectLongPolling: true },
          databaseId
        )
      : initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true });
  } catch {
    return databaseId ? getFirestore(firebaseApp, databaseId) : getFirestore(firebaseApp);
  }
}

export const db: Firestore = createFirestoreInstance(app, firebaseConfig.firestoreDatabaseId);

// ====================================================================
// FIRESTORE HARDENED ERROR HANDLING & CLASSIFICATION
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
  code?: string;
  operationType: OperationType;
  path: string | null;
  databaseId?: string;
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

export class FirestoreOperationError extends Error {
  public readonly code: string;
  public readonly operationType: OperationType;
  public readonly path: string | null;
  public readonly isOfflineError: boolean;
  public readonly isPermissionError: boolean;
  public readonly userFriendlyMessage: string;
  public readonly details: FirestoreErrorInfo;

  constructor(details: FirestoreErrorInfo, code: string, isOfflineError: boolean, isPermissionError: boolean, userFriendlyMessage: string) {
    super(userFriendlyMessage);
    this.name = 'FirestoreOperationError';
    this.code = code;
    this.operationType = details.operationType;
    this.path = details.path;
    this.isOfflineError = isOfflineError;
    this.isPermissionError = isPermissionError;
    this.userFriendlyMessage = userFriendlyMessage;
    this.details = details;
  }
}

export function isFirestoreOfflineError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof FirestoreOperationError) {
    return error.isOfflineError;
  }
  const code = String((error as any)?.code || '').toLowerCase();
  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'firestore/unavailable' ||
    message.includes('client is offline') ||
    message.includes('failed to get document because the client is offline') ||
    message.includes('network error') ||
    message.includes('unavailable')
  );
}

export function isFirestorePermissionError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof FirestoreOperationError) {
    return error.isPermissionError;
  }
  const code = String((error as any)?.code || '').toLowerCase();
  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied' ||
    message.includes('missing or insufficient permissions') ||
    message.includes('permission_denied')
  );
}

export function sanitizeUserFacingError(
  error: unknown,
  fallbackMessage = "We couldn't load your workspace. Check your connection and try again."
): string {
  if (!error) return fallbackMessage;

  if (error instanceof FirestoreOperationError) {
    return error.userFriendlyMessage;
  }

  const rawMessage = typeof error === 'string' ? error : String((error as any)?.message || '');
  const trimmed = rawMessage.trim();

  // Never leak raw JSON diagnostic payloads (such as FirestoreErrorInfo) to end users
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const innerError = String(parsed?.error || '').toLowerCase();
      if (innerError.includes('client is offline') || innerError.includes('unavailable')) {
        return "We couldn't load your workspace. Check your connection and try again.";
      }
      if (innerError.includes('insufficient permissions') || innerError.includes('permission-denied')) {
        return 'Your account was authenticated, but workspace profile permissions could not be verified. Please try again.';
      }
      return fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  if (isFirestoreOfflineError(error)) {
    return "We couldn't load your workspace. Check your connection and try again.";
  }

  if (isFirestorePermissionError(error)) {
    return 'Your account was authenticated, but workspace profile permissions could not be verified. Please try again.';
  }

  return trimmed || fallbackMessage;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const rawCode = String((error as any)?.code || 'firestore/operation-failed');
  const offline = isFirestoreOfflineError(error);
  const permissionDenied = isFirestorePermissionError(error);

  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
    code: rawCode,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
    databaseId: firebaseConfig.firestoreDatabaseId,
  };

  console.error('Firestore Security / Operation Error: ', JSON.stringify(errInfo));

  const userFriendlyMessage = offline
    ? "We couldn't load your workspace. Check your connection and try again."
    : permissionDenied
    ? 'Your account was authenticated, but workspace profile permissions could not be verified. Please try again.'
    : "We couldn't load your workspace. Check your connection and try again.";

  throw new FirestoreOperationError(
    errInfo,
    rawCode,
    offline,
    permissionDenied,
    userFriendlyMessage
  );
}

export async function ensureFirestoreOnline(): Promise<void> {
  try {
    await enableNetwork(db);
  } catch {
    // Ignore if already online or in an environment where enableNetwork is a no-op
  }
}

// On-demand connectivity diagnostic helper
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await ensureFirestoreOnline();
    if (auth.currentUser) {
      await getDocFromServer(doc(db, 'users', auth.currentUser.uid));
    }
    return true;
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      console.warn('Firestore connection check reported offline state. Verify database ID and network.');
      return false;
    }
    return true;
  }
}

export default app;
