import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getBackendConfig } from './config';
import { InventoryItem, Supplier, IncomingOrder, ReorderRequest, AuditEvent, User } from '../types';
import { auth } from '../lib/firebase';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const config = getBackendConfig();
  if (config.isSupabaseConfigured && config.supabaseUrl && config.supabaseAnonKey) {
    try {
      supabaseInstance = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      return supabaseInstance;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return null;
}

export function isSupabaseReady(): boolean {
  return getSupabase() !== null;
}

export function getSupabaseConfigError(): string | null {
  const config = getBackendConfig();
  return config.configError;
}

export async function hasActiveSupabaseSession(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { data: { session } } = await client.auth.getSession();
    return Boolean(session?.user);
  } catch {
    return false;
  }
}

// ====================================================================
// ROW MAPPERS (Shared Between Verified Server Snapshot & Direct Client)
// ====================================================================

function mapInventoryRow(row: any): InventoryItem {
  return {
    id: row.id,
    sku: row.sku,
    name: row.title || row.name || row.sku,
    category: row.category || 'General',
    supplierId: row.primary_supplier_id || row.supplier_id || '',
    currentStock: Number(row.current_stock || 0),
    reservedStock: Number(row.reserved_stock || 0),
    averageDailySales: Number(row.daily_demand_rate || row.average_daily_sales || 0),
    salesHistory: Array.isArray(row.sales_history) ? row.sales_history : [],
    leadTimeDays: Number(row.lead_time_days || 7),
    safetyStock: Number(row.safety_stock || 0),
    reorderThreshold: Number(row.reorder_point || row.reorder_threshold || 0),
    unitPrice: Number(row.unit_cost || row.unit_price || 0),
    updatedAt: row.updated_at || new Date().toISOString(),
    sourceType: 'MANUAL_ENTRY',
    sourceRecordId: row.source_record_id || row.sku,
  };
}

function mapSupplierRow(row: any): Supplier {
  return {
    id: row.id || row.code,
    name: row.name,
    contactInformation: {
      representative: row.contact_name || row.representative || 'Vendor Contact',
      email: row.contact_email || row.email || '',
      phone: row.contact_phone || row.phone || '',
      address: row.address || '',
    },
    leadTimeDays: Number(row.lead_time_days || 5),
    packSize: Number(row.pack_size || 1),
    minimumOrderQuantity: Number(row.minimum_order_quantity || row.moq || 1),
    currentUnitPrice: Number(row.current_unit_price || row.unit_price || 0),
    previousUnitPrice: Number(row.previous_unit_price || row.current_unit_price || 0),
    priceHistory: Array.isArray(row.price_history) ? row.price_history : [],
    status: row.status || 'Active',
  };
}

function mapIncomingOrderRow(row: any): IncomingOrder {
  return {
    id: row.id || row.po_number,
    sku: row.sku,
    supplierId: row.supplier_id,
    orderedQuantity: Number(row.ordered_quantity || 0),
    remainingOpenQuantity: Number(row.remaining_open_quantity ?? row.ordered_quantity ?? 0),
    expectedArrivalDate: row.expected_arrival_date || new Date().toISOString().split('T')[0],
    status: row.status || 'Ordered',
    sourceRecordId: row.source_record_id || row.id,
    orderDate: row.order_date || row.created_at?.slice(0, 10) || new Date().toISOString().split('T')[0],
  };
}

function mapReorderRequestRow(row: any): ReorderRequest {
  return {
    id: row.id,
    sku: row.sku,
    productName: row.product_name || row.sku,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name || row.supplier_id,
    proposedQuantity: Number(row.proposed_quantity || 0),
    caseCount: Number(row.case_count || 1),
    unitPrice: Number(row.unit_price || 0),
    totalCost: Number(row.total_cost || 0),
    forecastDemand: Number(row.forecast_demand || 0),
    incomingQuantityConsidered: Number(row.incoming_quantity_considered || 0),
    reason: row.reason || '',
    budgetStatus: row.budget_status || 'Normal',
    status: row.status || 'Pending Approval',
    createdAt: row.created_at || new Date().toISOString(),
    idempotencyKey: row.idempotency_key || `KEY-${row.id}`,
    sourceEvidenceIds: Array.isArray(row.source_evidence_ids) ? row.source_evidence_ids : [],
    reviewComment: row.review_comment,
    rejectionReason: row.rejection_reason,
  };
}

