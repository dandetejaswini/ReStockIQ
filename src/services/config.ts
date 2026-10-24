/**
 * Backend & Integration Configuration
 * Centralizes environment check for Supabase, Gemini, and database connections.
 *
 * Supports both Vite standard conventions (VITE_*) and Next.js conventions (NEXT_PUBLIC_*),
 * accepting either Supabase Anon JWTs (eyJ...) or modern Supabase Publishable Keys (sb_publishable_*).
 * Never exposes service_role or secret keys on the client.
 */

export const CANONICAL_SUPABASE_PROJECT_REF = 'tewaaznazgsmaherddeu';
export const CANONICAL_SUPABASE_URL = `https://${CANONICAL_SUPABASE_PROJECT_REF}.supabase.co`;

export const BRAND_CONFIG = {
  appName: 'ReStockIQ',
  copilotName: 'ReStockIQ Copilot',
  tagline: 'Predict Shortages. Prevent Stockouts.',
  subtitle: 'AI-powered inventory intelligence and supply-chain optimization.',
  companyFull: 'ReStockIQ Enterprise Supply Chain Intelligence',
  supportEmail: 'support@restockiq.app',
  localStoragePrefix: 'restockiq',
  legacyPrefixes: ['stockpilot', 'stockora', 'stockpulse'],
  dailyBriefTimeIST: '10:00 AM IST',
  emailAutomationVerified: false,
} as const;

export type ActiveSupabaseUrlVar = 'VITE_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_URL' | null;
export type ActiveSupabaseKeyVar =
  | 'VITE_SUPABASE_ANON_KEY'
  | 'VITE_SUPABASE_PUBLISHABLE_KEY'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  | 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  | null;

export interface BackendConfig {
  isSupabaseConfigured: boolean;
  isMisconfigured: boolean;
  configError: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  expectedProjectRef: string;
  detectedProjectRef: string | null;
  keyType: 'publishable_key' | 'anon_jwt' | null;
  activeUrlVar: ActiveSupabaseUrlVar;
  activeKeyVar: ActiveSupabaseKeyVar;
  isGeminiConfigured: boolean;
  environment: 'development' | 'production' | 'preview';
}

export function sanitizeEnvValue(val: string | undefined | null): string {
  if (!val || typeof val !== 'string') return '';
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('`') && cleaned.endsWith('`'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.toLowerCase().startsWith('bearer ')) {
    cleaned = cleaned.slice(7).trim();
  }
  return cleaned;
}

export function isPlaceholderValue(val: string | undefined | null): boolean {
  const cleaned = sanitizeEnvValue(val).toLowerCase();
  return (
    !cleaned ||
    cleaned === 'undefined' ||
    cleaned === 'null' ||
    cleaned.includes('placeholder') ||
    cleaned.startsWith('your_') ||
    cleaned.startsWith('<your') ||
    cleaned.includes('your_supabase_') ||
    cleaned.includes('your-project') ||
    cleaned.includes('_key_here') ||
    cleaned.includes('_jwt_here') ||
    cleaned === 'changeme' ||
    cleaned === 'example'
  );
}

function readSingleEnvVar(varName: string): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[varName]) {
      const val = sanitizeEnvValue(String(import.meta.env[varName]));
      if (val && !isPlaceholderValue(val)) return val;
    }
  } catch {
    // Ignore
  }

  try {
    if (typeof process !== 'undefined' && process.env && process.env[varName]) {
      const val = sanitizeEnvValue(String(process.env[varName]));
      if (val && !isPlaceholderValue(val)) return val;
    }
  } catch {
    // Ignore
  }

  return '';
}

function readRawSingleEnvVarIncludingPlaceholders(varName: string): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[varName]) {
      const val = sanitizeEnvValue(String(import.meta.env[varName]));
      if (val && val !== 'undefined' && val !== 'null') return val;
    }
  } catch {
    // Ignore
  }

  try {
    if (typeof process !== 'undefined' && process.env && process.env[varName]) {
      const val = sanitizeEnvValue(String(process.env[varName]));
      if (val && val !== 'undefined' && val !== 'null') return val;
    }
  } catch {
    // Ignore
  }

  return '';
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const jsonStr =
      typeof atob === 'function'
        ? atob(padded)
        : typeof Buffer !== 'undefined'
        ? Buffer.from(padded, 'base64').toString('utf-8')
        : '';
    if (!jsonStr) return null;
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function extractProjectRefFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length >= 3 && hostParts[1] === 'supabase') {
      return hostParts[0];
    }
    return null;
  } catch {
    return null;
  }
}

