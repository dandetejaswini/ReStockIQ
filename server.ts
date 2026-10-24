import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyFirebaseIdToken, VerifiedFirebaseToken } from './src/server/firebaseVerifier';

const PORT = Number(process.env.PORT || 3000);

export function getServerSupabaseConfig() {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  const serviceRoleKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const appsScriptUrl = (
    process.env.STOCKPILOT_APPS_SCRIPT_URL ||
    process.env.APPS_SCRIPT_WEB_APP_URL ||
    ''
  ).trim();

  const appsScriptSecret = (
    process.env.STOCKPILOT_APPS_SCRIPT_SECRET || ''
  ).trim();

  const appUrl = (
    process.env.STOCKPILOT_APP_URL ||
    process.env.APP_URL ||
    ''
  ).trim();

  return {
    supabaseUrl,
    serviceRoleKey,
    publishableKey,
    activeSupabaseKey: serviceRoleKey || publishableKey,
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasAppsScriptWebhook: Boolean(appsScriptUrl && appsScriptSecret),
    appsScriptUrl,
    appsScriptSecret,
    appUrl,
  };
}

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedKeyUsed = '';

function getServerSupabase(): SupabaseClient | null {
  const cfg = getServerSupabaseConfig();
  if (!cfg.supabaseUrl || !cfg.activeSupabaseKey) {
    return null;
  }
  if (cachedSupabaseClient && cachedKeyUsed === cfg.activeSupabaseKey) {
    return cachedSupabaseClient;
  }
  cachedKeyUsed = cfg.activeSupabaseKey;
  cachedSupabaseClient = createClient(cfg.supabaseUrl, cfg.activeSupabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedSupabaseClient;
}

async function authenticateRequest(req: Request): Promise<VerifiedFirebaseToken> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Authorization Bearer token');
  }
  return verifyFirebaseIdToken(authHeader);
}

async function resolveVerifiedOrganization(
  supabase: SupabaseClient,
  verifiedUser: VerifiedFirebaseToken
): Promise<{ organizationId: string; profileId: string }> {
  // First attempt canonical workspace sync/lookup RPC
  const { data: syncData, error: rpcError } = await supabase.rpc(
    'sync_firebase_workspace_and_welcome',
    {
      p_firebase_uid: verifiedUser.uid,
      p_email: verifiedUser.email,
      p_full_name: verifiedUser.name || verifiedUser.email.split('@')[0] || 'Store Procurement Lead',
      p_store_name: null,
      p_provider: verifiedUser.signInProvider,
      p_avatar_url: verifiedUser.picture || '',
      p_is_signup: false,
    }
  );

  if (!rpcError && syncData?.organization_id && syncData?.profile_id) {
    return {
      organizationId: String(syncData.organization_id),
      profileId: String(syncData.profile_id),
    };
  }

  // Fallback direct lookup when service_role key is active
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
    rpcError?.message ||
      'Unable to resolve canonical Supabase organization for authenticated Firebase user. Ensure migration 20261025_firebase_identity_and_email_automation.sql is applied.'
  );
}

async function triggerAppsScriptWebhook(payload: Record<string, any>): Promise<{
  triggered: boolean;
  dispatched: boolean;
  status?: string;
  error?: string;
}> {
  const cfg = getServerSupabaseConfig();
  if (!cfg.hasAppsScriptWebhook) {
    return {
      triggered: false,
      dispatched: false,
      status: 'QUEUED_FOR_APPS_SCRIPT_POLLER',
    };
  }

  try {
    const res = await fetch(cfg.appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        secret: cfg.appsScriptSecret,
      }),
      redirect: 'follow',
    });

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok || parsed?.success === false) {
      return {
        triggered: true,
        dispatched: false,
        status: 'FAILED',
        error: parsed?.error || `Apps Script webhook HTTP ${res.status}`,
      };
    }

    return {
      triggered: true,
      dispatched: true,
      status: parsed?.status || 'SENT',
    };
  } catch (err: any) {
    return {
      triggered: true,
      dispatched: false,
      status: 'FAILED',
      error: err?.message || 'Failed to reach Apps Script webhook URL',
    };
  }
}

export const app = express();
app.use(express.json({ limit: '1mb' }));