function mapAuditEventRow(row: any): AuditEvent {
  return {
    id: row.id,
    timestamp: row.created_at || new Date().toISOString(),
    actor: row.actor || row.actor_email || 'Authenticated User',
    action: row.action,
    entityType: row.entity_type || 'INVENTORY',
    entityId: row.entity_id || '',
    previousState: row.previous_state || 'None',
    newState: row.new_state || '',
    reason: row.reason || '',
    evidenceIds: Array.isArray(row.evidence_ids) ? row.evidence_ids : [],
    executionMode: 'BACKEND_AUTHORITATIVE',
  };
}

interface WorkspaceSnapshot {
  inventory: InventoryItem[];
  suppliers: Supplier[];
  orders: IncomingOrder[];
  requests: ReorderRequest[];
  auditEvents: AuditEvent[];
}

let inflightSnapshotPromise: Promise<WorkspaceSnapshot | null> | null = null;
let cachedSnapshot: { uid: string; expiresAt: number; data: WorkspaceSnapshot } | null = null;

async function fetchFirebaseVerifiedSnapshot(): Promise<WorkspaceSnapshot | null> {
  const fbUser = auth.currentUser;
  if (!fbUser) return null;

  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.uid === fbUser.uid && now < cachedSnapshot.expiresAt) {
    return cachedSnapshot.data;
  }

  if (inflightSnapshotPromise) {
    return inflightSnapshotPromise;
  }

  inflightSnapshotPromise = (async () => {
    try {
      const idToken = await fbUser.getIdToken();
      const res = await fetch('/api/workspace/snapshot', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) {
          const snapshot: WorkspaceSnapshot = {
            inventory: (json.inventory || []).map(mapInventoryRow),
            suppliers: (json.suppliers || []).map(mapSupplierRow),
            orders: (json.orders || []).map(mapIncomingOrderRow),
            requests: (json.requests || []).map(mapReorderRequestRow),
            auditEvents: (json.auditEvents || []).map(mapAuditEventRow),
          };
          cachedSnapshot = {
            uid: fbUser.uid,
            expiresAt: Date.now() + 2000,
            data: snapshot,
          };
          return snapshot;
        }
      }
    } catch {
      // Fallback to direct Supabase RPC / client
    }

    const client = getSupabase();
    if (client && fbUser.email) {
      try {
        const { data, error } = await client.rpc('get_firebase_workspace_snapshot', {
          p_firebase_uid: fbUser.uid,
          p_email: fbUser.email,
        });
        if (!error && data?.found) {
          const snapshot: WorkspaceSnapshot = {
            inventory: (data.inventory_items || []).map(mapInventoryRow),
            suppliers: (data.suppliers || []).map(mapSupplierRow),
            orders: (data.incoming_orders || []).map(mapIncomingOrderRow),
            requests: (data.reorder_requests || []).map(mapReorderRequestRow),
            auditEvents: (data.audit_events || []).map(mapAuditEventRow),
          };
          cachedSnapshot = {
            uid: fbUser.uid,
            expiresAt: Date.now() + 2000,
            data: snapshot,
          };
          return snapshot;
        }
      } catch {
        // Ignore if RPC not yet applied
      }
    }

    return null;
  })().finally(() => {
    inflightSnapshotPromise = null;
  });

  return inflightSnapshotPromise;
}

function invalidateSnapshotCache() {
  cachedSnapshot = null;
}

// ====================================================================
// AUTHENTICATION OPERATIONS
// ====================================================================

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  sessionConfirmed?: boolean;
}

export async function signUpUser(
  email: string,
  password: string,
  fullName: string,
  companyName?: string
): Promise<AuthResult> {
  const config = getBackendConfig();
  if (config.isMisconfigured) {
    return {
      success: false,
      error: `Supabase configuration error: ${config.configError}`
    };
  }

  const client = getSupabase();
  if (!client) {
    return {
      success: false,
      error: 'Supabase is not configured. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) are set in your environment.'
    };
  }

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName || `${fullName}'s Store`,
          firebase_uid: auth.currentUser?.uid || undefined,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      const sessionConfirmed = Boolean(data.session);

      const userProfile: User = {
        id: data.user.id,
        name: fullName,
        email: data.user.email || email,
        role: 'Store Procurement Lead',
        avatar: '',
        isDemoUser: false,
      };

      return {
        success: true,
        user: userProfile,
        sessionConfirmed,
      };
    }

    return { success: false, error: 'Registration did not return a valid user.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred during signup.' };
  }
}