export interface KeyValidationResult {
  isValid: boolean;
  keyType: 'publishable_key' | 'anon_jwt' | null;
  isForbiddenSecret: boolean;
  keyProjectRef: string | null;
  error: string | null;
}

export function validateSupabasePublicKey(
  rawKey: string,
  expectedProjectRef: string | null
): KeyValidationResult {
  const key = sanitizeEnvValue(rawKey);
  if (!key || isPlaceholderValue(key)) {
    return {
      isValid: false,
      keyType: null,
      isForbiddenSecret: false,
      keyProjectRef: null,
      error: 'Supabase API key is set to a placeholder or empty value.',
    };
  }

  const lower = key.toLowerCase();

  // 1. Zero-Secret Exposure Rule: Reject service_role or sb_secret_ keys
  if (lower.startsWith('sb_secret_') || lower.includes('service_role')) {
    return {
      isValid: false,
      keyType: null,
      isForbiddenSecret: true,
      keyProjectRef: null,
      error:
        'CRITICAL SECURITY ERROR: Privileged Supabase service-role/secret key detected in client environment! Only public anon (eyJ...) or publishable (sb_publishable_...) keys are permitted in the browser.',
    };
  }

  // 2. Reject accidental Google/Firebase API key
  if (key.startsWith('AIza')) {
    return {
      isValid: false,
      keyType: null,
      isForbiddenSecret: false,
      keyProjectRef: null,
      error:
        'Invalid Supabase API key: A Google/Firebase API key (starting with "AIza") was provided instead of a Supabase anon JWT or sb_publishable_* key.',
    };
  }

  // 3. Modern Supabase Publishable Key (sb_publishable_...)
  if (key.startsWith('sb_publishable_')) {
    if (key.length < 20 || /\s/.test(key)) {
      return {
        isValid: false,
        keyType: null,
        isForbiddenSecret: false,
        keyProjectRef: null,
        error: 'Malformed Supabase publishable key (sb_publishable_* is truncated or contains whitespace).',
      };
    }
    return {
      isValid: true,
      keyType: 'publishable_key',
      isForbiddenSecret: false,
      keyProjectRef: expectedProjectRef,
      error: null,
    };
  }

  // 4. Legacy Supabase Anon JWT (eyJ...)
  if (key.startsWith('eyJ')) {
    const parts = key.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2] || parts[2].length < 10) {
      return {
        isValid: false,
        keyType: null,
        isForbiddenSecret: false,
        keyProjectRef: null,
        error:
          'Malformed Supabase anon JWT key: The token is truncated or incomplete (expected 3 dot-separated JWT segments).',
      };
    }

    const payload = decodeJwtPayload(key);
    if (!payload) {
      return {
        isValid: false,
        keyType: null,
        isForbiddenSecret: false,
        keyProjectRef: null,
        error: 'Malformed Supabase anon JWT key: Unable to decode JWT payload.',
      };
    }

    if (payload.role === 'service_role') {
      return {
        isValid: false,
        keyType: null,
        isForbiddenSecret: true,
        keyProjectRef: typeof payload.ref === 'string' ? payload.ref : null,
        error:
          'CRITICAL SECURITY ERROR: JWT has role="service_role". Never expose the service_role key in VITE_* or NEXT_PUBLIC_* variables.',
      };
    }

    const tokenRef = typeof payload.ref === 'string' ? payload.ref : null;
    if (expectedProjectRef && tokenRef && tokenRef !== expectedProjectRef) {
      return {
        isValid: false,
        keyType: null,
        isForbiddenSecret: false,
        keyProjectRef: tokenRef,
        error: `Supabase project mismatch: API key belongs to project "${tokenRef}", but URL is configured for "${expectedProjectRef}".`,
      };
    }

    return {
      isValid: true,
      keyType: 'anon_jwt',
      isForbiddenSecret: false,
      keyProjectRef: tokenRef,
      error: null,
    };
  }

  // Reject arbitrary strings that are neither eyJ... JWTs nor sb_publishable_... tokens
  return {
    isValid: false,
    keyType: null,
    isForbiddenSecret: false,
    keyProjectRef: null,
    error:
      'Invalid Supabase API key format: Must be a valid Supabase anon JWT (starting with "eyJ...") or publishable key (starting with "sb_publishable_...").',
  };
}

