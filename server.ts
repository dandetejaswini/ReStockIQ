import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyFirebaseIdToken, VerifiedFirebaseToken } from './src/server/firebaseVerifier.js';

const PORT = Number(process.env.PORT || 3000);

function sanitizeServerEnv(raw: string | undefined): string {
  if (!raw) return '';
  let cleaned = raw.trim();
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
  const lower = cleaned.toLowerCase();
  if (
    !cleaned ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower.includes('placeholder') ||
    lower.startsWith('your_') ||
    lower.startsWith('<your') ||
    lower.includes('your_supabase_') ||
    lower.includes('your_shared_') ||
    lower.includes('your_deployment_id') ||
    lower.includes('your-production-domain') ||
    lower.includes('_key_here') ||
    lower.includes('_secret_here') ||
    lower === 'changeme'
  ) {
    return '';
  }
  return cleaned;
}

function maskEmailForLogs(email: string): string {
  const clean = String(email || '').trim().toLowerCase();
  const parts = clean.split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export interface WelcomeEmailDiagnosticTrace {
  traceId: string;
  timestamp: string;
  firebaseUid: string;
  maskedEmail: string;
  idempotencyKey: string;
  stages: {
    stage1_signup_completed: {
      completed: boolean;
      isSignupRequest: boolean;
      provider: string;
    };
    stage2_welcome_trigger_invoked: {
      invoked: boolean;
      endpoint: string;
    };
    stage3_vercel_endpoint_accepted: {
      accepted: boolean;
      isNewAccount: boolean;
      welcomeQueued: boolean;
      queueId: string | null;
      alreadySent: boolean;
    };
    stage4_apps_script_processed: {
      attempted: boolean;
      accepted: boolean;
      httpStatus?: number;
      errorCode?: string | null;
      errorMessage?: string | null;
    };
    stage5_email_provider_accepted: {
      dispatched: boolean;
      providerStatus: string;
    };
    stage6_final_status_recorded: {
      recorded: boolean;
      finalStatus: 'SENT' | 'SKIPPED' | 'PENDING' | 'FAILED' | 'NOT_NEEDED';
      errorMessage?: string | null;
    };
  };
}

const RECENT_DIAGNOSTIC_TRACES: WelcomeEmailDiagnosticTrace[] = [];
const MAX_DIAGNOSTIC_TRACES = 25;

function recordDiagnosticTrace(trace: WelcomeEmailDiagnosticTrace) {
  RECENT_DIAGNOSTIC_TRACES.unshift(trace);
  if (RECENT_DIAGNOSTIC_TRACES.length > MAX_DIAGNOSTIC_TRACES) {
    RECENT_DIAGNOSTIC_TRACES.pop();
  }
  const finalStatus = trace.stages.stage6_final_status_recorded.finalStatus;
  const logLine = JSON.stringify({
    service: 'ReStockIQ-WelcomeEmailLifecycle',
    traceId: trace.traceId,
    timestamp: trace.timestamp,
    firebaseUid: trace.firebaseUid,
    maskedEmail: trace.maskedEmail,
    idempotencyKey: trace.idempotencyKey,
    finalStatus,
    stages: trace.stages,
  });
  if (finalStatus === 'FAILED') {
    console.error(logLine);
  } else {
    console.info(logLine);
  }
}

export function getServerSupabaseConfig() {
  const explicitSupabaseUrl = sanitizeServerEnv(process.env.SUPABASE_URL);
  const viteSupabaseUrl = sanitizeServerEnv(process.env.VITE_SUPABASE_URL);
  const nextPublicSupabaseUrl = sanitizeServerEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const supabaseUrl = (
    explicitSupabaseUrl ||
    viteSupabaseUrl ||
    nextPublicSupabaseUrl ||
    'https://tewaaznazgsmaherddeu.supabase.co'
  ).replace(/\/+$/, '');

  const serviceRoleKey =
    sanitizeServerEnv(process.env.SUPABASE_SECRET_KEY) ||
    sanitizeServerEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    '';

  const publishableCandidates = [
    sanitizeServerEnv(process.env.VITE_SUPABASE_ANON_KEY),
    sanitizeServerEnv(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    sanitizeServerEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    sanitizeServerEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  ].filter(Boolean);

  const publishableKey = publishableCandidates[0] || '';

  const appsScriptUrl =
    sanitizeServerEnv(process.env.STOCKPILOT_APPS_SCRIPT_URL) ||
    sanitizeServerEnv(process.env.APPS_SCRIPT_WEB_APP_URL) ||
    sanitizeServerEnv(process.env.GOOGLE_APPS_SCRIPT_URL) ||
    '';

  const appsScriptSecret =
    sanitizeServerEnv(process.env.STOCKPILOT_APPS_SCRIPT_SECRET) ||
    sanitizeServerEnv(process.env.APPS_SCRIPT_SECRET) ||
    sanitizeServerEnv(process.env.GOOGLE_APPS_SCRIPT_SECRET) ||
    '';

  const vercelProdUrl = sanitizeServerEnv(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const vercelBranchUrl = sanitizeServerEnv(process.env.VERCEL_URL);
  const explicitAppUrl =
    sanitizeServerEnv(process.env.STOCKPILOT_APP_URL) ||
    sanitizeServerEnv(process.env.APP_URL) ||
    '';

  const appUrl = (
    explicitAppUrl ||
    (vercelProdUrl ? `https://${vercelProdUrl.replace(/^https?:\/\//, '')}` : '') ||
    (vercelBranchUrl ? `https://${vercelBranchUrl.replace(/^https?:\/\//, '')}` : '')
  ).replace(/\/+$/, '');

  const isAppsScriptUrlValidFormat =
    appsScriptUrl.startsWith('https://script.google.com/macros/s/') &&
    appsScriptUrl.endsWith('/exec');
  const isAppsScriptDevUrl =
    appsScriptUrl.startsWith('https://script.google.com/macros/s/') &&
    appsScriptUrl.endsWith('/dev');

  const missingProductionEnvVars: string[] = [];
  if (!explicitSupabaseUrl && !viteSupabaseUrl && !nextPublicSupabaseUrl) {
    missingProductionEnvVars.push('SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    missingProductionEnvVars.push('SUPABASE_SECRET_KEY');
  }
  if (!appsScriptUrl) {
    missingProductionEnvVars.push('STOCKPILOT_APPS_SCRIPT_URL');
  }
  if (!appsScriptSecret) {
    missingProductionEnvVars.push('STOCKPILOT_APPS_SCRIPT_SECRET');
  }
  if (!explicitAppUrl) {
    missingProductionEnvVars.push('STOCKPILOT_APP_URL');
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    publishableKey,
    activeSupabaseKey: serviceRoleKey || publishableKey,
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasPublishableKey: Boolean(publishableKey),
    hasAppsScriptWebhook: Boolean(appsScriptUrl && appsScriptSecret),
    appsScriptUrl,
    appsScriptSecret,
    isAppsScriptUrlValidFormat,
    isAppsScriptDevUrl,
    appUrl,
    explicitVariablesStatus: {
      SUPABASE_URL: Boolean(explicitSupabaseUrl || viteSupabaseUrl || nextPublicSupabaseUrl),
      SUPABASE_SECRET_KEY: Boolean(serviceRoleKey),
      STOCKPILOT_APPS_SCRIPT_URL: Boolean(appsScriptUrl),
      STOCKPILOT_APPS_SCRIPT_SECRET: Boolean(appsScriptSecret),
      STOCKPILOT_APP_URL: Boolean(explicitAppUrl),
    },
    missingProductionEnvVars,
  };
}

const supabaseClientCache = new Map<string, SupabaseClient>();

function createSupabaseClientForKey(url: string, key: string): SupabaseClient {
  const cacheKey = `${url}::${key}`;
  const existing = supabaseClientCache.get(cacheKey);
  if (existing) return existing;

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  supabaseClientCache.set(cacheKey, client);
  return client;
}

function getServerSupabase(preferPublicKey = false): SupabaseClient | null {
  const cfg = getServerSupabaseConfig();
  const keyToUse = preferPublicKey
    ? cfg.publishableKey || cfg.serviceRoleKey
    : cfg.serviceRoleKey || cfg.publishableKey;
  if (!cfg.supabaseUrl || !keyToUse) {
    return null;
  }
  return createSupabaseClientForKey(cfg.supabaseUrl, keyToUse);
}

/**
 * Executes a SECURITY DEFINER RPC on Supabase using the primary server key (SUPABASE_SECRET_KEY),
 * and automatically retries with the public key (VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY)
 * if the primary key is missing, invalid, or rejected with 401/403.
 */
async function callSupabaseRpcWithFallback<T = any>(
  rpcName: string,
  params: Record<string, any>
): Promise<{ data: T | null; error: any; clientUsed: SupabaseClient | null }> {
  const cfg = getServerSupabaseConfig();
  const primaryClient = getServerSupabase(false);
  if (!primaryClient) {
    return {
      data: null,
      error: { message: 'Supabase is not configured on the server.' },
      clientUsed: null,
    };
  }

  const primaryRes = await primaryClient.rpc(rpcName, params);
  if (!primaryRes.error) {
    return {
      data: primaryRes.data as T,
      error: null,
      clientUsed: primaryClient,
    };
  }

  const errMsg = String(primaryRes.error?.message || '').toLowerCase();
  const isKeyAuthError =
    errMsg.includes('invalid api key') ||
    errMsg.includes('jwt') ||
    primaryRes.status === 401 ||
    primaryRes.status === 403;

  if (isKeyAuthError && cfg.hasServiceRoleKey && cfg.hasPublishableKey) {
    const fallbackClient = getServerSupabase(true);
    if (fallbackClient && fallbackClient !== primaryClient) {
      const retryRes = await fallbackClient.rpc(rpcName, params);
      return {
        data: retryRes.data as T,
        error: retryRes.error,
        clientUsed: fallbackClient,
      };
    }
  }

  return {
    data: primaryRes.data as T,
    error: primaryRes.error,
    clientUsed: primaryClient,
  };
}

async function authenticateRequest(req: Request): Promise<VerifiedFirebaseToken> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Authorization Bearer token');
  }
  return verifyFirebaseIdToken(authHeader);
}

export interface WebhookDispatchResult {
  triggered: boolean;
  dispatched: boolean;
  status: 'SENT' | 'SKIPPED' | 'FAILED' | 'QUEUED_FOR_APPS_SCRIPT_POLLER';
  httpStatus?: number;
  errorCode?: string;
  error?: string;
  remainingDailyQuota?: number;
}

export async function triggerAppsScriptWebhook(
  payload: Record<string, any>
): Promise<WebhookDispatchResult> {
  const cfg = getServerSupabaseConfig();
  if (!cfg.hasAppsScriptWebhook) {
    const missingVars: string[] = [];
    if (!cfg.appsScriptUrl) missingVars.push('STOCKPILOT_APPS_SCRIPT_URL');
    if (!cfg.appsScriptSecret) missingVars.push('STOCKPILOT_APPS_SCRIPT_SECRET');
    return {
      triggered: false,
      dispatched: false,
      status: 'QUEUED_FOR_APPS_SCRIPT_POLLER',
      errorCode: 'MISSING_APPS_SCRIPT_ENV',
      error: `Missing Vercel server environment variable(s): ${missingVars.join(', ')}. Welcome email is queued as PENDING in public.email_queue.`,
    };
  }

  if (cfg.isAppsScriptDevUrl) {
    return {
      triggered: false,
      dispatched: false,
      status: 'FAILED',
      errorCode: 'INVALID_APPS_SCRIPT_DEV_URL',
      error:
        'STOCKPILOT_APPS_SCRIPT_URL ends with "/dev" instead of "/exec". Use the production Web App "/exec" deployment URL with access set to "Anyone".',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const res = await fetch(cfg.appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        appUrl: payload.appUrl || cfg.appUrl || undefined,
        secret: cfg.appsScriptSecret,
      }),
      redirect: 'follow',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const text = (await res.text()).trim();

    // Detect HTML responses (e.g. Google login page when Web App access is not "Anyone", or Apps Script HTML exception page)
    if (
      text.startsWith('<!DOCTYPE') ||
      text.startsWith('<html') ||
      text.includes('accounts.google.com') ||
      text.includes('ServiceLogin')
    ) {
      const isLoginRedirect =
        text.includes('accounts.google.com') ||
        text.includes('ServiceLogin') ||
        res.url?.includes('accounts.google.com');

      return {
        triggered: true,
        dispatched: false,
        status: 'FAILED',
        httpStatus: res.status,
        errorCode: isLoginRedirect ? 'APPS_SCRIPT_ACCESS_DENIED' : 'APPS_SCRIPT_HTML_ERROR',
        error: isLoginRedirect
          ? 'Google Apps Script returned a sign-in page instead of JSON. In Apps Script > Deploy > Manage deployments, set "Execute as: Me" and "Who has access: Anyone".'
          : `Google Apps Script returned an HTML error response (HTTP ${res.status}). Verify the latest Code.gs is deployed as a Web App.`,
      };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        triggered: true,
        dispatched: false,
        status: 'FAILED',
        httpStatus: res.status,
        errorCode: 'APPS_SCRIPT_INVALID_JSON',
        error: `Apps Script returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 180)}`,
      };
    }

    if (!res.ok || parsed?.success === false || parsed?.status === 'FAILED') {
      const errText =
        parsed?.error ||
        parsed?.message ||
        `Apps Script webhook rejected request (HTTP ${res.status})`;
      const isUnauthorized = String(errText).toLowerCase().includes('unauthorized');
      return {
        triggered: true,
        dispatched: false,
        status: 'FAILED',
        httpStatus: res.status,
        errorCode: isUnauthorized ? 'APPS_SCRIPT_SECRET_MISMATCH' : 'APPS_SCRIPT_EXECUTION_ERROR',
        error: errText,
      };
    }

    // Check explicit delivery confirmation for SEND_WELCOME_EMAIL
    if (payload.action === 'SEND_WELCOME_EMAIL') {
      if (parsed?.status === 'SENT' || (typeof parsed?.sent === 'number' && parsed.sent > 0)) {
        return {
          triggered: true,
          dispatched: true,
          status: 'SENT',
          httpStatus: res.status,
          remainingDailyQuota: parsed?.remainingDailyQuota,
        };
      }

      if (
        parsed?.status === 'SKIPPED' ||
        (typeof parsed?.skipped === 'number' && parsed.skipped > 0 && !parsed?.failed)
      ) {
        return {
          triggered: true,
          dispatched: false,
          status: 'SKIPPED',
          httpStatus: res.status,
        };
      }

      // If Apps Script fell through to processPendingEmailQueueInternal_ and processed 0 rows
      return {
        triggered: true,
        dispatched: false,
        status: 'FAILED',
        httpStatus: res.status,
        errorCode: 'APPS_SCRIPT_NO_EMAIL_SENT',
        error:
          parsed?.error ||
          parsed?.message ||
          'Apps Script webhook completed without sending the welcome email (0 rows processed). Verify SUPABASE_SECRET_KEY in Apps Script Script Properties and redeploy Code.gs.',
      };
    }

    return {
      triggered: true,
      dispatched: true,
      status: parsed?.status || 'SENT',
      httpStatus: res.status,
      remainingDailyQuota: parsed?.remainingDailyQuota,
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return {
      triggered: true,
      dispatched: false,
      status: 'FAILED',
      errorCode: isTimeout ? 'APPS_SCRIPT_TIMEOUT' : 'APPS_SCRIPT_NETWORK_ERROR',
      error: isTimeout
        ? 'Timed out waiting for Google Apps Script webhook response (18s).'
        : err?.message || 'Failed to reach Apps Script webhook URL',
    };
  }
}

/**
 * Orchestrates the 6-stage welcome-email lifecycle for a verified Firebase user.
 * Safely handles first-time signups, pending/failed queue retries, and strict idempotency.
 */
async function syncWorkspaceAndOrchestrateWelcomeEmail(params: {
  verifiedUser: VerifiedFirebaseToken;
  fullName: string;
  storeName: string | null;
  isSignup: boolean;
  ensureWelcomeEmail: boolean;
  endpointName: string;
}) {
  const { verifiedUser, fullName, storeName, isSignup, ensureWelcomeEmail, endpointName } = params;
  const cfg = getServerSupabaseConfig();
  const idempotencyKey = `welcome:firebase_uid:${verifiedUser.uid}`;

  const trace: WelcomeEmailDiagnosticTrace = {
    traceId: `TRC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    firebaseUid: verifiedUser.uid,
    maskedEmail: maskEmailForLogs(verifiedUser.email),
    idempotencyKey,
    stages: {
      stage1_signup_completed: {
        completed: true,
        isSignupRequest: isSignup,
        provider: verifiedUser.signInProvider,
      },
      stage2_welcome_trigger_invoked: {
        invoked: true,
        endpoint: endpointName,
      },
      stage3_vercel_endpoint_accepted: {
        accepted: false,
        isNewAccount: false,
        welcomeQueued: false,
        queueId: null,
        alreadySent: false,
      },
      stage4_apps_script_processed: {
        attempted: false,
        accepted: false,
        errorCode: null,
        errorMessage: null,
      },
      stage5_email_provider_accepted: {
        dispatched: false,
        providerStatus: 'NOT_ATTEMPTED',
      },
      stage6_final_status_recorded: {
        recorded: false,
        finalStatus: 'NOT_NEEDED',
        errorMessage: null,
      },
    },
  };

  // Step 1: Call canonical workspace sync RPC
  let { data: syncData, error: rpcError } = await callSupabaseRpcWithFallback(
    'sync_firebase_workspace_and_welcome',
    {
      p_firebase_uid: verifiedUser.uid,
      p_email: verifiedUser.email,
      p_full_name: fullName,
      p_store_name: storeName,
      p_provider: verifiedUser.signInProvider,
      p_avatar_url: verifiedUser.picture || '',
      p_is_signup: isSignup,
    }
  );

  if (rpcError) {
    const isMissingRpc =
      rpcError.message?.includes('sync_firebase_workspace_and_welcome') ||
      rpcError.code === 'PGRST202' ||
      rpcError.code === '42883';

    trace.stages.stage6_final_status_recorded = {
      recorded: false,
      finalStatus: 'FAILED',
      errorMessage: rpcError.message,
    };
    recordDiagnosticTrace(trace);

    return {
      httpStatus: 200,
      payload: {
        success: false,
        migrationRequired: isMissingRpc,
        firebaseUid: verifiedUser.uid,
        email: verifiedUser.email,
        errorCode: isMissingRpc ? 'SUPABASE_MIGRATION_MISSING' : 'SUPABASE_RPC_ERROR',
        error: isMissingRpc
          ? 'Supabase migration 20261025_firebase_identity_and_email_automation.sql has not been applied yet.'
          : rpcError.message,
        diagnostics: trace,
      },
    };
  }

  let queueId: string | null = syncData?.queue_id ? String(syncData.queue_id) : null;
  let welcomeQueued = Boolean(syncData?.welcome_queued && queueId);
  let alreadySent = false;

  // Step 2: If sync_firebase_workspace_and_welcome did not return a newly queued PENDING row,
  // inspect the user's existing email_queue & delivery_logs via SECURITY DEFINER RPC to check:
  //   a) Whether a WELCOME email was ALREADY SENT (enforce strict idempotency), OR
  //   b) Whether a WELCOME email is stuck in PENDING / FAILED / PROCESSING and needs retry, OR
  //   c) Whether a signup / onboarding request never had a WELCOME row created yet.
  if (!welcomeQueued) {
    const { data: prefsData } = await callSupabaseRpcWithFallback(
      'get_firebase_user_email_preferences',
      {
        p_firebase_uid: verifiedUser.uid,
        p_email: verifiedUser.email,
      }
    );

    const deliveryLogs: any[] = Array.isArray(prefsData?.delivery_logs)
      ? prefsData.delivery_logs
      : [];
    const emailQueue: any[] = Array.isArray(prefsData?.email_queue) ? prefsData.email_queue : [];
    const cleanEmail = verifiedUser.email.toLowerCase();

    const sentInLogs = deliveryLogs.some(
      (l) =>
        l.template_type === 'WELCOME' &&
        l.status === 'SENT' &&
        String(l.recipient_email || '').toLowerCase() === cleanEmail
    );
    const sentInQueue = emailQueue.some(
      (q) =>
        q.template_type === 'WELCOME' &&
        q.status === 'SENT' &&
        (String(q.recipient_email || '').toLowerCase() === cleanEmail ||
          q.idempotency_key === idempotencyKey)
    );

    alreadySent = sentInLogs || sentInQueue;

    if (!alreadySent) {
      // Check for an existing unsent WELCOME row in email_queue (PENDING, FAILED, or stuck PROCESSING)
      const unsentWelcomeRow = emailQueue.find(
        (q) =>
          q.template_type === 'WELCOME' &&
          ['PENDING', 'FAILED', 'PROCESSING'].includes(String(q.status || '').toUpperCase()) &&
          (String(q.recipient_email || '').toLowerCase() === cleanEmail ||
            q.idempotency_key === idempotencyKey)
      );

      if (unsentWelcomeRow?.id) {
        queueId = String(unsentWelcomeRow.id);
        welcomeQueued = true;
      } else if (isSignup || ensureWelcomeEmail || syncData?.is_new_account) {
        // No WELCOME row exists at all yet and user has never been sent a welcome email:
        // force p_is_signup: true to enqueue the idempotent row now.
        const retrySync = await callSupabaseRpcWithFallback(
          'sync_firebase_workspace_and_welcome',
          {
            p_firebase_uid: verifiedUser.uid,
            p_email: verifiedUser.email,
            p_full_name: fullName,
            p_store_name: storeName,
            p_provider: verifiedUser.signInProvider,
            p_avatar_url: verifiedUser.picture || '',
            p_is_signup: true,
          }
        );
        if (!retrySync.error && retrySync.data?.queue_id) {
          syncData = retrySync.data;
          queueId = String(retrySync.data.queue_id);
          welcomeQueued = true;
        } else if (isSignup || ensureWelcomeEmail) {
          // Even if queue_id wasn't returned, allow direct webhook dispatch with idempotencyKey
          welcomeQueued = true;
        }
      }
    }
  }

  trace.stages.stage3_vercel_endpoint_accepted = {
    accepted: true,
    isNewAccount: Boolean(syncData?.is_new_account),
    welcomeQueued,
    queueId,
    alreadySent,
  };

  let webhookDispatch: WebhookDispatchResult | null = null;

  if (alreadySent) {
    trace.stages.stage6_final_status_recorded = {
      recorded: true,
      finalStatus: 'SKIPPED',
    };
  } else if (welcomeQueued) {
    trace.stages.stage4_apps_script_processed.attempted = true;

    webhookDispatch = await triggerAppsScriptWebhook({
      action: 'SEND_WELCOME_EMAIL',
      queueId,
      firebaseUid: verifiedUser.uid,
      email: verifiedUser.email,
      fullName,
      organizationId: syncData?.organization_id,
      storeName: storeName || syncData?.organization_name || 'Your Retail Workspace',
      idempotencyKey: syncData?.idempotency_key || idempotencyKey,
      appUrl: cfg.appUrl || undefined,
    });

    trace.stages.stage4_apps_script_processed = {
      attempted: webhookDispatch.triggered,
      accepted: webhookDispatch.dispatched || webhookDispatch.status === 'SKIPPED',
      httpStatus: webhookDispatch.httpStatus,
      errorCode: webhookDispatch.errorCode || null,
      errorMessage: webhookDispatch.error || null,
    };

    trace.stages.stage5_email_provider_accepted = {
      dispatched: webhookDispatch.dispatched,
      providerStatus: webhookDispatch.status,
    };

    // Stage 6: Ensure final status is recorded in Supabase ONLY when delivery actually succeeded (or failed)
    if (webhookDispatch.status === 'SENT' && queueId) {
      await callSupabaseRpcWithFallback('record_email_dispatch_result', {
        p_queue_id: queueId,
        p_status: 'SENT',
        p_error_message: null,
        p_metadata: {
          store_name: storeName || syncData?.organization_name || 'Your Retail Workspace',
          dispatched_via: 'vercel_apps_script_webhook',
        },
      });
      trace.stages.stage6_final_status_recorded = {
        recorded: true,
        finalStatus: 'SENT',
      };
    } else if (webhookDispatch.status === 'SKIPPED') {
      trace.stages.stage6_final_status_recorded = {
        recorded: true,
        finalStatus: 'SKIPPED',
      };
    } else if (webhookDispatch.status === 'QUEUED_FOR_APPS_SCRIPT_POLLER') {
      // Do NOT mark as SENT when webhook env vars are missing; keep as PENDING in email_queue
      trace.stages.stage6_final_status_recorded = {
        recorded: true,
        finalStatus: 'PENDING',
        errorMessage: webhookDispatch.error || null,
      };
    } else {
      // Webhook failed — record FAILED status in email_queue so it is visible in diagnostics and can be retried
      if (queueId) {
        await callSupabaseRpcWithFallback('record_email_dispatch_result', {
          p_queue_id: queueId,
          p_status: 'FAILED',
          p_error_message: webhookDispatch.error || 'Apps Script webhook dispatch failed',
          p_metadata: {
            error_code: webhookDispatch.errorCode || 'WEBHOOK_FAILED',
          },
        });
      }
      trace.stages.stage6_final_status_recorded = {
        recorded: true,
        finalStatus: 'FAILED',
        errorMessage: webhookDispatch.error || null,
      };
    }
  } else {
    trace.stages.stage6_final_status_recorded = {
      recorded: true,
      finalStatus: 'NOT_NEEDED',
    };
  }

  recordDiagnosticTrace(trace);

  return {
    httpStatus: 200,
    payload: {
      success: true,
      workspace: syncData,
      welcomeEmail: {
        queued: welcomeQueued,
        alreadySent,
        queueId,
        idempotencyKey: syncData?.idempotency_key || idempotencyKey,
        webhookDispatch,
      },
      diagnostics: trace,
    },
  };
}

async function resolveVerifiedOrganization(
  supabase: SupabaseClient,
  verifiedUser: VerifiedFirebaseToken
): Promise<{ organizationId: string; profileId: string }> {
  // 1. First attempt read-only lookup via get_firebase_user_email_preferences so we don't
  // prematurely consume a new user's welcome_queued flag before /api/auth/sync-workspace runs.
  const { data: prefLookup } = await callSupabaseRpcWithFallback(
    'get_firebase_user_email_preferences',
    {
      p_firebase_uid: verifiedUser.uid,
      p_email: verifiedUser.email,
    }
  );

  if (prefLookup?.found && prefLookup?.organization_id && prefLookup?.profile_id) {
    return {
      organizationId: String(prefLookup.organization_id),
      profileId: String(prefLookup.profile_id),
    };
  }

  // 2. Otherwise run canonical workspace sync AND orchestrate welcome email if newly queued
  const syncResult = await syncWorkspaceAndOrchestrateWelcomeEmail({
    verifiedUser,
    fullName: verifiedUser.name || verifiedUser.email.split('@')[0] || 'Store Procurement Lead',
    storeName: null,
    isSignup: false,
    ensureWelcomeEmail: false,
    endpointName: 'resolveVerifiedOrganization',
  });

  const syncData = syncResult.payload.workspace;
  if (syncData?.organization_id && syncData?.profile_id) {
    return {
      organizationId: String(syncData.organization_id),
      profileId: String(syncData.profile_id),
    };
  }

  // 3. Fallback direct lookup when service_role key is active
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .or(`firebase_uid.eq.${verifiedUser.uid},email.ilike.${verifiedUser.email}`)
    .limit(1)
    .maybeSingle();

  if (profile?.organization_id && profile?.id) {
    return {
      organizationId: String(profile.organization_id),
      profileId: String(profile.id),
    };
  }

  throw new Error(
    syncResult.payload.error ||
      'Unable to resolve canonical Supabase organization for authenticated Firebase user. Ensure migration 20261025_firebase_identity_and_email_automation.sql is applied.'
  );
}

export const app = express();
app.use(express.json({ limit: '1mb' }));

// Normalize Vercel Serverless rewrite URLs (/api/index?__path=...) so Express routes always match
app.use((req: Request, _res: Response, next: NextFunction) => {
  const queryPath = typeof req.query?.__path === 'string' ? req.query.__path : '';
  if (queryPath && (req.path === '/api/index' || req.path === '/index')) {
    const cleanSubpath = queryPath.replace(/^\/+/, '');
    const searchParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
    searchParams.delete('__path');
    const qs = searchParams.toString();
    req.url = `/api/${cleanSubpath}${qs ? `?${qs}` : ''}`;
  } else if (req.path === '/api/index') {
    const matchedPath = req.headers['x-matched-path'];
    const forwardedUri = req.headers['x-forwarded-uri'];
    if (typeof forwardedUri === 'string' && forwardedUri.startsWith('/api/')) {
      req.url = forwardedUri;
    } else if (
      typeof matchedPath === 'string' &&
      matchedPath.startsWith('/api/') &&
      matchedPath !== '/api/index'
    ) {
      req.url = matchedPath;
    }
  }
  next();
});

// ====================================================================
// 1. Health & Email Automation Configuration Status Endpoint
// ====================================================================
let cachedAppsScriptHealth: {
  checkedAt: number;
  reachable: boolean;
  authValid: boolean;
  remainingDailyQuota: number | null;
  errorCode: string | null;
  error: string | null;
} | null = null;

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'ReStockIQ API',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/email/status', async (req: Request, res: Response) => {
  const cfg = getServerSupabaseConfig();
  let rpcMigrationReady = false;

  try {
    const { error } = await callSupabaseRpcWithFallback('get_firebase_user_email_preferences', {
      p_firebase_uid: '__health_check__',
      p_email: '__health_check__@restockiq.local',
    });
    rpcMigrationReady = !error;
  } catch {
    rpcMigrationReady = false;
  }

  let appsScriptProbe = cachedAppsScriptHealth;
  const forceProbe = req.query.probe === '1' || req.query.probe === 'true';
  const now = Date.now();

  if (cfg.hasAppsScriptWebhook && (forceProbe || !appsScriptProbe || now - appsScriptProbe.checkedAt > 30000)) {
    const probeRes = await triggerAppsScriptWebhook({
      action: 'HEALTH_CHECK',
    });
    appsScriptProbe = {
      checkedAt: now,
      reachable: probeRes.triggered && probeRes.errorCode !== 'APPS_SCRIPT_NETWORK_ERROR',
      authValid: probeRes.dispatched && probeRes.errorCode !== 'APPS_SCRIPT_SECRET_MISMATCH',
      remainingDailyQuota:
        typeof probeRes.remainingDailyQuota === 'number' ? probeRes.remainingDailyQuota : null,
      errorCode: probeRes.errorCode || null,
      error: probeRes.error || null,
    };
    cachedAppsScriptHealth = appsScriptProbe;
  }

  res.json({
    success: true,
    firebaseTokenVerification: 'ACTIVE_RS256_X509',
    firebaseProjectId: 'stockpilotai-2dcae',
    supabaseConfigured: Boolean(cfg.supabaseUrl && cfg.activeSupabaseKey),
    supabaseServiceRoleConfigured: cfg.hasServiceRoleKey,
    supabasePublishableKeyConfigured: cfg.hasPublishableKey,
    supabaseMigration20261025Applied: rpcMigrationReady,
    appsScriptWebhookConfigured: cfg.hasAppsScriptWebhook,
    appsScriptUrlFormatValid: cfg.appsScriptUrl ? cfg.isAppsScriptUrlValidFormat : false,
    configured: {
      supabaseUrl: Boolean(cfg.supabaseUrl),
      supabaseSecretKey: cfg.hasServiceRoleKey,
      supabaseFallbackAnonKey: cfg.hasPublishableKey,
      appsScriptWebhookUrl: Boolean(cfg.appsScriptUrl),
      appsScriptWebhookSecret: Boolean(cfg.appsScriptSecret),
      appUrl: cfg.appUrl,
    },
    schedule: {
      dailyInventoryAlertTime: '10:00 AM Asia/Kolkata (IST)',
      welcomeEmailMode: cfg.hasAppsScriptWebhook
        ? 'INSTANT_WEBHOOK_AND_QUEUE_POLLER'
        : 'SUPABASE_EMAIL_QUEUE_POLLER_ONLY',
    },
    appsScriptProbe: appsScriptProbe || {
      checkedAt: null,
      reachable: false,
      authValid: false,
      remainingDailyQuota: null,
      errorCode: cfg.hasAppsScriptWebhook ? null : 'MISSING_APPS_SCRIPT_ENV',
      error: cfg.hasAppsScriptWebhook
        ? null
        : 'Configure STOCKPILOT_APPS_SCRIPT_URL and STOCKPILOT_APPS_SCRIPT_SECRET in Vercel Production Environment Variables.',
    },
    environmentVariables: cfg.explicitVariablesStatus,
    missingProductionEnvVars: cfg.missingProductionEnvVars,
    deliveryMode: cfg.hasAppsScriptWebhook
      ? 'INSTANT_WEBHOOK_AND_QUEUE_POLLER'
      : 'SUPABASE_EMAIL_QUEUE_POLLER_ONLY',
    dailyAlertSchedule: '10:00 AM Asia/Kolkata (IST)',
    recentDiagnostics: RECENT_DIAGNOSTIC_TRACES.slice(0, 10),
  });
});

// ====================================================================
// 2. Sync Verified Firebase User Workspace & Enqueue/Send Welcome Email
// ====================================================================
app.post('/api/auth/sync-workspace', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();

    if (!supabase) {
      return res.status(503).json({
        success: false,
        errorCode: 'SUPABASE_NOT_CONFIGURED',
        error: 'Supabase is not configured on the server.',
      });
    }

    const body = req.body || {};
    const fullName = String(
      body.fullName || verifiedUser.name || verifiedUser.email.split('@')[0] || 'Store Procurement Lead'
    ).trim();
    const storeName = body.storeName ? String(body.storeName).trim() : null;
    const isSignup = Boolean(body.isSignup);
    const ensureWelcomeEmail = Boolean(body.ensureWelcomeEmail);

    const result = await syncWorkspaceAndOrchestrateWelcomeEmail({
      verifiedUser,
      fullName,
      storeName,
      isSignup,
      ensureWelcomeEmail,
      endpointName: '/api/auth/sync-workspace',
    });

    return res.status(result.httpStatus).json(result.payload);
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED_FIREBASE_TOKEN',
      error: err?.message || 'Unauthorized request',
    });
  }
});

// ====================================================================
// 2B. Explicit Retry / Verification Endpoint for Pending/Failed Welcome Email
// ====================================================================
app.post('/api/email/welcome/retry', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();

    if (!supabase) {
      return res.status(503).json({
        success: false,
        errorCode: 'SUPABASE_NOT_CONFIGURED',
        error: 'Supabase is not configured on the server.',
      });
    }

    const body = req.body || {};
    const fullName = String(
      body.fullName || verifiedUser.name || verifiedUser.email.split('@')[0] || 'Store Procurement Lead'
    ).trim();
    const storeName = body.storeName ? String(body.storeName).trim() : null;

    const result = await syncWorkspaceAndOrchestrateWelcomeEmail({
      verifiedUser,
      fullName,
      storeName,
      isSignup: false,
      ensureWelcomeEmail: true,
      endpointName: '/api/email/welcome/retry',
    });

    return res.status(result.httpStatus).json(result.payload);
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED_FIREBASE_TOKEN',
      error: err?.message || 'Unauthorized request',
    });
  }
});

// ====================================================================
// 3. Get Verified User Email Preferences & Recent Delivery Logs
// ====================================================================
app.get('/api/preferences/email', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured on the server.',
      });
    }

    const { data, error } = await callSupabaseRpcWithFallback(
      'get_firebase_user_email_preferences',
      {
        p_firebase_uid: verifiedUser.uid,
        p_email: verifiedUser.email,
      }
    );

    if (error) {
      const isMissingRpc =
        error.message?.includes('get_firebase_user_email_preferences') ||
        error.code === 'PGRST202' ||
        error.code === '42883';
      return res.status(200).json({
        success: false,
        migrationRequired: isMissingRpc,
        error: isMissingRpc
          ? 'Run migration 20261025_firebase_identity_and_email_automation.sql in Supabase SQL Editor to enable Firebase email preferences.'
          : error.message,
      });
    }

    return res.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: err?.message || 'Unauthorized request',
    });
  }
});

// ====================================================================
// 4. Update Verified User Email Preferences
// ====================================================================
app.put('/api/preferences/email', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured on the server.',
      });
    }

    const body = req.body || {};

    // Ensure workspace profile exists first
    await callSupabaseRpcWithFallback('sync_firebase_workspace_and_welcome', {
      p_firebase_uid: verifiedUser.uid,
      p_email: verifiedUser.email,
      p_full_name: verifiedUser.name || verifiedUser.email.split('@')[0],
      p_store_name: null,
      p_provider: verifiedUser.signInProvider,
      p_avatar_url: verifiedUser.picture || '',
      p_is_signup: false,
    });

    const { data, error } = await callSupabaseRpcWithFallback(
      'update_firebase_user_email_preferences',
      {
        p_firebase_uid: verifiedUser.uid,
        p_email: verifiedUser.email,
        p_stockout_alerts: Boolean(body.stockout_alerts ?? true),
        p_price_change_alerts: Boolean(body.price_change_alerts ?? true),
        p_pending_approval_digest: Boolean(body.pending_approval_digest ?? true),
        p_daily_inventory_alerts: Boolean(body.daily_inventory_alerts ?? true),
        p_weekly_briefing: Boolean(body.weekly_briefing ?? true),
        p_frequency: String(body.frequency || 'INSTANT'),
      }
    );

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: err?.message || 'Unauthorized request',
    });
  }
});

// ====================================================================
// 5. Tenant-Scoped Workspace Operational Data Endpoints (Verified Firebase Auth)
// ====================================================================
app.get('/api/workspace/snapshot', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase is not configured on the server.' });
    }

    // Try dedicated snapshot RPC first
    const { data: rpcSnapshot, error: rpcErr } = await callSupabaseRpcWithFallback(
      'get_firebase_workspace_snapshot',
      {
        p_firebase_uid: verifiedUser.uid,
        p_email: verifiedUser.email,
      }
    );

    if (!rpcErr && rpcSnapshot?.found) {
      return res.json({
        success: true,
        organizationId: rpcSnapshot.organization_id,
        inventory: rpcSnapshot.inventory_items || [],
        suppliers: rpcSnapshot.suppliers || [],
        orders: rpcSnapshot.incoming_orders || [],
        requests: rpcSnapshot.reorder_requests || [],
        auditEvents: rpcSnapshot.audit_events || [],
      });
    }

    const { organizationId } = await resolveVerifiedOrganization(supabase, verifiedUser);
    const [invRes, supRes, ordRes, reqRes, audRes] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('organization_id', organizationId).order('sku', { ascending: true }),
      supabase.from('suppliers').select('*').eq('organization_id', organizationId).order('name', { ascending: true }),
      supabase.from('incoming_orders').select('*').eq('organization_id', organizationId).order('expected_arrival_date', { ascending: true }),
      supabase.from('reorder_requests').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('audit_events').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100),
    ]);

    return res.json({
      success: true,
      organizationId,
      inventory: invRes.data || [],
      suppliers: supRes.data || [],
      orders: ordRes.data || [],
      requests: reqRes.data || [],
      auditEvents: audRes.data || [],
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: err?.message || 'Unauthorized workspace snapshot request',
    });
  }
});

app.post('/api/workspace/inventory', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();
    if (!supabase) return res.status(503).json({ success: false, error: 'Supabase not configured' });

    const { organizationId } = await resolveVerifiedOrganization(supabase, verifiedUser);
    const item = req.body || {};

    const payload = {
      id: item.id || `INV-${Date.now()}`,
      organization_id: organizationId,
      sku: String(item.sku || '').trim(),
      name: String(item.name || item.sku || '').trim(),
      category: String(item.category || 'General').trim(),
      supplier_id: item.supplierId || null,
      current_stock: Math.round(Number(item.currentStock || 0)),
      reserved_stock: Math.round(Number(item.reservedStock || 0)),
      average_daily_sales: Number(item.averageDailySales || 0),
      lead_time_days: Math.max(1, Number(item.leadTimeDays || 7)),
      safety_stock: Math.round(Number(item.safetyStock || 0)),
      reorder_threshold: Math.round(Number(item.reorderThreshold || 0)),
      unit_price: Number(item.unitPrice || 0),
      source_record_id: item.sourceRecordId || item.sku,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('inventory_items')
      .upsert(payload, { onConflict: 'organization_id,sku' })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, item: data });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err?.message || 'Unauthorized' });
  }
});

app.post('/api/workspace/suppliers', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();
    if (!supabase) return res.status(503).json({ success: false, error: 'Supabase not configured' });

    const { organizationId } = await resolveVerifiedOrganization(supabase, verifiedUser);
    const supplier = req.body || {};

    const fullPayload = {
      id: String(supplier.id || `SUP-${Date.now().toString().slice(-4)}`),
      organization_id: organizationId,
      name: String(supplier.name || '').trim(),
      contact_name: supplier.contactInformation?.representative || 'Vendor Contact',
      contact_email: supplier.contactInformation?.email || 'vendor@example.com',
      contact_phone: supplier.contactInformation?.phone || '',
      address: supplier.contactInformation?.address || '',
      lead_time_days: Math.max(1, Number(supplier.leadTimeDays || 5)),
      pack_size: Math.max(1, Number(supplier.packSize || 1)),
      minimum_order_quantity: Math.max(1, Number(supplier.minimumOrderQuantity || 1)),
      current_unit_price: Math.max(0.01, Number(supplier.currentUnitPrice || 1)),
      previous_unit_price: Math.max(0.01, Number(supplier.previousUnitPrice || supplier.currentUnitPrice || 1)),
      status: supplier.status || 'Active',
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('suppliers').upsert(fullPayload);
    if (error && error.message?.includes('column')) {
      const basePayload = {
        id: fullPayload.id,
        organization_id: organizationId,
        name: fullPayload.name,
        contact_email: fullPayload.contact_email,
        lead_time_days: fullPayload.lead_time_days,
        pack_size: fullPayload.pack_size,
        minimum_order_quantity: fullPayload.minimum_order_quantity,
        current_unit_price: fullPayload.current_unit_price,
        previous_unit_price: fullPayload.previous_unit_price,
        updated_at: fullPayload.updated_at,
      };
      const retry = await supabase.from('suppliers').upsert(basePayload);
      error = retry.error;
    }

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err?.message || 'Unauthorized' });
  }
});

app.post('/api/workspace/orders', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();
    if (!supabase) return res.status(503).json({ success: false, error: 'Supabase not configured' });

    const { organizationId } = await resolveVerifiedOrganization(supabase, verifiedUser);
    const order = req.body || {};

    const fullPayload = {
      id: String(order.id || `PO-${Date.now().toString().slice(-6)}`),
      organization_id: organizationId,
      sku: String(order.sku || '').trim(),
      supplier_id: String(order.supplierId || ''),
      ordered_quantity: Math.max(1, Number(order.orderedQuantity || 1)),
      received_quantity: Math.max(0, Number(order.orderedQuantity || 0) - Number(order.remainingOpenQuantity || 0)),
      remaining_open_quantity: Math.max(0, Number(order.remainingOpenQuantity ?? order.orderedQuantity ?? 0)),
      expected_arrival_date: order.expectedArrivalDate || new Date().toISOString().split('T')[0],
      status: order.status || 'Confirmed',
      source_record_id: order.sourceRecordId || order.id,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('incoming_orders').upsert(fullPayload);
    if (error) {
      const basePayload = {
        id: fullPayload.id,
        organization_id: organizationId,
        sku: fullPayload.sku,
        supplier_id: fullPayload.supplier_id,
        ordered_quantity: fullPayload.ordered_quantity,
        remaining_open_quantity: fullPayload.remaining_open_quantity,
        expected_arrival_date: fullPayload.expected_arrival_date,
        status: fullPayload.status === 'Ordered' ? 'Confirmed' : fullPayload.status === 'In Transit' ? 'Shipped' : fullPayload.status,
        updated_at: fullPayload.updated_at,
      };
      const retry = await supabase.from('incoming_orders').upsert(basePayload);
      error = retry.error;
    }

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err?.message || 'Unauthorized' });
  }
});

app.post('/api/workspace/requests', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();
    if (!supabase) return res.status(503).json({ success: false, error: 'Supabase not configured' });

    const { organizationId } = await resolveVerifiedOrganization(supabase, verifiedUser);
    const request = req.body || {};

    const fullPayload = {
      id: String(request.id || `REQ-${Date.now().toString().slice(-6)}`),
      organization_id: organizationId,
      sku: String(request.sku || ''),
      product_name: String(request.productName || request.sku || ''),
      supplier_id: String(request.supplierId || ''),
      supplier_name: String(request.supplierName || request.supplierId || ''),
      proposed_quantity: Math.max(1, Number(request.proposedQuantity || 1)),
      case_count: Math.max(1, Number(request.caseCount || 1)),
      unit_price: Number(request.unitPrice || 0),
      total_cost: Number(request.totalCost || 0),
      forecast_demand: Number(request.forecastDemand || 0),
      incoming_quantity_considered: Number(request.incomingQuantityConsidered || 0),
      reason: String(request.reason || ''),
      budget_status: request.budgetStatus || 'Normal',
      status: request.status || 'Pending Approval',
      idempotency_key: request.idempotencyKey || null,
      source_evidence_ids: Array.isArray(request.sourceEvidenceIds) ? request.sourceEvidenceIds : [],
      created_at: request.createdAt || new Date().toISOString(),
    };

    let { error } = await supabase.from('reorder_requests').upsert(fullPayload);
    if (error && error.message?.includes('column')) {
      const basePayload = {
        id: fullPayload.id,
        organization_id: organizationId,
        sku: fullPayload.sku,
        product_name: fullPayload.product_name,
        supplier_id: fullPayload.supplier_id,
        proposed_quantity: fullPayload.proposed_quantity,
        total_cost: fullPayload.total_cost,
        status: fullPayload.status,
        reason: fullPayload.reason,
        idempotency_key: fullPayload.idempotency_key,
        source_evidence_ids: fullPayload.source_evidence_ids,
        created_at: fullPayload.created_at,
      };
      const retry = await supabase.from('reorder_requests').upsert(basePayload);
      error = retry.error;
    }

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err?.message || 'Unauthorized' });
  }
});

app.patch('/api/workspace/requests/:id/status', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();
    if (!supabase) return res.status(503).json({ success: false, error: 'Supabase not configured' });

    const { organizationId } = await resolveVerifiedOrganization(supabase, verifiedUser);
    const requestId = String(req.params.id || '');
    const { newStatus, comment } = req.body || {};

    const statusMap: Record<string, string> = {
      approved: 'Approved',
      rejected: 'Rejected',
      'pending approval': 'Pending Approval',
      'needs budget review': 'Needs Budget Review',
      'returned for changes': 'Returned For Changes',
      verified: 'Verified',
      draft: 'Draft',
    };
    const cleanStatus = statusMap[String(newStatus || '').toLowerCase().trim()] || newStatus;

    const { error } = await supabase
      .from('reorder_requests')
      .update({
        status: cleanStatus,
        review_comment: comment,
        rejection_reason: cleanStatus === 'Rejected' ? comment : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('organization_id', organizationId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err?.message || 'Unauthorized' });
  }
});

app.post('/api/workspace/audit', async (req: Request, res: Response) => {
  try {
    const verifiedUser = await authenticateRequest(req);
    const supabase = getServerSupabase();
    if (!supabase) return res.status(503).json({ success: false, error: 'Supabase not configured' });

    const { organizationId } = await resolveVerifiedOrganization(supabase, verifiedUser);
    const event = req.body || {};

    const { error } = await supabase.from('audit_events').insert({
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: organizationId,
      actor: event.actor || verifiedUser.name || verifiedUser.email,
      actor_email: verifiedUser.email,
      action: String(event.action || 'WORKSPACE_EVENT'),
      entity_type: String(event.entityType || 'INVENTORY'),
      entity_id: String(event.entityId || ''),
      previous_state: event.previousState || 'None',
      new_state: String(event.newState || ''),
      reason: String(event.reason || ''),
      evidence_ids: Array.isArray(event.evidenceIds) ? event.evidenceIds : [],
      execution_mode: 'DETERMINISTIC_RULES',
      created_at: new Date().toISOString(),
    });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err?.message || 'Unauthorized' });
  }
});

// ====================================================================
// 6. Local Dev / Standalone Server Runtime (Skipped on Vercel Serverless)
// ====================================================================
async function startStandaloneServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const viteModuleId = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ viteModuleId);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReStockIQ full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

const isVercelServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const isDirectExecution = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))
);
if (!isVercelServerless && isDirectExecution && process.env.NODE_ENV !== 'test') {
  startStandaloneServer().catch((err) => {
    console.error('Failed to start ReStockIQ server:', err);
    process.exit(1);
  });
}

export default app;
