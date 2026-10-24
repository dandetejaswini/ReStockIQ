import { User as FirebaseUser } from 'firebase/auth';
import { getSupabase } from './supabaseClient';

export interface EmailPreferences {
  stockout_alerts: boolean;
  price_change_alerts: boolean;
  pending_approval_digest: boolean;
  daily_inventory_alerts: boolean;
  weekly_briefing: boolean;
  frequency: 'INSTANT' | 'DAILY_DIGEST' | 'WEEKLY';
  updated_at?: string;
}

export interface EmailDeliveryLogItem {
  id: string;
  recipient_email: string;
  template_type: string;
  status: string;
  subject?: string;
  error_message?: string | null;
  sent_at: string;
}

export interface EmailQueueItem {
  id: string;
  recipient_email: string;
  template_type: string;
  status: string;
  idempotency_key?: string;
  attempts: number;
  error_message?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export interface WorkspaceSyncResponse {
  success: boolean;
  migrationRequired?: boolean;
  workspace?: {
    profile_id: string;
    organization_id: string;
    organization_name: string;
    firebase_uid: string;
    email: string;
    full_name: string;
    is_new_account: boolean;
    welcome_queued: boolean;
    queue_id?: string | null;
    idempotency_key?: string;
  };
  welcomeEmail?: {
    queued: boolean;
    queueId?: string | null;
    idempotencyKey?: string | null;
  };
  error?: string;
}

// Track UIDs synced in the current browser session so page refreshes or React re-renders
// do not repeatedly invoke workspace sync unless onboarding / signup explicitly triggers it.
const syncedSessionUids = new Set<string>();

export async function syncFirebaseWorkspaceAndWelcomeEmail(
  firebaseUser: FirebaseUser,
  options?: {
    fullName?: string;
    storeName?: string;
    isSignup?: boolean;
    force?: boolean;
  }
): Promise<WorkspaceSyncResponse> {
  if (!firebaseUser?.uid || !firebaseUser?.email) {
    return { success: false, error: 'Missing Firebase user uid or email' };
  }

  const cacheKey = `${firebaseUser.uid}:${options?.isSignup ? 'signup' : 'login'}:${options?.storeName || ''}`;
  if (!options?.force && !options?.isSignup && syncedSessionUids.has(cacheKey)) {
    return { success: true };
  }

  const fullName =
    options?.fullName ||
    firebaseUser.displayName ||
    firebaseUser.email.split('@')[0] ||
    'Store Procurement Lead';
  const storeName = options?.storeName || undefined;
  const provider =
    firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google.com' : 'password';

  try {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch('/api/auth/sync-workspace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fullName,
        storeName,
        isSignup: Boolean(options?.isSignup),
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as WorkspaceSyncResponse;
      if (data.success) {
        syncedSessionUids.add(cacheKey);
      }
      return data;
    }
  } catch {
    // Fallback to direct Supabase RPC if running in static preview
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase client is not initialized' };
  }

  try {
    const { data, error } = await supabase.rpc('sync_firebase_workspace_and_welcome', {
      p_firebase_uid: firebaseUser.uid,
      p_email: firebaseUser.email,
      p_full_name: fullName,
      p_store_name: storeName || null,
      p_provider: provider,
      p_avatar_url: firebaseUser.photoURL || '',
      p_is_signup: Boolean(options?.isSignup),
    });

    if (error) {
      const isMissingRpc =
        error.message?.includes('sync_firebase_workspace_and_welcome') ||
        error.code === 'PGRST202' ||
        error.code === '42883';
      return {
        success: false,
        migrationRequired: isMissingRpc,
        error: error.message,
      };
    }

    syncedSessionUids.add(cacheKey);
    return {
      success: true,
      workspace: data,
      welcomeEmail: {
        queued: Boolean(data?.welcome_queued),
        queueId: data?.queue_id || null,
        idempotencyKey: data?.idempotency_key || null,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to sync Firebase workspace with Supabase',
    };
  }
}

export async function fetchUserEmailPreferences(firebaseUser: FirebaseUser | null): Promise<{
  success: boolean;
  migrationRequired?: boolean;
  preferences?: EmailPreferences;
  deliveryLogs?: EmailDeliveryLogItem[];
  emailQueue?: EmailQueueItem[];
  error?: string;
}> {
  if (!firebaseUser?.uid || !firebaseUser?.email) {
    return { success: false, error: 'Not authenticated with Firebase' };
  }

  try {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch('/api/preferences/email', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        return {
          success: true,
          preferences: json.preferences || undefined,
          deliveryLogs: Array.isArray(json.delivery_logs) ? json.delivery_logs : [],
          emailQueue: Array.isArray(json.email_queue) ? json.email_queue : [],
        };
      }
      if (json.migrationRequired) {
        return {
          success: false,
          migrationRequired: true,
          error: json.error,
        };
      }
    }
  } catch {
    // Fallback to direct Supabase RPC
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.rpc('get_firebase_user_email_preferences', {
      p_firebase_uid: firebaseUser.uid,
      p_email: firebaseUser.email,
    });

    if (error) {
      const isMissingRpc =
        error.message?.includes('get_firebase_user_email_preferences') ||
        error.code === 'PGRST202' ||
        error.code === '42883';
      return {
        success: false,
        migrationRequired: isMissingRpc,
        error: error.message,
      };
    }

    return {
      success: true,
      preferences: data?.preferences || undefined,
      deliveryLogs: Array.isArray(data?.delivery_logs) ? data.delivery_logs : [],
      emailQueue: Array.isArray(data?.email_queue) ? data.email_queue : [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to load email preferences',
    };
  }
}

export async function saveUserEmailPreferences(
  firebaseUser: FirebaseUser | null,
  preferences: EmailPreferences
): Promise<{
  success: boolean;
  preferences?: EmailPreferences;
  error?: string;
}> {
  if (!firebaseUser?.uid || !firebaseUser?.email) {
    return { success: false, error: 'You must be signed in to save email preferences.' };
  }

  try {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch('/api/preferences/email', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(preferences),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        return {
          success: true,
          preferences: json.preferences || preferences,
        };
      }
    }
  } catch {
    // Fallback to direct Supabase RPC
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.rpc('update_firebase_user_email_preferences', {
      p_firebase_uid: firebaseUser.uid,
      p_email: firebaseUser.email,
      p_stockout_alerts: preferences.stockout_alerts,
      p_price_change_alerts: preferences.price_change_alerts,
      p_pending_approval_digest: preferences.pending_approval_digest,
      p_daily_inventory_alerts: preferences.daily_inventory_alerts,
      p_weekly_briefing: preferences.weekly_briefing,
      p_frequency: preferences.frequency,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      preferences: data?.preferences || preferences,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to update email preferences',
    };
  }
}
