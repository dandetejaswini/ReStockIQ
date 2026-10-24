-- ====================================================================
-- RESTOCKIQ — SUPABASE MIGRATION (PHASE 3)
-- Firebase Identity Mapping, Email Queue Hardening & Daily Alert Automation
-- ====================================================================

-- 1. Add Firebase Identity Columns to public.profiles & Align Operational Tables (Non-destructive)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password',
    ADD COLUMN IF NOT EXISTS store_name TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(lower(email));

-- Ensure operational tables support all fields persisted by the ReStockIQ application
ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS contact_name TEXT DEFAULT 'Vendor Contact',
    ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS price_history JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.incoming_orders
    ADD COLUMN IF NOT EXISTS received_quantity INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source_record_id TEXT,
    ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.incoming_orders'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    ) LOOP
        EXECUTE format('ALTER TABLE public.incoming_orders DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.incoming_orders
    ADD CONSTRAINT incoming_orders_status_check
    CHECK (status IN (
        'Ordered', 'In Transit', 'Pending', 'Confirmed', 'Shipped', 'Received', 'Cancelled',
        'ordered', 'in_transit', 'delivered', 'cancelled'
    ));

ALTER TABLE public.reorder_requests
    ADD COLUMN IF NOT EXISTS supplier_name TEXT,
    ADD COLUMN IF NOT EXISTS case_count INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS forecast_demand NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS incoming_quantity_considered NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS budget_status TEXT NOT NULL DEFAULT 'Normal';

-- 2. Relax hard auth.users(id) foreign key constraints so Firebase-authenticated
--    users (Google Sign-Up & Firebase Email/Password Sign-Up) can own first-class
--    Supabase profiles, organizations, memberships, and email preferences without
--    requiring a duplicate password record in auth.users.
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop FK from public.profiles(id) -> auth.users(id) if present
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
    ) LOOP
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    -- Drop FK from public.organization_memberships(user_id) -> auth.users(id) if present
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.organization_memberships'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
    ) LOOP
        EXECUTE format('ALTER TABLE public.organization_memberships DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    -- Drop FK from public.user_email_preferences(user_id) -> auth.users(id) if present
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.user_email_preferences'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
    ) LOOP
        EXECUTE format('ALTER TABLE public.user_email_preferences DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    -- Drop FK from public.email_delivery_logs(user_id) -> auth.users(id) if present
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.email_delivery_logs'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
    ) LOOP
        EXECUTE format('ALTER TABLE public.email_delivery_logs DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    -- Drop FK from public.recommendation_runs(created_by) -> auth.users(id) if present
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.recommendation_runs'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
    ) LOOP
        EXECUTE format('ALTER TABLE public.recommendation_runs DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

-- Link child tables cleanly to public.profiles(id) instead of auth.users(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organization_memberships_user_id_profiles_fkey'
    ) THEN
        ALTER TABLE public.organization_memberships
            ADD CONSTRAINT organization_memberships_user_id_profiles_fkey
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_email_preferences_user_id_profiles_fkey'
    ) THEN
        ALTER TABLE public.user_email_preferences
            ADD CONSTRAINT user_email_preferences_user_id_profiles_fkey
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
    END IF;
END $$;

-- 3. Upgrade public.user_email_preferences with daily_inventory_alerts
ALTER TABLE public.user_email_preferences
    ADD COLUMN IF NOT EXISTS daily_inventory_alerts BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS firebase_uid TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_user_email_preferences_org ON public.user_email_preferences(organization_id);