export const getBackendConfig = (): BackendConfig => {
  // 1. Resolve URL (Prioritize VITE_SUPABASE_URL, then NEXT_PUBLIC_SUPABASE_URL)
  const viteUrl = readSingleEnvVar('VITE_SUPABASE_URL');
  const nextUrl = readSingleEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const rawUrl = (viteUrl || nextUrl).replace(/\/+$/, '');
  const activeUrlVar: ActiveSupabaseUrlVar = viteUrl
    ? 'VITE_SUPABASE_URL'
    : nextUrl
    ? 'NEXT_PUBLIC_SUPABASE_URL'
    : null;

  // 2. Inspect all supported public key variables in priority order
  const keyVarNames: Array<Exclude<ActiveSupabaseKeyVar, null>> = [
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ];

  const nonPlaceholderKeys = keyVarNames
    .map((name) => ({ name, value: readSingleEnvVar(name) }))
    .filter((entry) => Boolean(entry.value));

  const rawIncludingPlaceholders = keyVarNames
    .map((name) => ({ name, value: readRawSingleEnvVarIncludingPlaceholders(name) }))
    .filter((entry) => Boolean(entry.value));

  // Resolve effective URL (use canonical https://tewaaznazgsmaherddeu.supabase.co if keys exist and URL omitted)
  const effectiveUrl = rawUrl || (nonPlaceholderKeys.length > 0 ? CANONICAL_SUPABASE_URL : '');
  const detectedProjectRef = effectiveUrl
    ? extractProjectRefFromUrl(effectiveUrl)
    : CANONICAL_SUPABASE_PROJECT_REF;

  let isMisconfigured = false;
  let configError: string | null = null;
  let selectedKey: string | null = null;
  let activeKeyVar: ActiveSupabaseKeyVar = null;
  let keyType: 'publishable_key' | 'anon_jwt' | null = null;

  // Validate URL format if provided
  if (effectiveUrl) {
    if (!effectiveUrl.startsWith('http://') && !effectiveUrl.startsWith('https://')) {
      isMisconfigured = true;
      configError = `Invalid Supabase URL format: "${effectiveUrl}". Must start with https://`;
    } else if (!effectiveUrl.includes('.supabase.co')) {
      isMisconfigured = true;
      configError = `Invalid Supabase URL host: "${effectiveUrl}". Expected https://${CANONICAL_SUPABASE_PROJECT_REF}.supabase.co`;
    }
  }

  // Validate candidate keys and pick the first valid key for the project
  if (!isMisconfigured) {
    if (nonPlaceholderKeys.length > 0) {
      let firstKeyError: string | null = null;
      let firstKeyErrorVar: string | null = null;

      for (const candidate of nonPlaceholderKeys) {
        const check = validateSupabasePublicKey(candidate.value, detectedProjectRef);
        if (check.isValid) {
          selectedKey = candidate.value;
          activeKeyVar = candidate.name;
          keyType = check.keyType;
          break;
        } else if (!firstKeyError) {
          firstKeyError = check.error;
          firstKeyErrorVar = candidate.name;
        }
      }

      if (!selectedKey && firstKeyError) {
        isMisconfigured = true;
        configError = `${firstKeyError}${firstKeyErrorVar ? ` (Variable: ${firstKeyErrorVar})` : ''}`;
      }
    } else if (rawIncludingPlaceholders.length > 0 && rawUrl) {
      // Only placeholder keys were provided alongside a URL — treat as unconfigured until real key is supplied
      isMisconfigured = false;
      configError = null;
    }
  }

  // 3. Resolve Gemini
  const geminiVal =
    readSingleEnvVar('VITE_GEMINI_API_KEY') || readSingleEnvVar('NEXT_PUBLIC_GEMINI_API_KEY');
  const isGeminiConfigured = Boolean(geminiVal);

  const isSupabaseConfigured = Boolean(
    !isMisconfigured && effectiveUrl && selectedKey && !configError
  );

  const envMode =
    typeof import.meta !== 'undefined' && import.meta.env?.MODE
      ? (import.meta.env.MODE as 'development' | 'production' | 'preview')
      : 'development';

  return {
    isSupabaseConfigured,
    isMisconfigured,
    configError,
    supabaseUrl: isSupabaseConfigured ? effectiveUrl : rawUrl || CANONICAL_SUPABASE_URL,
    supabaseAnonKey: isSupabaseConfigured ? selectedKey : null,
    expectedProjectRef: CANONICAL_SUPABASE_PROJECT_REF,
    detectedProjectRef,
    keyType,
    activeUrlVar,
    activeKeyVar,
    isGeminiConfigured,
    environment: envMode,
  };
};

