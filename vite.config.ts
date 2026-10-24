import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';
  const supabasePubHex =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    supabaseAnonKey;

  const fbApiKey = process.env.VITE_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
  const fbAuthDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
  const fbProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const fbStorageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
  const fbSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '';
  const fbAppId = process.env.VITE_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '';
  const rawFbDatabaseId = (
    process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID ||
    ''
  ).trim();
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