-- 4. Upgrade public.email_delivery_logs constraints and columns
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop existing template_type check constraints on email_delivery_logs so WELCOME and DAILY_INVENTORY_ALERT are permitted
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.email_delivery_logs'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%template_type%'
    ) LOOP
        EXECUTE format('ALTER TABLE public.email_delivery_logs DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.email_delivery_logs
    ADD COLUMN IF NOT EXISTS firebase_uid TEXT,
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS queue_id UUID;

ALTER TABLE public.email_delivery_logs
    ADD CONSTRAINT email_delivery_logs_template_type_check
    CHECK (template_type IN (
        'WELCOME',
        'DAILY_INVENTORY_ALERT',
        'STOCKOUT_EARLY_WARNING',
        'PRICE_SURGE_ALERT',
        'PENDING_APPROVAL_DIGEST',
        'DAILY_BRIEFING'
    ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_delivery_logs_sent_idempotency
    ON public.email_delivery_logs(idempotency_key)
    WHERE idempotency_key IS NOT NULL AND status = 'SENT';

-- 5. Ensure public.email_queue exists and has all required columns & constraints
CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID,
    firebase_uid TEXT,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    template_type TEXT NOT NULL DEFAULT 'WELCOME',
    subject TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ
);

ALTER TABLE public.email_queue
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS firebase_uid TEXT,
    ADD COLUMN IF NOT EXISTS recipient_email TEXT,
    ADD COLUMN IF NOT EXISTS recipient_name TEXT,
    ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'WELCOME',
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Drop any FK from email_queue(user_id) to auth.users(id) if present
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.email_queue'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
    ) LOOP
        EXECUTE format('ALTER TABLE public.email_queue DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_queue_idempotency_key
    ON public.email_queue(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_queue_status_created
    ON public.email_queue(status, created_at ASC);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own queued emails" ON public.email_queue;
CREATE POLICY "Users can view their own queued emails"
ON public.email_queue FOR SELECT
USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT org_id FROM public.get_user_organization_ids())
);

-- 6. Safely reconcile & deduplicate any existing pending WELCOME rows in public.email_queue
DO $$
BEGIN
    -- Backfill organization_id and user_id from public.profiles when matching by email
    UPDATE public.email_queue eq
    SET
        user_id = COALESCE(eq.user_id, p.id),
        organization_id = COALESCE(eq.organization_id, p.organization_id),
        recipient_name = COALESCE(eq.recipient_name, p.full_name),
        firebase_uid = COALESCE(eq.firebase_uid, p.firebase_uid)
    FROM public.profiles p
    WHERE lower(eq.recipient_email) = lower(p.email)
      AND (eq.user_id IS NULL OR eq.organization_id IS NULL);

    -- Backfill deterministic idempotency_key on existing WELCOME rows if missing
    UPDATE public.email_queue
    SET idempotency_key = COALESCE(
        idempotency_key,
        CASE
            WHEN firebase_uid IS NOT NULL AND firebase_uid <> '' THEN 'welcome:firebase_uid:' || firebase_uid
            WHEN user_id IS NOT NULL THEN 'welcome:user_id:' || user_id::text
            ELSE 'welcome:email:' || lower(recipient_email)
        END
    )
    WHERE template_type = 'WELCOME'
      AND idempotency_key IS NULL;

    -- If multiple PENDING WELCOME rows exist for the same email, keep the earliest and mark duplicates SKIPPED
    WITH ranked_welcome AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY lower(recipient_email), template_type
                   ORDER BY created_at ASC, id ASC
               ) AS rn
        FROM public.email_queue
        WHERE template_type = 'WELCOME'
          AND status = 'PENDING'
    )
    UPDATE public.email_queue eq
    SET status = 'SKIPPED',
        error_message = 'Skipped duplicate pending WELCOME row during migration cleanup',
        processed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    FROM ranked_welcome rw
    WHERE eq.id = rw.id
      AND rw.rn > 1;
END $$;

-- 7. Update public.handle_new_user_registration() so Supabase Auth signups:
--    - Do NOT seed fake/dummy suppliers
--    - Reuse existing profile/organization if already created via Firebase sync
--    - Enqueue a single idempotent WELCOME email if not already queued
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_existing_profile RECORD;
    v_org_id UUID;
    v_full_name TEXT;
    v_org_name TEXT;
    v_org_slug TEXT;
    v_firebase_uid TEXT;
    v_idempotency_key TEXT;
