/**
 * Backend & Integration Configuration
 * Centralizes environment check for Supabase, Gemini, and database connections.
 * 
 * Supports both Next.js standard conventions (NEXT_PUBLIC_*) and Vite conventions,
 * accepting either Supabase Anon JWTs or modern Supabase Publishable Keys (sb_publishable_*).
 */

export const BRAND_CONFIG = {
  appName: 'ReStockIQ',
  copilotName: 'ReStockIQ Copilot',
  tagline: 'Predict Shortages. Prevent Stockouts.',
  subtitle: 'AI-powered inventory intelligence and supply-chain optimization.',
  dailyBriefTimeIST: '10:00 AM IST',
  emailAutomationVerified: false, // Set to true once Apps Script trigger & end-to-end delivery are verified
} as const;

export interface BackendConfig {
  isSupabaseConfigured: boolean;
  isMisconfigured: boolean;
  configError: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  keyType: 'publishable_key' | 'anon_jwt' | null;
  activeUrlVar: 'NEXT_PUBLIC_SUPABASE_URL' | 'VITE_SUPABASE_URL' | null;
  activeKeyVar: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY' | 'VITE_SUPABASE_ANON_KEY' | null;
  isGeminiConfigured: boolean;
  environment: 'development' | 'production' | 'preview';
}

function getEnvVar(nextKey: string, viteKey: string): { value: string | null; source: string | null } {
  // Check import.meta.env first (Vite client)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env[nextKey]) return { value: String(import.meta.env[nextKey]).trim(), source: nextKey };
    if (import.meta.env[viteKey]) return { value: String(import.meta.env[viteKey]).trim(), source: viteKey };
  }

  // Check process.env (Node / SSR / Vite define)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[nextKey]) return { value: String(process.env[nextKey]).trim(), source: nextKey };
    if (process.env[viteKey]) return { value: String(process.env[viteKey]).trim(), source: viteKey };
  }

  return { value: null, source: null };
}

export const getBackendConfig = (): BackendConfig => {
  // 1. Resolve URL
  const urlEntry = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const rawUrl = urlEntry.value;
  const activeUrlVar = urlEntry.source as 'NEXT_PUBLIC_SUPABASE_URL' | 'VITE_SUPABASE_URL' | null;

  // 2. Resolve Key (Support both NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY)
  let keyVal: string | null = null;
  let activeKeyVar: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY' | 'VITE_SUPABASE_ANON_KEY' | null = null;

  // Check NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const pubKeyEntry = getEnvVar('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  if (pubKeyEntry.value) {
    keyVal = pubKeyEntry.value;
    activeKeyVar = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
  } else {
    // Check NEXT_PUBLIC_SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY
    const anonKeyEntry = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
    if (anonKeyEntry.value) {
      keyVal = anonKeyEntry.value;
      activeKeyVar = anonKeyEntry.source as any;
    }
  }

  // 3. Resolve Gemini
  const geminiEntry = getEnvVar('NEXT_PUBLIC_GEMINI_API_KEY', 'VITE_GEMINI_API_KEY');
  const isGeminiConfigured = Boolean(
    geminiEntry.value && 
    geminiEntry.value !== 'your_gemini_api_key_here'
  );

  // 4. Validate Configuration & Disallow Misconfigurations
  let isMisconfigured = false;
  let configError: string | null = null;
  let keyType: 'publishable_key' | 'anon_jwt' | null = null;

  const hasAnySupabase = Boolean(rawUrl || keyVal);

  if (hasAnySupabase) {
    // Check if either is missing
    if (!rawUrl) {
      isMisconfigured = true;
      configError = 'Supabase key was provided, but NEXT_PUBLIC_SUPABASE_URL is missing.';
    } else if (!keyVal) {
      isMisconfigured = true;
      configError = 'NEXT_PUBLIC_SUPABASE_URL was provided, but Supabase key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing.';
    } else {
      // Validate URL format
      if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        isMisconfigured = true;
        configError = `Invalid Supabase URL format: "${rawUrl}". Must start with https://`;
      } else if (rawUrl.includes('your-project-id.supabase.co') || rawUrl.includes('placeholder')) {
        isMisconfigured = true;
        configError = 'Supabase URL is still set to placeholder "your-project-id.supabase.co".';
      }

      // Validate Key Security (Zero Secret Exposure Rule)
      if (keyVal.includes('service_role') || keyVal.startsWith('sb_secret_')) {
        isMisconfigured = true;
        configError = 'CRITICAL SECURITY ERROR: Privileged Supabase service-role/secret key detected in client environment! Only public anon or publishable keys (sb_publishable_...) are permitted in the client browser.';
      } else if (keyVal.startsWith('sb_publishable_')) {
        keyType = 'publishable_key';
      } else if (keyVal.startsWith('eyJ')) {
        keyType = 'anon_jwt';
      } else if (keyVal === 'your_supabase_anon_public_key_here' || keyVal.length < 10) {
        isMisconfigured = true;
        configError = 'Supabase key is set to a placeholder or invalid token value.';
      } else {
        // Supported fallback key format
        keyType = 'publishable_key';
      }
    }
  }

  const isSupabaseConfigured = Boolean(
    !isMisconfigured &&
    rawUrl && 
    keyVal && 
    !configError
  );

  const envMode = typeof import.meta !== 'undefined' && import.meta.env?.MODE 
    ? (import.meta.env.MODE as 'development' | 'production' | 'preview') 
    : 'development';

  return {
    isSupabaseConfigured,
    isMisconfigured,
    configError,
    supabaseUrl: isSupabaseConfigured ? rawUrl : null,
    supabaseAnonKey: isSupabaseConfigured ? keyVal : null,
    keyType,
    activeUrlVar,
    activeKeyVar,
    isGeminiConfigured,
    environment: envMode,
  };
};
