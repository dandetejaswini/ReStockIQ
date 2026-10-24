-- ====================================================================
-- STOCKPILOT AI — SUPABASE POSTGRESQL PRODUCTION DATA ARCHITECTURE
-- Migration 1 of 2: Core Tenancy, Catalogs, Inbound Pipeline & Audit Ledger
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizations & Workspaces
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. User Profiles (Linked with Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Procurement Officer' CHECK (role IN ('Store Manager', 'Procurement Officer', 'Finance Reviewer', 'Admin', 'Viewer', 'Store Procurement Lead')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Organization Memberships (Multi-user RBAC)
CREATE TABLE IF NOT EXISTS public.organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'Procurement Officer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, organization_id)
);

-- 4. Suppliers (Scoped per Organization)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    current_unit_price NUMERIC(10, 2) NOT NULL CHECK (current_unit_price > 0),
    previous_unit_price NUMERIC(10, 2) NOT NULL CHECK (previous_unit_price > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    lead_time_days INTEGER NOT NULL CHECK (lead_time_days > 0),
    pack_size INTEGER NOT NULL DEFAULT 1 CHECK (pack_size > 0),
    minimum_order_quantity INTEGER NOT NULL DEFAULT 1 CHECK (minimum_order_quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (organization_id, id)
);

-- 5. Supplier Price History (For >= 20% Variance Detection)
CREATE TABLE IF NOT EXISTS public.supplier_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    old_unit_price NUMERIC(10, 2) NOT NULL,
    new_unit_price NUMERIC(10, 2) NOT NULL,
    percentage_change NUMERIC(6, 2) NOT NULL,
    is_price_jumped BOOLEAN GENERATED ALWAYS AS (percentage_change >= 20.0) STORED,
    changed_by UUID REFERENCES public.profiles(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    FOREIGN KEY (organization_id, supplier_id) REFERENCES public.suppliers(organization_id, id) ON DELETE CASCADE
);

-- 6. Inventory Items (SKU Catalog with Dual-Name & Pricing Resilience)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    reserved_stock NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
    reorder_threshold NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (reorder_threshold >= 0),
    average_daily_sales NUMERIC(10, 2) NOT NULL DEFAULT 1.0 CHECK (average_daily_sales >= 0),
    lead_time_days INTEGER NOT NULL DEFAULT 7 CHECK (lead_time_days > 0),
    safety_stock NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 100.00 CHECK (unit_price >= 0),
    supplier_id TEXT,
    source_record_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(organization_id, sku),
    FOREIGN KEY (organization_id, supplier_id) REFERENCES public.suppliers(organization_id, id) ON DELETE SET NULL
);

-- Add column compatibility aliases if not present
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.inventory_items ADD COLUMN title TEXT GENERATED ALWAYS AS (name) STORED;
    EXCEPTION WHEN duplicate_column THEN END;
    BEGIN
        ALTER TABLE public.inventory_items ADD COLUMN daily_demand_rate NUMERIC(10, 2) GENERATED ALWAYS AS (average_daily_sales) STORED;
    EXCEPTION WHEN duplicate_column THEN END;
    BEGIN
        ALTER TABLE public.inventory_items ADD COLUMN reorder_point NUMERIC(10, 2) GENERATED ALWAYS AS (reorder_threshold) STORED;
    EXCEPTION WHEN duplicate_column THEN END;
    BEGIN
        ALTER TABLE public.inventory_items ADD COLUMN unit_cost NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price) STORED;
    EXCEPTION WHEN duplicate_column THEN END;
    BEGIN
        ALTER TABLE public.inventory_items ADD COLUMN primary_supplier_id TEXT GENERATED ALWAYS AS (supplier_id) STORED;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- 7. Sales History (Deterministic Velocity)
CREATE TABLE IF NOT EXISTS public.sales_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    inventory_item_id TEXT NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    units_sold INTEGER NOT NULL CHECK (units_sold > 0),
    sale_date DATE NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Incoming Orders (Pipeline Supply Reconciliation)