BEGIN
    v_full_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));
    v_org_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'company_name'), ''), v_full_name || '''s Store');
    v_firebase_uid := NULLIF(trim(NEW.raw_user_meta_data->>'firebase_uid'), '');

    -- Check if profile already exists for this email or firebase_uid
    SELECT * INTO v_existing_profile
    FROM public.profiles
    WHERE id = NEW.id
       OR (v_firebase_uid IS NOT NULL AND firebase_uid = v_firebase_uid)
       OR lower(email) = lower(NEW.email)
    LIMIT 1;

    IF FOUND THEN
        v_org_id := v_existing_profile.organization_id;
        UPDATE public.profiles
        SET firebase_uid = COALESCE(public.profiles.firebase_uid, v_firebase_uid),
            full_name = COALESCE(NULLIF(public.profiles.full_name, ''), v_full_name),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_existing_profile.id;
    ELSE
        v_org_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(NEW.id::text from 1 for 8);

        INSERT INTO public.organizations (name, slug)
        VALUES (v_org_name, v_org_slug)
        RETURNING id INTO v_org_id;

        INSERT INTO public.profiles (
            id,
            organization_id,
            firebase_uid,
            full_name,
            email,
            role,
            store_name,
            auth_provider,
            avatar_url
        ) VALUES (
            NEW.id,
            v_org_id,
            v_firebase_uid,
            v_full_name,
            NEW.email,
            'Store Procurement Lead',
            v_org_name,
            'password',
            COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
        )
        ON CONFLICT (id) DO NOTHING;

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

        INSERT INTO public.user_email_preferences (
            user_id,
            organization_id,
            firebase_uid,
            stockout_alerts,
            price_change_alerts,
            pending_approval_digest,
            daily_inventory_alerts,
            weekly_briefing,
            frequency
        ) VALUES (
            NEW.id,
            v_org_id,
            v_firebase_uid,
            true,
            true,
            true,
            true,
            true,
            'INSTANT'
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- Enqueue WELCOME email only if no WELCOME email has ever been queued or sent for this email/user
    IF NOT EXISTS (
        SELECT 1 FROM public.email_queue
        WHERE template_type = 'WELCOME'
          AND (
              lower(recipient_email) = lower(NEW.email)
              OR user_id = COALESCE(v_existing_profile.id, NEW.id)
              OR (v_firebase_uid IS NOT NULL AND firebase_uid = v_firebase_uid)
          )
          AND status IN ('PENDING', 'PROCESSING', 'SENT')
    ) AND NOT EXISTS (
        SELECT 1 FROM public.email_delivery_logs
        WHERE template_type = 'WELCOME'
          AND lower(recipient_email) = lower(NEW.email)
          AND status = 'SENT'
    ) THEN
        v_idempotency_key := CASE
            WHEN v_firebase_uid IS NOT NULL THEN 'welcome:firebase_uid:' || v_firebase_uid
            ELSE 'welcome:user_id:' || COALESCE(v_existing_profile.id, NEW.id)::text
        END;

        INSERT INTO public.email_queue (
            organization_id,
            user_id,
            firebase_uid,
            recipient_email,
            recipient_name,
            template_type,
            subject,
            payload,
            idempotency_key,
            status
        ) VALUES (
            v_org_id,
            COALESCE(v_existing_profile.id, NEW.id),
            v_firebase_uid,
            NEW.email,
            v_full_name,
            'WELCOME',
            'Welcome to ReStockIQ — Your Intelligent Inventory Workspace is Ready',
            jsonb_build_object(
                'full_name', v_full_name,
                'email', NEW.email,
                'store_name', v_org_name,
                'organization_id', v_org_id,
                'auth_provider', 'password'
            ),
            v_idempotency_key,
            'PENDING'
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- 8. Authoritative Server/RPC Function: Sync Firebase Auth User to Supabase & Enqueue Welcome Email
CREATE OR REPLACE FUNCTION public.sync_firebase_workspace_and_welcome(
    p_firebase_uid TEXT,
    p_email TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_store_name TEXT DEFAULT NULL,
    p_provider TEXT DEFAULT 'password',
    p_avatar_url TEXT DEFAULT '',
    p_is_signup BOOLEAN DEFAULT false
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_profile RECORD;
    v_org RECORD;
    v_profile_id UUID;
    v_org_id UUID;
    v_clean_email TEXT;
    v_clean_name TEXT;
    v_clean_store TEXT;
    v_org_slug TEXT;
    v_is_new_account BOOLEAN := false;
    v_welcome_queued BOOLEAN := false;
    v_queue_id UUID := NULL;
    v_idempotency_key TEXT;
    v_existing_queue RECORD;
BEGIN
    IF p_firebase_uid IS NULL OR trim(p_firebase_uid) = '' THEN
        RAISE EXCEPTION 'p_firebase_uid is required';
    END IF;
    IF p_email IS NULL OR trim(p_email) = '' THEN
        RAISE EXCEPTION 'p_email is required';
    END IF;

    v_clean_email := lower(trim(p_email));
    v_clean_name := COALESCE(NULLIF(trim(p_full_name), ''), split_part(v_clean_email, '@', 1));
    v_clean_store := COALESCE(NULLIF(trim(p_store_name), ''), v_clean_name || '''s Store');
    v_idempotency_key := 'welcome:firebase_uid:' || trim(p_firebase_uid);

    -- Step 1: Look up existing profile by firebase_uid OR case-insensitive email
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE firebase_uid = trim(p_firebase_uid)
       OR lower(email) = v_clean_email
    ORDER BY (CASE WHEN firebase_uid = trim(p_firebase_uid) THEN 0 ELSE 1 END) ASC
    LIMIT 1;

    IF FOUND THEN
        v_profile_id := v_profile.id;
        v_org_id := v_profile.organization_id;

        -- Link firebase_uid and update any missing profile metadata
        UPDATE public.profiles
        SET
            firebase_uid = COALESCE(public.profiles.firebase_uid, trim(p_firebase_uid)),
            full_name = CASE
                WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' THEN v_clean_name
                ELSE public.profiles.full_name
            END,
            store_name = COALESCE(NULLIF(trim(p_store_name), ''), public.profiles.store_name),
            avatar_url = CASE
                WHEN (public.profiles.avatar_url IS NULL OR public.profiles.avatar_url = '') AND p_avatar_url <> '' THEN p_avatar_url
                ELSE public.profiles.avatar_url
            END,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_profile_id;

        -- Update organization name if user explicitly provided a new store name during onboarding
        IF p_store_name IS NOT NULL AND trim(p_store_name) <> '' THEN
            UPDATE public.organizations
            SET name = trim(p_store_name),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_org_id
              AND (name LIKE '%''s Store' OR name = 'Main Store Branch');
        END IF;
    ELSE
        -- Genuinely new canonical user account in Supabase
        v_is_new_account := true;
        -- Deterministic UUID derived from firebase_uid
        v_profile_id := md5('firebase:' || trim(p_firebase_uid))::uuid;
        v_org_slug := lower(regexp_replace(v_clean_store, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(v_profile_id::text from 1 for 8);

        INSERT INTO public.organizations (name, slug)
        VALUES (v_clean_store, v_org_slug)
        RETURNING id INTO v_org_id;

        INSERT INTO public.profiles (
            id,
            organization_id,
            firebase_uid,
            full_name,
            email,
            role,
            store_name,
            auth_provider,
            avatar_url
        ) VALUES (
            v_profile_id,
            v_org_id,
            trim(p_firebase_uid),
            v_clean_name,
            v_clean_email,
            'Store Procurement Lead',
            v_clean_store,
            COALESCE(NULLIF(trim(p_provider), ''), 'password'),
            COALESCE(p_avatar_url, '')
        );
    END IF;

    -- Step 2: Ensure organization_memberships row exists
    INSERT INTO public.organization_memberships (
        user_id,
        organization_id,
        role
    ) VALUES (
        v_profile_id,
        v_org_id,
        'Admin'
    )
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    -- Step 3: Ensure user_email_preferences row exists
    INSERT INTO public.user_email_preferences (
        user_id,
        organization_id,
        firebase_uid,
        stockout_alerts,
        price_change_alerts,
        pending_approval_digest,
        daily_inventory_alerts,
        weekly_briefing,
        frequency
    ) VALUES (
        v_profile_id,
        v_org_id,
        trim(p_firebase_uid),
        true,
        true,
        true,
        true,
        true,
        'INSTANT'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        firebase_uid = COALESCE(public.user_email_preferences.firebase_uid, EXCLUDED.firebase_uid);

    -- Step 4: Check if a WELCOME email has ever been queued or sent for this canonical user
    SELECT * INTO v_existing_queue
    FROM public.email_queue
    WHERE template_type = 'WELCOME'
      AND (
          idempotency_key = v_idempotency_key
          OR firebase_uid = trim(p_firebase_uid)
          OR user_id = v_profile_id
          OR lower(recipient_email) = v_clean_email
      )
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        -- Ensure existing welcome row has firebase_uid, user_id, and organization_id linked
        UPDATE public.email_queue
        SET
            firebase_uid = COALESCE(firebase_uid, trim(p_firebase_uid)),
            user_id = COALESCE(user_id, v_profile_id),
            organization_id = COALESCE(organization_id, v_org_id),
            status = CASE WHEN status = 'FAILED' THEN 'PENDING' ELSE status END,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_existing_queue.id;

        IF v_existing_queue.status IN ('PENDING', 'FAILED') THEN
            v_queue_id := v_existing_queue.id;
            v_welcome_queued := true;
        END IF;
    ELSIF (v_is_new_account OR p_is_signup) AND NOT EXISTS (
        SELECT 1 FROM public.email_delivery_logs
        WHERE template_type = 'WELCOME'
          AND (
              idempotency_key = v_idempotency_key
              OR user_id = v_profile_id
              OR lower(recipient_email) = v_clean_email
          )
          AND status = 'SENT'
    ) THEN
        INSERT INTO public.email_queue (
            organization_id,
            user_id,
            firebase_uid,
            recipient_email,
            recipient_name,
            template_type,
            subject,
            payload,
            idempotency_key,
            status
        ) VALUES (
            v_org_id,
            v_profile_id,
            trim(p_firebase_uid),
            v_clean_email,
            v_clean_name,
            'WELCOME',
            'Welcome to ReStockIQ — Your Intelligent Inventory Workspace is Ready',
            jsonb_build_object(
                'full_name', v_clean_name,
                'email', v_clean_email,
                'store_name', v_clean_store,
                'organization_id', v_org_id,
                'firebase_uid', trim(p_firebase_uid),
                'auth_provider', COALESCE(NULLIF(trim(p_provider), ''), 'password')
            ),
            v_idempotency_key,
            'PENDING'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO v_queue_id;

        IF v_queue_id IS NOT NULL THEN
            v_welcome_queued := true;
        END IF;
    END IF;

    SELECT * INTO v_org FROM public.organizations WHERE id = v_org_id;

    RETURN jsonb_build_object(
        'profile_id', v_profile_id,
        'organization_id', v_org_id,
        'organization_name', COALESCE(v_org.name, v_clean_store),
        'firebase_uid', trim(p_firebase_uid),
        'email', v_clean_email,
        'full_name', v_clean_name,
        'is_new_account', v_is_new_account,
        'welcome_queued', v_welcome_queued,
        'queue_id', v_queue_id,
        'idempotency_key', v_idempotency_key
    );
END;
$$;

-- 9. Server/RPC Function: Get Email Preferences & Recent Logs for Verified Firebase User
CREATE OR REPLACE FUNCTION public.get_firebase_user_email_preferences(
    p_firebase_uid TEXT,
    p_email TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_profile RECORD;
    v_prefs RECORD;
    v_logs JSONB;
    v_queue JSONB;
BEGIN
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE firebase_uid = trim(p_firebase_uid)
       OR lower(email) = lower(trim(p_email))
    ORDER BY (CASE WHEN firebase_uid = trim(p_firebase_uid) THEN 0 ELSE 1 END) ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    SELECT * INTO v_prefs
    FROM public.user_email_preferences
    WHERE user_id = v_profile.id
    LIMIT 1;

    SELECT COALESCE(jsonb_agg(row_to_json(l)), '[]'::jsonb) INTO v_logs
    FROM (
        SELECT id, recipient_email, template_type, status, subject, error_message, sent_at
        FROM public.email_delivery_logs
        WHERE organization_id = v_profile.organization_id
           OR user_id = v_profile.id
        ORDER BY sent_at DESC
        LIMIT 10
    ) l;

    SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb) INTO v_queue
    FROM (
        SELECT id, recipient_email, template_type, status, idempotency_key, attempts, error_message, created_at, sent_at
        FROM public.email_queue
        WHERE organization_id = v_profile.organization_id
           OR user_id = v_profile.id
        ORDER BY created_at DESC
        LIMIT 10
    ) q;

    RETURN jsonb_build_object(
        'found', true,
        'profile_id', v_profile.id,
        'organization_id', v_profile.organization_id,
        'preferences', CASE WHEN v_prefs IS NOT NULL THEN jsonb_build_object(
            'stockout_alerts', COALESCE(v_prefs.stockout_alerts, true),
            'price_change_alerts', COALESCE(v_prefs.price_change_alerts, true),
            'pending_approval_digest', COALESCE(v_prefs.pending_approval_digest, true),
            'daily_inventory_alerts', COALESCE(v_prefs.daily_inventory_alerts, true),
            'weekly_briefing', COALESCE(v_prefs.weekly_briefing, true),
            'frequency', COALESCE(v_prefs.frequency, 'INSTANT'),
            'updated_at', v_prefs.updated_at
        ) ELSE NULL END,
        'delivery_logs', v_logs,
        'email_queue', v_queue
    );
END;
$$;

-- 10. Server/RPC Function: Update Email Preferences for Verified Firebase User
CREATE OR REPLACE FUNCTION public.update_firebase_user_email_preferences(
    p_firebase_uid TEXT,
    p_email TEXT,
    p_stockout_alerts BOOLEAN,
    p_price_change_alerts BOOLEAN,
    p_pending_approval_digest BOOLEAN,
    p_daily_inventory_alerts BOOLEAN,
    p_weekly_briefing BOOLEAN,
    p_frequency TEXT DEFAULT 'INSTANT'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_profile RECORD;
    v_prefs RECORD;
    v_clean_freq TEXT;
BEGIN
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE firebase_uid = trim(p_firebase_uid)
       OR lower(email) = lower(trim(p_email))
    ORDER BY (CASE WHEN firebase_uid = trim(p_firebase_uid) THEN 0 ELSE 1 END) ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found for Firebase user %', p_firebase_uid;
    END IF;

    v_clean_freq := CASE
        WHEN p_frequency IN ('INSTANT', 'DAILY_DIGEST', 'WEEKLY') THEN p_frequency
        ELSE 'INSTANT'
    END;

    INSERT INTO public.user_email_preferences (
        user_id,
        organization_id,
        firebase_uid,
        stockout_alerts,
        price_change_alerts,
        pending_approval_digest,
        daily_inventory_alerts,
        weekly_briefing,
        frequency,
        updated_at
    ) VALUES (
        v_profile.id,
        v_profile.organization_id,
        trim(p_firebase_uid),
        COALESCE(p_stockout_alerts, true),
        COALESCE(p_price_change_alerts, true),
        COALESCE(p_pending_approval_digest, true),
        COALESCE(p_daily_inventory_alerts, true),
        COALESCE(p_weekly_briefing, true),
        v_clean_freq,
        timezone('utc'::text, now())
    )
    ON CONFLICT (user_id) DO UPDATE SET
        firebase_uid = EXCLUDED.firebase_uid,
        stockout_alerts = EXCLUDED.stockout_alerts,
        price_change_alerts = EXCLUDED.price_change_alerts,
        pending_approval_digest = EXCLUDED.pending_approval_digest,
        daily_inventory_alerts = EXCLUDED.daily_inventory_alerts,
        weekly_briefing = EXCLUDED.weekly_briefing,
        frequency = EXCLUDED.frequency,
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_prefs;

    RETURN jsonb_build_object(
        'success', true,
        'preferences', jsonb_build_object(
            'stockout_alerts', v_prefs.stockout_alerts,
            'price_change_alerts', v_prefs.price_change_alerts,
            'pending_approval_digest', v_prefs.pending_approval_digest,
            'daily_inventory_alerts', v_prefs.daily_inventory_alerts,
            'weekly_briefing', v_prefs.weekly_briefing,
            'frequency', v_prefs.frequency,
            'updated_at', v_prefs.updated_at
        )
    );
END;
$$;

-- 11. Server/RPC Function: Record Email Dispatch Result in email_queue & email_delivery_logs
CREATE OR REPLACE FUNCTION public.record_email_dispatch_result(
    p_queue_id UUID,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_queue RECORD;
    v_clean_status TEXT;
BEGIN
    SELECT * INTO v_queue FROM public.email_queue WHERE id = p_queue_id LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Queue row not found');
    END IF;

    v_clean_status := CASE
        WHEN p_status IN ('SENT', 'FAILED', 'SKIPPED', 'CANCELLED') THEN p_status
        ELSE 'FAILED'
    END;

    UPDATE public.email_queue
    SET
        status = v_clean_status,
        attempts = attempts + 1,
        error_message = p_error_message,
        processed_at = timezone('utc'::text, now()),
        sent_at = CASE WHEN v_clean_status = 'SENT' THEN timezone('utc'::text, now()) ELSE sent_at END,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_queue_id;

    IF v_clean_status IN ('SENT', 'FAILED') AND v_queue.organization_id IS NOT NULL THEN
        INSERT INTO public.email_delivery_logs (
            organization_id,
            user_id,
            firebase_uid,
            recipient_email,
            template_type,
            status,
            subject,
            idempotency_key,
            queue_id,
            metadata,
            error_message,
            sent_at
        ) VALUES (
            v_queue.organization_id,
            v_queue.user_id,
            v_queue.firebase_uid,
            v_queue.recipient_email,
            CASE
                WHEN v_queue.template_type IN (
                    'WELCOME',
                    'DAILY_INVENTORY_ALERT',
                    'STOCKOUT_EARLY_WARNING',
                    'PRICE_SURGE_ALERT',
                    'PENDING_APPROVAL_DIGEST',
                    'DAILY_BRIEFING'
                ) THEN v_queue.template_type
                ELSE 'DAILY_BRIEFING'
            END,
            v_clean_status,
            v_queue.subject,
            v_queue.idempotency_key,
            v_queue.id,
            COALESCE(p_metadata, '{}'::jsonb),
            p_error_message,
            timezone('utc'::text, now())
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object('success', true, 'status', v_clean_status);
END;
$$;

-- 12. Server/RPC Function: Fetch Tenant-Isolated Workspace Snapshot for Verified Firebase User
CREATE OR REPLACE FUNCTION public.get_firebase_workspace_snapshot(
    p_firebase_uid TEXT,
    p_email TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_profile RECORD;
    v_inventory JSONB;
    v_suppliers JSONB;
    v_orders JSONB;
    v_requests JSONB;
    v_audit JSONB;
BEGIN
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE firebase_uid = trim(p_firebase_uid)
       OR lower(email) = lower(trim(p_email))
    ORDER BY (CASE WHEN firebase_uid = trim(p_firebase_uid) THEN 0 ELSE 1 END) ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'found', false,
            'inventory_items', '[]'::jsonb,
            'suppliers', '[]'::jsonb,
            'incoming_orders', '[]'::jsonb,
            'reorder_requests', '[]'::jsonb,
            'audit_events', '[]'::jsonb
        );
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) INTO v_inventory
    FROM (
        SELECT * FROM public.inventory_items
        WHERE organization_id = v_profile.organization_id
        ORDER BY sku ASC
    ) i;

    SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) INTO v_suppliers
    FROM (
        SELECT * FROM public.suppliers
        WHERE organization_id = v_profile.organization_id
        ORDER BY name ASC
    ) s;

    SELECT COALESCE(jsonb_agg(row_to_json(o)), '[]'::jsonb) INTO v_orders
    FROM (
        SELECT * FROM public.incoming_orders
        WHERE organization_id = v_profile.organization_id
        ORDER BY expected_arrival_date ASC
    ) o;

    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_requests
    FROM (
        SELECT * FROM public.reorder_requests
        WHERE organization_id = v_profile.organization_id
        ORDER BY created_at DESC
    ) r;

    SELECT COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb) INTO v_audit
    FROM (
        SELECT * FROM public.audit_events
        WHERE organization_id = v_profile.organization_id
        ORDER BY created_at DESC
        LIMIT 100
    ) a;

    RETURN jsonb_build_object(
        'found', true,
        'profile_id', v_profile.id,
        'organization_id', v_profile.organization_id,
        'inventory_items', v_inventory,
        'suppliers', v_suppliers,
        'incoming_orders', v_orders,
        'reorder_requests', v_requests,
        'audit_events', v_audit
    );
END;
$$;

-- 13. Explicit Grants for Table & RPC Execution
GRANT SELECT, INSERT, UPDATE ON public.email_queue TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.email_delivery_logs TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_firebase_workspace_and_welcome(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_firebase_user_email_preferences(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_firebase_user_email_preferences(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_email_dispatch_result(UUID, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_firebase_workspace_snapshot(TEXT, TEXT) TO anon, authenticated, service_role;


