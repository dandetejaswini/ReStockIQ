import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  let val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'")) ||
    (val.startsWith('`') && val.endsWith('`'))
  ) {
    val = val.slice(1, -1).trim();
  }
  if (val.toLowerCase().startsWith('bearer ')) {
    val = val.slice(7).trim();
  }
  const lower = val.toLowerCase();
  if (
    !val ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower.includes('placeholder') ||
    lower.startsWith('your_') ||
    lower.startsWith('<your') ||
    lower === 'changeme'
  ) {
    return '';
  }
  return val;
}

export default defineConfig(() => {
  const supabaseUrl =
    cleanEnvValue(process.env.VITE_SUPABASE_URL) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    '';
  const viteAnonKey = cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY);
  const vitePublishableKey = cleanEnvValue(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const nextAnonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const nextPublishableKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  const supabaseAnonKey =
    viteAnonKey ||
    vitePublishableKey ||
    nextAnonKey ||
    nextPublishableKey ||
    '';
  const supabasePubHex =
    vitePublishableKey ||
    nextPublishableKey ||
    supabaseAnonKey;

  const fbApiKey = cleanEnvValue(process.env.VITE_FIREBASE_API_KEY) || cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) || '';
  const fbAuthDomain = cleanEnvValue(process.env.VITE_FIREBASE_AUTH_DOMAIN) || cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) || '';
  const fbProjectId = cleanEnvValue(process.env.VITE_FIREBASE_PROJECT_ID) || cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || '';
  const fbStorageBucket = cleanEnvValue(process.env.VITE_FIREBASE_STORAGE_BUCKET) || cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) || '';
  const fbSenderId = cleanEnvValue(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) || '';
  const fbAppId = cleanEnvValue(process.env.VITE_FIREBASE_APP_ID) || cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) || '';
  const rawFbDatabaseId = (
    cleanEnvValue(process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID) ||
    ''
  );
  const isDefaultOrPlaceholderDb =
    !rawFbDatabaseId ||
    rawFbDatabaseId.toLowerCase() === '(default)' ||
    rawFbDatabaseId.toLowerCase() === 'default' ||
    rawFbDatabaseId.toLowerCase().includes('your_firestore_') ||
    rawFbDatabaseId.toLowerCase().includes('your_firebase_');
  const fbDatabaseId = isDefaultOrPlaceholderDb
    ? 'ai-studio-stockpilotaiinte-017db4c7-23ad-4924-b3e1-197cbaf1a0ac'
    : rawFbDatabaseId;

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePubHex),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'process.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePubHex),
      'process.env.NEXT_PUBLIC_FIREBASE_API_KEY': JSON.stringify(fbApiKey),
      'process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': JSON.stringify(fbAuthDomain),
      'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': JSON.stringify(fbProjectId),
      'process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': JSON.stringify(fbStorageBucket),
      'process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(fbSenderId),
      'process.env.NEXT_PUBLIC_FIREBASE_APP_ID': JSON.stringify(fbAppId),
      'process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID': JSON.stringify(fbDatabaseId),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
