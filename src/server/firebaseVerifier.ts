import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface VerifiedFirebaseToken {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
  signInProvider: string;
  iat: number;
  exp: number;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let certsExpiresAt = 0;

function getFirebaseProjectId(): string {
  const envProjectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;
  if (envProjectId && envProjectId.trim()) {
    return envProjectId.trim();
  }

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed?.projectId) {
        return String(parsed.projectId).trim();
      }
    }
  } catch {
    // Fallback to known project ID
  }

  return 'stockpilotai-2dcae';
}

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && now < certsExpiresAt) {
    return cachedCerts;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google SecureToken public certificates (HTTP ${res.status})`);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  const certs = (await res.json()) as Record<string, string>;
  cachedCerts = certs;
  certsExpiresAt = now + maxAgeSeconds * 1000;
  return certs;
}

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Firebase ID token');
  }

  const cleanToken = idToken.replace(/^Bearer\s+/i, '').trim();
  const segments = cleanToken.split('.');
  if (segments.length !== 3) {
    throw new Error('Malformed Firebase ID token');
  }

  const [headerB64, payloadB64, signatureB64] = segments;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, any>;

  try {
    header = JSON.parse(decodeBase64Url(headerB64).toString('utf8'));
    payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Unable to decode Firebase ID token JSON');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid Firebase ID token algorithm or missing key ID');
  }

  const projectId = getFirebaseProjectId();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const nowSec = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new Error(`Firebase ID token audience mismatch (expected ${projectId})`);
  }

  if (payload.iss !== expectedIssuer) {
    throw new Error(`Firebase ID token issuer mismatch (expected ${expectedIssuer})`);
  }

  if (typeof payload.exp !== 'number' || payload.exp < nowSec - 30) {
    throw new Error('Firebase ID token has expired');
  }

  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Firebase ID token issued-at time is invalid');
  }

  const uid = String(payload.sub || payload.user_id || '').trim();
  if (!uid || uid.length > 128) {
    throw new Error('Firebase ID token subject (uid) is invalid');
  }

  const certs = await getGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    // Refresh certs once in case keys rotated
    cachedCerts = null;
    const refreshed = await getGooglePublicCerts();
    if (!refreshed[header.kid]) {
      throw new Error('No matching Google public certificate found for Firebase ID token');
    }
  }

  const activeCertPem = (cachedCerts && cachedCerts[header.kid]) || certPem;
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signatureValid = verifier.verify(activeCertPem, decodeBase64Url(signatureB64));
  if (!signatureValid) {
    throw new Error('Firebase ID token cryptographic signature verification failed');
  }

  const signInProvider =
    payload.firebase?.sign_in_provider === 'google.com' ? 'google.com' : 'password';

  return {
    uid,
    email: String(payload.email || '').trim().toLowerCase(),
    name: payload.name ? String(payload.name).trim() : undefined,
    picture: payload.picture ? String(payload.picture).trim() : undefined,
    emailVerified: Boolean(payload.email_verified),
    signInProvider,
    iat: payload.iat,
    exp: payload.exp,
  };
}