CREATE TABLE IF NOT EXISTS public.incoming_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
    remaining_open_quantity INTEGER NOT NULL CHECK (remaining_open_quantity >= 0),
    expected_arrival_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Confirmed', 'Shipped', 'Received', 'Cancelled', 'ordered', 'in_transit', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    FOREIGN KEY (organization_id, supplier_id) REFERENCES public.suppliers(organization_id, id) ON DELETE RESTRICT
);

-- 9. Reorder Requests (Human Approval Workflow)
CREATE TABLE IF NOT EXISTS public.reorder_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    proposed_quantity INTEGER NOT NULL CHECK (proposed_quantity > 0),
    total_cost NUMERIC(12, 2) NOT NULL CHECK (total_cost >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN (
        'Draft', 'Pending Approval', 'Needs Budget Review', 'Approved', 'Rejected', 'Verified', 'Returned For Changes', 'Ordered',
        'draft', 'pending_approval', 'needs_budget_review', 'approved', 'rejected', 'verified'
    )),
    reason TEXT NOT NULL,
    review_comment TEXT,
    rejection_reason TEXT,
    source_evidence_ids TEXT[] NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES public.profiles(id),
    approved_by UUID REFERENCES public.profiles(id),
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    FOREIGN KEY (organization_id, supplier_id) REFERENCES public.suppliers(organization_id, id) ON DELETE RESTRICT
);

-- 10. Audit Trail (Immutable Cryptographic Governance)
CREATE TABLE IF NOT EXISTS public.audit_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence_ids TEXT[] NOT NULL DEFAULT '{}',
    execution_mode TEXT NOT NULL DEFAULT 'DETERMINISTIC_RULES',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- TENANCY RESOLUTION HELPER FUNCTION
-- Explicit search_path prevents search_path poisoning attacks
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS TABLE (org_id UUID) 
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT organization_id FROM public.organization_memberships
    WHERE user_id = auth.uid()
    UNION
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid();
$$;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Complete coverage across all tenant tables with safe DROP IF EXISTS
-- ====================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 1. Organizations
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
USING (id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- 2. Profiles
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()) OR id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 3. Organization Memberships
DROP POLICY IF EXISTS "Users can view memberships in their organization" ON public.organization_memberships;
CREATE POLICY "Users can view memberships in their organization"
ON public.organization_memberships FOR SELECT
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()) OR user_id = auth.uid());

