-- ====================================================================
-- STOCKPILOT AI — SUPABASE MIGRATION (PHASE 2)
-- Migration 2 of 2: Recommendation Runs, Email Notifications & Auth Provisioning Trigger
-- ====================================================================

-- 1. Recommendation Runs (Historical snapshot of AI / replenishment calculations)
CREATE TABLE IF NOT EXISTS public.recommendation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    run_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    skus_evaluated INTEGER NOT NULL CHECK (skus_evaluated >= 0),
    stockouts_detected INTEGER NOT NULL CHECK (stockouts_detected >= 0),
    proposals_generated INTEGER NOT NULL CHECK (proposals_generated >= 0),
    budget_exceptions INTEGER NOT NULL CHECK (budget_exceptions >= 0),
    execution_duration_ms INTEGER NOT NULL DEFAULT 0,
    evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. User Email Notification Preferences
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    stockout_alerts BOOLEAN NOT NULL DEFAULT true,
    price_change_alerts BOOLEAN NOT NULL DEFAULT true,
    pending_approval_digest BOOLEAN NOT NULL DEFAULT true,
    weekly_briefing BOOLEAN NOT NULL DEFAULT true,
    frequency TEXT NOT NULL DEFAULT 'INSTANT' CHECK (frequency IN ('INSTANT', 'DAILY_DIGEST', 'WEEKLY')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id)
);

-- 3. Email Delivery Logs (Auditing notification dispatch)
CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('STOCKOUT_EARLY_WARNING', 'PRICE_SURGE_ALERT', 'PENDING_APPROVAL_DIGEST', 'DAILY_BRIEFING')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'BOUNCED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. High-Performance Compound Indexes
CREATE INDEX IF NOT EXISTS idx_recommendation_runs_org ON public.recommendation_runs(organization_id, run_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_org ON public.email_delivery_logs(organization_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_sku ON public.inventory_items(organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_incoming_orders_org_sku ON public.incoming_orders(organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_org_status ON public.reorder_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created ON public.audit_events(organization_id, created_at DESC);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Recommendation Runs
DROP POLICY IF EXISTS "Users can view recommendation runs in their org" ON public.recommendation_runs;
CREATE POLICY "Users can view recommendation runs in their org"
ON public.recommendation_runs FOR SELECT
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can insert recommendation runs in their org" ON public.recommendation_runs;
CREATE POLICY "Users can insert recommendation runs in their org"
ON public.recommendation_runs FOR INSERT
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- Email Preferences
DROP POLICY IF EXISTS "Users can view and edit their own email preferences" ON public.user_email_preferences;
CREATE POLICY "Users can view and edit their own email preferences"
ON public.user_email_preferences FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Email Delivery Logs
DROP POLICY IF EXISTS "Users can view email delivery logs in their org" ON public.email_delivery_logs;
CREATE POLICY "Users can view email delivery logs in their org"
ON public.email_delivery_logs FOR SELECT
USING (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Authenticated users can append email delivery logs in their org" ON public.email_delivery_logs;
CREATE POLICY "Authenticated users can append email delivery logs in their org"
ON public.email_delivery_logs FOR INSERT
WITH CHECK (organization_id IN (SELECT org_id FROM public.get_user_organization_ids()));

-- ====================================================================
-- AUTOMATED AUTH TRIGGER: ORG, PROFILE & MEMBERSHIP ON SIGNUP
-- Automatically executes in PostgreSQL upon auth.users INSERT
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_org_id UUID;
    v_full_name TEXT;
    v_org_name TEXT;
    v_org_slug TEXT;
BEGIN
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    v_org_name := COALESCE(NEW.raw_user_meta_data->>'company_name', v_full_name || '''s Store');
    v_org_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(NEW.id::text from 1 for 8);

    -- 1. Create personal business organization
    INSERT INTO public.organizations (name, slug)
    VALUES (v_org_name, v_org_slug)
    RETURNING id INTO v_org_id;

    -- 2. Create user profile bound to this organization
    INSERT INTO public.profiles (
        id, 
        organization_id, 
        full_name, 
        email, 
        role, 
        avatar_url
    ) VALUES (
        NEW.id,
        v_org_id,
        v_full_name,
        NEW.email,
        'Procurement Officer',
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80')
    )
    ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        full_name = EXCLUDED.full_name;

    -- 3. Create organization membership
    INSERT INTO public.organization_memberships (
        user_id,
        organization_id,
        role
    ) VALUES (
        NEW.id,
        v_org_id,
        'Admin'
    )
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    -- 4. Seed default suppliers for this organization so SKU foreign keys resolve
    INSERT INTO public.suppliers (id, organization_id, name, contact_email, current_unit_price, previous_unit_price, currency, lead_time_days, pack_size, minimum_order_quantity)
    VALUES 
        ('SUP-01', v_org_id, 'Apex Logistics Inc.', 'orders@apexlogistics.com', 120.00, 120.00, 'INR', 7, 12, 1),
        ('SUP-02', v_org_id, 'Beacon Distribution', 'procure@beacondist.in', 45.00, 45.00, 'INR', 3, 1, 1),
        ('SUP-03', v_org_id, 'Crestview Supply Co.', 'fulfillment@crestviewsupply.com', 80.00, 80.00, 'INR', 5, 6, 1),
        ('SUP-04', v_org_id, 'DirectFreight Imports', 'sales@directfreight.co', 210.00, 175.00, 'INR', 10, 24, 1)
    ON CONFLICT (organization_id, id) DO NOTHING;

    -- 5. Create default email notification preferences
    INSERT INTO public.user_email_preferences (
        user_id,
        organization_id,
        stockout_alerts,
        price_change_alerts,
        pending_approval_digest,
        weekly_briefing,
        frequency
    ) VALUES (
        NEW.id,
        v_org_id,
        true,
        true,
        true,
        true,
        'INSTANT'
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Trigger firing on every new user in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_registration();