export async function signInUser(
  email: string,
  password: string
): Promise<AuthResult> {
  const config = getBackendConfig();
  if (config.isMisconfigured) {
    return {
      success: false,
      error: `Supabase configuration error: ${config.configError}`
    };
  }

  const client = getSupabase();
  if (!client) {
    return {
      success: false,
      error: 'Supabase is not configured. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) are set in your environment.'
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      let profileName = data.user.user_metadata?.full_name || email.split('@')[0];
      let profileRole = 'Store Procurement Lead';
      let avatarUrl = '';

      try {
        const { data: profile } = await client
          .from('profiles')
          .select('full_name, role, avatar_url, organization_id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile) {
          if (profile.full_name) profileName = profile.full_name;
          if (profile.role) profileRole = profile.role;
          if (profile.avatar_url) avatarUrl = profile.avatar_url;
        }
      } catch (profileErr) {
        console.warn('Profile fetch warning (migrations may be pending):', profileErr);
      }

      const userProfile: User = {
        id: data.user.id,
        name: profileName,
        email: data.user.email || email,
        role: profileRole,
        avatar: avatarUrl,
        isDemoUser: false,
      };

      return {
        success: true,
        user: userProfile,
        sessionConfirmed: true,
      };
    }

    return { success: false, error: 'Invalid authentication credentials.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred during login.' };
  }
}

export async function signOutUser(): Promise<{ success: boolean; error?: string }> {
  invalidateSnapshotCache();
  const client = getSupabase();
  if (!client) return { success: true };

  try {
    const { error } = await client.auth.signOut();
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCurrentUserProfile(): Promise<User | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session?.user) return null;

    let profileName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';
    let profileRole = 'Store Procurement Lead';
    let avatarUrl = '';

    try {
      const { data: profile } = await client
        .from('profiles')
        .select('full_name, role, avatar_url, organization_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        if (profile.full_name) profileName = profile.full_name;
        if (profile.role) profileRole = profile.role;
        if (profile.avatar_url) avatarUrl = profile.avatar_url;
      }
    } catch {
      // Ignore if profiles table is not yet created
    }

    return {
      id: session.user.id,
      name: profileName,
      email: session.user.email || '',
      role: profileRole,
      avatar: avatarUrl,
      isDemoUser: false,
    };
  } catch (err) {
    console.warn('Error fetching active session profile:', err);
    return null;
  }
}

// ====================================================================
// DATABASE OPERATIONS (Tenant-Scoped via Verified Server or RLS Client)
// ====================================================================

export async function fetchInventoryItems(): Promise<{ 
  items: InventoryItem[]; 
  isConnected: boolean; 
  migrationRequired?: boolean;
  error?: string; 
}> {
  const config = getBackendConfig();
  if (config.isMisconfigured) {
    return { items: [], isConnected: false, error: config.configError || 'Supabase configuration error' };
  }

  const fbSnapshot = await fetchFirebaseVerifiedSnapshot();
  if (fbSnapshot) {
    return { items: fbSnapshot.inventory, isConnected: true };
  }

  const client = getSupabase();
  if (!client) return { items: [], isConnected: false };

  try {
    const { data, error } = await client
      .from('inventory_items')
      .select('*')
      .order('sku', { ascending: true });

    if (error) {
      const isMissingTable = error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist');
      return { 
        items: [], 
        isConnected: true, 
        migrationRequired: isMissingTable,
        error: isMissingTable 
          ? `Supabase table "public.inventory_items" does not exist yet. Please run the SQL migrations in the Supabase SQL Editor.` 
          : error.message 
      };
    }

    return { items: (data || []).map(mapInventoryRow), isConnected: true };
  } catch (err: any) {
    return { items: [], isConnected: false, error: err.message };
  }
}