-- 4. Suppliers
DROP POLICY IF EXISTS "Users can access suppliers in their organization" ON public.suppliers;
CREATE POLICY "Users can access suppliers in their organization"
ON public.suppliers FOR ALL
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()))
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- 5. Supplier Price History
DROP POLICY IF EXISTS "Users can access supplier price history in their org" ON public.supplier_price_history;
CREATE POLICY "Users can access supplier price history in their org"
ON public.supplier_price_history FOR ALL
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()))
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- 6. Inventory Items
DROP POLICY IF EXISTS "Users can access inventory in their organization" ON public.inventory_items;
CREATE POLICY "Users can access inventory in their organization"
ON public.inventory_items FOR ALL
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()))
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- 7. Sales History
DROP POLICY IF EXISTS "Users can access sales history in their org" ON public.sales_history;
CREATE POLICY "Users can access sales history in their org"
ON public.sales_history FOR ALL
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()))
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- 8. Incoming Orders
DROP POLICY IF EXISTS "Users can access incoming orders in their organization" ON public.incoming_orders;
CREATE POLICY "Users can access incoming orders in their organization"
ON public.incoming_orders FOR ALL
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()))
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- 9. Reorder Requests
DROP POLICY IF EXISTS "Users can access reorder requests in their organization" ON public.reorder_requests;
CREATE POLICY "Users can access reorder requests in their organization"
ON public.reorder_requests FOR ALL
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()))
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- 10. Audit Events
DROP POLICY IF EXISTS "Users can view audit events in their organization" ON public.audit_events;
CREATE POLICY "Users can view audit events in their organization"
ON public.audit_events FOR SELECT
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Authenticated users can append audit events in their organization" ON public.audit_events;
CREATE POLICY "Authenticated users can append audit events in their organization"
ON public.audit_events FOR INSERT
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- ====================================================================
-- SERVER-SIDE STORED PROCEDURES (Authoritative Calculations)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.calculate_replenishment_requirement(
    p_sku TEXT,
    p_org_id UUID
)
RETURNS TABLE (
    effective_stock NUMERIC(12, 2),
    lead_demand NUMERIC(12, 2),
    safety_stock NUMERIC(10, 2),
    target_inventory NUMERIC(12, 2),
    incoming_supply NUMERIC(12, 2),
    raw_requirement NUMERIC(12, 2),
    pack_size INTEGER,
    case_count INTEGER,
    final_order_units NUMERIC(12, 2),
    is_duplicate_covered BOOLEAN,
    requires_budget_review BOOLEAN
) 
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_item RECORD;
    v_sup RECORD;
    v_incoming_qty NUMERIC(12, 2) := 0;
    v_raw_need NUMERIC(12, 2) := 0;
    v_pack_size INTEGER := 1;
    v_cases INTEGER := 0;
    v_final_units NUMERIC(12, 2) := 0;
    v_lead_demand NUMERIC(12, 2) := 0;
    v_price_jump BOOLEAN := false;
BEGIN
    -- Fetch item
    SELECT * INTO v_item FROM public.inventory_items 
    WHERE sku = p_sku AND organization_id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SKU % not found in organization %', p_sku, p_org_id;
    END IF;

    -- Fetch supplier
    SELECT * INTO v_sup FROM public.suppliers 
    WHERE id = v_item.supplier_id AND organization_id = p_org_id;

    -- Sum open incoming shipments
    SELECT COALESCE(SUM(remaining_open_quantity), 0) INTO v_incoming_qty
    FROM public.incoming_orders
    WHERE sku = p_sku AND organization_id = p_org_id AND status NOT IN ('Received', 'Cancelled', 'delivered', 'cancelled');

    -- Effective stock & demand math
    effective_stock := v_item.current_stock - v_item.reserved_stock;
    v_lead_demand := CEIL(v_item.average_daily_sales * v_item.lead_time_days);
    lead_demand := v_lead_demand;
    safety_stock := v_item.safety_stock;
    target_inventory := lead_demand + safety_stock;
    incoming_supply := v_incoming_qty;

    -- Raw requirement considering existing inbound pipeline
    v_raw_need := GREATEST(0, target_inventory - (effective_stock + v_incoming_qty));
    raw_requirement := v_raw_need;

    -- Pack size rounding (TC2)
    v_pack_size := GREATEST(1, COALESCE(v_sup.pack_size, 1));
    pack_size := v_pack_size;

    IF v_raw_need > 0 THEN
        v_cases := CEIL(v_raw_need::numeric / v_pack_size::numeric);
        v_final_units := v_cases * v_pack_size;
    ELSE
        v_cases := 0;
        v_final_units := 0;
    END IF;

    case_count := v_cases;
    final_order_units := v_final_units;

    -- Duplicate prevention check (TC3)
    is_duplicate_covered := (v_incoming_qty >= lead_demand) AND (v_raw_need = 0);

    -- Price jump check (TC4)
    IF v_sup IS NOT NULL AND v_sup.previous_unit_price > 0 THEN
        v_price_jump := (((v_sup.current_unit_price - v_sup.previous_unit_price) / v_sup.previous_unit_price) * 100 >= 20.0);
    ELSE
        v_price_jump := false;
    END IF;
    requires_budget_review := v_price_jump;

    RETURN NEXT;
END;
$$;