// ====================================================================
// 1. Health & Email Automation Configuration Status Endpoint
// ====================================================================
app.get('/api/email/status', async (_req: Request, res: Response) => {
  const cfg = getServerSupabaseConfig();
  const supabase = getServerSupabase();
  let rpcMigrationReady = false;

  if (supabase) {
    try {
      const { error } = await supabase.rpc('get_firebase_user_email_preferences', {
        p_firebase_uid: '__health_check__',
        p_email: '__health_check__@restockiq.local',
      });
      rpcMigrationReady = !error;
    } catch {
      rpcMigrationReady = false;
    }
  }

  res.json({
    success: true,
    firebaseTokenVerification: 'ACTIVE_RS256_X509',
    firebaseProjectId: 'stockpilotai-2dcae',
    supabaseConfigured: Boolean(cfg.supabaseUrl && cfg.activeSupabaseKey),
    supabaseServiceRoleConfigured: cfg.hasServiceRoleKey,
    supabaseMigration20261025Applied: rpcMigrationReady,
    appsScriptWebhookConfigured: cfg.hasAppsScriptWebhook,
    deliveryMode: cfg.hasAppsScriptWebhook
      ? 'INSTANT_WEBHOOK_AND_QUEUE_POLLER'
      : 'SUPABASE_EMAIL_QUEUE_POLLER',
    dailyAlertSchedule: '10:00 AM Asia/Kolkata (IST)',
  });
});

// ====================================================================
// 2. Sync Verified Firebase User Workspace & Enqueue Welcome Email
// ====================================================================
app.post('/api/auth/sync-workspace', async (req: Request, res: Response) => {
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
    const fullName = String(
      body.fullName || verifiedUser.name || verifiedUser.email.split('@')[0] || 'Store Procurement Lead'
    ).trim();
    const storeName = body.storeName ? String(body.storeName).trim() : null;
    const isSignup = Boolean(body.isSignup);

    const { data: syncData, error: rpcError } = await supabase.rpc(
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

      return res.status(200).json({
        success: false,
        migrationRequired: isMissingRpc,
        firebaseUid: verifiedUser.uid,
        email: verifiedUser.email,
        error: isMissingRpc
          ? 'Supabase migration 20261025_firebase_identity_and_email_automation.sql has not been applied yet.'
          : rpcError.message,
      });
    }

    let webhookDispatch = null;
    if (syncData?.welcome_queued && syncData?.queue_id) {
      webhookDispatch = await triggerAppsScriptWebhook({
        action: 'SEND_WELCOME_EMAIL',
        queueId: syncData.queue_id,
        firebaseUid: verifiedUser.uid,
        email: verifiedUser.email,
        fullName,
        organizationId: syncData.organization_id,
        storeName: syncData.organization_name,
        idempotencyKey: syncData.idempotency_key,
      });
    }

    return res.json({
      success: true,
      workspace: syncData,
      welcomeEmail: {
        queued: Boolean(syncData?.welcome_queued),
        queueId: syncData?.queue_id || null,
        idempotencyKey: syncData?.idempotency_key || null,
        webhookDispatch,
      },
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
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

    const { data, error } = await supabase.rpc('get_firebase_user_email_preferences', {
      p_firebase_uid: verifiedUser.uid,
      p_email: verifiedUser.email,
    });

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
    await supabase.rpc('sync_firebase_workspace_and_welcome', {
      p_firebase_uid: verifiedUser.uid,
      p_email: verifiedUser.email,
      p_full_name: verifiedUser.name || verifiedUser.email.split('@')[0],
      p_store_name: null,
      p_provider: verifiedUser.signInProvider,
      p_avatar_url: verifiedUser.picture || '',
      p_is_signup: false,
    });

    const { data, error } = await supabase.rpc('update_firebase_user_email_preferences', {
      p_firebase_uid: verifiedUser.uid,
      p_email: verifiedUser.email,
      p_stockout_alerts: Boolean(body.stockout_alerts ?? true),
      p_price_change_alerts: Boolean(body.price_change_alerts ?? true),
      p_pending_approval_digest: Boolean(body.pending_approval_digest ?? true),
      p_daily_inventory_alerts: Boolean(body.daily_inventory_alerts ?? true),
      p_weekly_briefing: Boolean(body.weekly_briefing ?? true),
      p_frequency: String(body.frequency || 'INSTANT'),
    });

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
    const { data: rpcSnapshot, error: rpcErr } = await supabase.rpc('get_firebase_workspace_snapshot', {
      p_firebase_uid: verifiedUser.uid,
      p_email: verifiedUser.email,
    });

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
    const { createServer: createViteServer } = await import('vite');
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

const isVercelServerless = Boolean(process.env.VERCEL === '1' || process.env.VERCEL_ENV);
if (!isVercelServerless && process.env.NODE_ENV !== 'test') {
  startStandaloneServer().catch((err) => {
    console.error('Failed to start ReStockIQ server:', err);
    process.exit(1);
  });
}

export default app;