export async function persistInventoryItem(
  item: Omit<InventoryItem, 'id' | 'updatedAt' | 'sourceType'> & { id?: string }
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  invalidateSnapshotCache();

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/workspace/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.item) {
          return { success: true, item: mapInventoryRow(json.item) };
        }
      }
    } catch {
      // Fallback to direct client
    }
  }

  const client = getSupabase();
  if (!client) return { success: false, error: 'Database not configured' };

  try {
    const { data: profile } = await client
      .from('profiles')
      .select('organization_id')
      .maybeSingle();

    if (!profile?.organization_id) {
      return { success: false, error: 'User profile does not belong to an authorized Supabase organization or tables are not yet migrated.' };
    }

    const payload = {
      id: item.id || `INV-${Date.now()}`,
      organization_id: profile.organization_id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      supplier_id: item.supplierId,
      current_stock: Math.round(item.currentStock),
      reserved_stock: Math.round(item.reservedStock || 0),
      average_daily_sales: item.averageDailySales,
      lead_time_days: item.leadTimeDays,
      safety_stock: Math.round(item.safetyStock),
      reorder_threshold: Math.round(item.reorderThreshold),
      unit_price: item.unitPrice,
      source_record_id: item.sourceRecordId || item.sku,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('inventory_items')
      .upsert(payload, { onConflict: 'organization_id,sku' })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, item: mapInventoryRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchSuppliers(): Promise<{ suppliers: Supplier[]; error?: string }> {
  const fbSnapshot = await fetchFirebaseVerifiedSnapshot();
  if (fbSnapshot) {
    return { suppliers: fbSnapshot.suppliers };
  }

  const client = getSupabase();
  if (!client) return { suppliers: [] };

  try {
    const { data, error } = await client
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) return { suppliers: [], error: error.message };
    return { suppliers: (data || []).map(mapSupplierRow) };
  } catch (err: any) {
    return { suppliers: [], error: err.message };
  }
}

export async function persistSupplier(supplier: Supplier): Promise<{ success: boolean; error?: string }> {
  invalidateSnapshotCache();

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/workspace/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(supplier),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) return { success: true };
      }
    } catch {
      // Fallback to direct client
    }
  }

  const client = getSupabase();
  if (!client) return { success: false, error: 'Database not configured' };

  try {
    const { data: profile } = await client
      .from('profiles')
      .select('organization_id')
      .maybeSingle();

    if (!profile?.organization_id) {
      return { success: false, error: 'User profile does not belong to an authorized Supabase organization.' };
    }

    const { error } = await client
      .from('suppliers')
      .upsert({
        id: supplier.id,
        organization_id: profile.organization_id,
        name: supplier.name,
        contact_name: supplier.contactInformation.representative,
        contact_email: supplier.contactInformation.email,
        contact_phone: supplier.contactInformation.phone,
        address: supplier.contactInformation.address,
        lead_time_days: supplier.leadTimeDays,
        pack_size: supplier.packSize,
        minimum_order_quantity: supplier.minimumOrderQuantity,
        current_unit_price: supplier.currentUnitPrice,
        previous_unit_price: supplier.previousUnitPrice,
        status: supplier.status,
        updated_at: new Date().toISOString(),
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchIncomingOrders(): Promise<{ orders: IncomingOrder[]; error?: string }> {
  const fbSnapshot = await fetchFirebaseVerifiedSnapshot();
  if (fbSnapshot) {
    return { orders: fbSnapshot.orders };
  }

  const client = getSupabase();
  if (!client) return { orders: [] };

  try {
    const { data, error } = await client
      .from('incoming_orders')
      .select('*')
      .order('expected_arrival_date', { ascending: true });

    if (error) return { orders: [], error: error.message };
    return { orders: (data || []).map(mapIncomingOrderRow) };
  } catch (err: any) {
    return { orders: [], error: err.message };
  }
}

export async function persistIncomingOrder(order: IncomingOrder): Promise<{ success: boolean; error?: string }> {
  invalidateSnapshotCache();

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/workspace/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(order),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) return { success: true };
      }
    } catch {
      // Fallback to direct client
    }
  }

  const client = getSupabase();
  if (!client) return { success: false, error: 'Database not configured' };

  try {
    const { data: profile } = await client
      .from('profiles')
      .select('organization_id')
      .maybeSingle();

    if (!profile?.organization_id) {
      return { success: false, error: 'User profile does not belong to an authorized Supabase organization.' };
    }

    const { error } = await client
      .from('incoming_orders')
      .upsert({
        id: order.id,
        organization_id: profile.organization_id,
        sku: order.sku,
        supplier_id: order.supplierId,
        ordered_quantity: order.orderedQuantity,
        received_quantity: Math.max(0, order.orderedQuantity - order.remainingOpenQuantity),
        remaining_open_quantity: order.remainingOpenQuantity,
        expected_arrival_date: order.expectedArrivalDate,
        status: order.status,
        source_record_id: order.sourceRecordId,
        updated_at: new Date().toISOString(),
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchReorderRequests(): Promise<{ requests: ReorderRequest[]; error?: string }> {
  const fbSnapshot = await fetchFirebaseVerifiedSnapshot();
  if (fbSnapshot) {
    return { requests: fbSnapshot.requests };
  }

  const client = getSupabase();
  if (!client) return { requests: [] };

  try {
    const { data, error } = await client
      .from('reorder_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { requests: [], error: error.message };
    return { requests: (data || []).map(mapReorderRequestRow) };
  } catch (err: any) {
    return { requests: [], error: err.message };
  }
}

export async function persistReorderRequest(request: ReorderRequest): Promise<{ success: boolean; error?: string }> {
  invalidateSnapshotCache();

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/workspace/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(request),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) return { success: true };
      }
    } catch {
      // Fallback to direct client
    }
  }

  const client = getSupabase();
  if (!client) return { success: false, error: 'Database not configured' };

  try {
    const { data: profile } = await client
      .from('profiles')
      .select('organization_id')
      .maybeSingle();

    if (!profile?.organization_id) {
      return { success: false, error: 'User profile does not belong to an authorized Supabase organization.' };
    }

    const { error } = await client
      .from('reorder_requests')
      .insert({
        id: request.id,
        organization_id: profile.organization_id,
        sku: request.sku,
        product_name: request.productName,
        supplier_id: request.supplierId,
        supplier_name: request.supplierName,
        proposed_quantity: request.proposedQuantity,
        case_count: request.caseCount,
        unit_price: request.unitPrice,
        total_cost: request.totalCost,
        forecast_demand: request.forecastDemand,
        incoming_quantity_considered: request.incomingQuantityConsidered,
        reason: request.reason,
        budget_status: request.budgetStatus,
        status: request.status,
        idempotency_key: request.idempotencyKey,
        source_evidence_ids: request.sourceEvidenceIds,
        created_at: request.createdAt,
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function persistRequestStatus(
  requestId: string,
  newStatus: string,
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  invalidateSnapshotCache();

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/workspace/requests/${encodeURIComponent(requestId)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ newStatus, comment }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) return { success: true };
      }
    } catch {
      // Fallback to direct client
    }
  }

  const client = getSupabase();
  if (!client) return { success: false, error: 'Database not configured' };

  try {
    const statusMap: Record<string, string> = {
      'approved': 'Approved',
      'rejected': 'Rejected',
      'pending approval': 'Pending Approval',
      'needs budget review': 'Needs Budget Review',
      'returned for changes': 'Returned For Changes',
      'verified': 'Verified',
      'draft': 'Draft'
    };
    const cleanStatus = statusMap[newStatus.toLowerCase().trim()] || newStatus;

    const { error } = await client
      .from('reorder_requests')
      .update({
        status: cleanStatus,
        review_comment: comment,
        rejection_reason: cleanStatus === 'Rejected' ? comment : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchAuditEvents(): Promise<{ events: AuditEvent[]; error?: string }> {
  const fbSnapshot = await fetchFirebaseVerifiedSnapshot();
  if (fbSnapshot) {
    return { events: fbSnapshot.auditEvents };
  }

  const client = getSupabase();
  if (!client) return { events: [] };

  try {
    const { data, error } = await client
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return { events: [], error: error.message };
    return { events: (data || []).map(mapAuditEventRow) };
  } catch (err: any) {
    return { events: [], error: err.message };
  }
}

export async function persistAuditEvent(
  event: Omit<AuditEvent, 'id' | 'timestamp' | 'executionMode'>
): Promise<{ success: boolean; error?: string }> {
  invalidateSnapshotCache();

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/workspace/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(event),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) return { success: true };
      }
    } catch {
      // Fallback to direct client
    }
  }

  const client = getSupabase();
  if (!client) return { success: false, error: 'Database not configured' };

  try {
    const { data: profile } = await client
      .from('profiles')
      .select('organization_id')
      .maybeSingle();

    if (!profile?.organization_id) return { success: false, error: 'No org found in profile' };

    const { error } = await client
      .from('audit_events')
      .insert({
        id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        organization_id: profile.organization_id,
        actor: event.actor,
        actor_email: event.actor,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        previous_state: event.previousState || 'None',
        new_state: event.newState,
        reason: event.reason,
        evidence_ids: event.evidenceIds,
        execution_mode: 'DETERMINISTIC_RULES',
        created_at: new Date().toISOString(),
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
