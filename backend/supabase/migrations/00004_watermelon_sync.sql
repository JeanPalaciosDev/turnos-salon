-- WatermelonDB synchronization protocol and authoritative slot conflict checks.
-- The sync cursor is the server-issued sync_version, not a wall-clock timestamp.

-- Serialize writes and pulls around the cursor so a pull never advances past a
-- committed change it did not include in its response.
CREATE OR REPLACE FUNCTION public.set_sync_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(845766531);
  NEW.updated_at := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  NEW.sync_version := nextval('public.sync_version_sequence');
  RETURN NEW;
END;
$$;

ALTER TABLE public.business_config ALTER COLUMN sync_version DROP DEFAULT;
ALTER TABLE public.user_profiles ALTER COLUMN sync_version DROP DEFAULT;
ALTER TABLE public.services ALTER COLUMN sync_version DROP DEFAULT;
ALTER TABLE public.workers ALTER COLUMN sync_version DROP DEFAULT;
ALTER TABLE public.clients ALTER COLUMN sync_version DROP DEFAULT;
ALTER TABLE public.appointments ALTER COLUMN sync_version DROP DEFAULT;
ALTER TABLE public.payments ALTER COLUMN sync_version DROP DEFAULT;

DROP TRIGGER IF EXISTS set_business_config_sync_metadata ON public.business_config;
DROP TRIGGER IF EXISTS set_user_profiles_sync_metadata ON public.user_profiles;
DROP TRIGGER IF EXISTS set_services_sync_metadata ON public.services;
DROP TRIGGER IF EXISTS set_workers_sync_metadata ON public.workers;
DROP TRIGGER IF EXISTS set_clients_sync_metadata ON public.clients;
DROP TRIGGER IF EXISTS set_appointments_sync_metadata ON public.appointments;
DROP TRIGGER IF EXISTS set_payments_sync_metadata ON public.payments;

CREATE TRIGGER set_business_config_sync_metadata
  BEFORE INSERT OR UPDATE ON public.business_config
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_user_profiles_sync_metadata
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_services_sync_metadata
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_workers_sync_metadata
  BEFORE INSERT OR UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_clients_sync_metadata
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_appointments_sync_metadata
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_payments_sync_metadata
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();

-- The exclusion constraint is the final concurrency guard. The RPC preflight
-- below gives a useful conflict response, but this constraint protects the
-- invariant even when two requests race.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlapping_active_slots
  EXCLUDE USING gist (
    worker_id WITH =,
    date WITH =,
    int4range(
      (split_part(start_time, ':', 1)::INTEGER * 60 + split_part(start_time, ':', 2)::INTEGER),
      (split_part(end_time, ':', 1)::INTEGER * 60 + split_part(end_time, ':', 2)::INTEGER),
      '[)'
    ) WITH &&
  )
  WHERE (is_deleted = FALSE AND status <> 'cancelled');

CREATE OR REPLACE FUNCTION public.assert_appointment_slot_available(
  p_business_id UUID,
  p_worker_id UUID,
  p_date TEXT,
  p_start_time TEXT,
  p_end_time TEXT,
  p_status TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_date IS NULL OR p_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'SYNC_INPUT: date must use YYYY-MM-DD' USING ERRCODE = '22023';
  END IF;

  IF p_start_time IS NULL OR p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR p_end_time IS NULL OR p_end_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'SYNC_INPUT: appointment time range is invalid' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'cancelled' THEN
    RETURN;
  END IF;

  PERFORM 1
  FROM public.appointments AS appointment
  WHERE appointment.business_id = p_business_id
    AND appointment.worker_id = p_worker_id
    AND appointment.date = p_date
    AND appointment.is_deleted = FALSE
    AND appointment.status <> 'cancelled'
    AND (p_exclude_id IS NULL OR appointment.id <> p_exclude_id)
    AND appointment.start_time < p_end_time
    AND appointment.end_time > p_start_time;

  IF FOUND THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: appointment overlaps an active slot' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_raise_write_failure(
  p_table TEXT,
  p_id UUID,
  p_business_id UUID,
  p_last_pulled_at BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record_business_id UUID;
  v_record_sync_version BIGINT;
BEGIN
  IF NOT (p_table = ANY (ARRAY['business_config', 'services', 'workers', 'clients', 'appointments', 'payments']::TEXT[])) THEN
    RAISE EXCEPTION 'SYNC_INPUT: unsupported table %', p_table USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'SELECT business_id, sync_version FROM public.%I WHERE id = $1',
    p_table
  )
  INTO v_record_business_id, v_record_sync_version
  USING p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SYNC_NOT_FOUND: % record does not exist', p_table USING ERRCODE = 'P0001';
  END IF;

  IF p_table <> 'business_config' AND v_record_business_id IS DISTINCT FROM p_business_id THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: record is outside the authenticated business' USING ERRCODE = '42501';
  END IF;

  IF v_record_sync_version > p_last_pulled_at THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: record changed on the server' USING ERRCODE = 'P0001';
  END IF;

  RAISE EXCEPTION 'SYNC_WRITE_FAILED: record could not be applied' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_apply_business_config(
  p_record JSONB,
  p_business_id UUID,
  p_last_pulled_at BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF jsonb_typeof(p_record) <> 'object' OR p_record ->> 'id' IS NULL THEN
    RAISE EXCEPTION 'SYNC_INPUT: business_config records need an id' USING ERRCODE = '22023';
  END IF;

  v_id := (p_record ->> 'id')::UUID;
  IF v_id <> p_business_id THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: business config does not belong to the authenticated business' USING ERRCODE = '42501';
  END IF;

  UPDATE public.business_config AS target
  SET
    name = p_record ->> 'name',
    base_currency = p_record ->> 'base_currency',
    timezone = p_record ->> 'timezone'
  WHERE target.id = p_business_id
    AND target.sync_version <= p_last_pulled_at;

  IF NOT FOUND THEN
    PERFORM public.sync_raise_write_failure('business_config', v_id, p_business_id, p_last_pulled_at);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_apply_record(
  p_table TEXT,
  p_record JSONB,
  p_business_id UUID,
  p_last_pulled_at BIGINT,
  p_allow_insert BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_affected BIGINT;
BEGIN
  IF jsonb_typeof(p_record) <> 'object' OR p_record ->> 'id' IS NULL THEN
    RAISE EXCEPTION 'SYNC_INPUT: records must be objects with an id' USING ERRCODE = '22023';
  END IF;

  v_id := (p_record ->> 'id')::UUID;

  IF p_table = 'appointments' THEN
    PERFORM public.assert_appointment_slot_available(
      p_business_id,
      (p_record ->> 'worker_id')::UUID,
      p_record ->> 'date',
      p_record ->> 'start_time',
      p_record ->> 'end_time',
      COALESCE(p_record ->> 'status', 'scheduled'),
      v_id
    );
  END IF;

  IF p_allow_insert THEN
    CASE p_table
      WHEN 'services' THEN
        INSERT INTO public.services (
          id, business_id, name, duration_minutes, default_price_amount,
          default_price_currency, is_active, is_deleted
        )
        SELECT
          source.id, p_business_id, source.name, source.duration_minutes,
          source.default_price_amount, COALESCE(source.default_price_currency, 'ARS'),
          COALESCE(source.is_active, TRUE), FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          name TEXT,
          duration_minutes INTEGER,
          default_price_amount INTEGER,
          default_price_currency TEXT,
          is_active BOOLEAN
        )
        ON CONFLICT (id) DO UPDATE
        SET
          name = EXCLUDED.name,
          duration_minutes = EXCLUDED.duration_minutes,
          default_price_amount = EXCLUDED.default_price_amount,
          default_price_currency = EXCLUDED.default_price_currency,
          is_active = EXCLUDED.is_active,
          is_deleted = FALSE
        WHERE services.business_id = p_business_id
          AND services.sync_version <= p_last_pulled_at;

      WHEN 'workers' THEN
        INSERT INTO public.workers (
          id, business_id, name, commission_type, commission_value,
          commission_currency, is_active, is_deleted
        )
        SELECT
          source.id, p_business_id, source.name, source.commission_type,
          source.commission_value, source.commission_currency,
          COALESCE(source.is_active, TRUE), FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          name TEXT,
          commission_type TEXT,
          commission_value INTEGER,
          commission_currency TEXT,
          is_active BOOLEAN
        )
        ON CONFLICT (id) DO UPDATE
        SET
          name = EXCLUDED.name,
          commission_type = EXCLUDED.commission_type,
          commission_value = EXCLUDED.commission_value,
          commission_currency = EXCLUDED.commission_currency,
          is_active = EXCLUDED.is_active,
          is_deleted = FALSE
        WHERE workers.business_id = p_business_id
          AND workers.sync_version <= p_last_pulled_at;

      WHEN 'clients' THEN
        INSERT INTO public.clients (
          id, business_id, name, phone, notes, is_deleted
        )
        SELECT source.id, p_business_id, source.name, source.phone, source.notes, FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          name TEXT,
          phone TEXT,
          notes TEXT
        )
        ON CONFLICT (id) DO UPDATE
        SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          notes = EXCLUDED.notes,
          is_deleted = FALSE
        WHERE clients.business_id = p_business_id
          AND clients.sync_version <= p_last_pulled_at;

      WHEN 'appointments' THEN
        INSERT INTO public.appointments (
          id, business_id, date, start_time, end_time, status, service_id,
          worker_id, client_id, notes, is_deleted
        )
        SELECT
          source.id, p_business_id, source.date, source.start_time, source.end_time,
          COALESCE(source.status, 'scheduled'), source.service_id, source.worker_id,
          source.client_id, source.notes, FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          date TEXT,
          start_time TEXT,
          end_time TEXT,
          status TEXT,
          service_id UUID,
          worker_id UUID,
          client_id UUID,
          notes TEXT
        )
        ON CONFLICT (id) DO UPDATE
        SET
          date = EXCLUDED.date,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          status = EXCLUDED.status,
          service_id = EXCLUDED.service_id,
          worker_id = EXCLUDED.worker_id,
          client_id = EXCLUDED.client_id,
          notes = EXCLUDED.notes,
          is_deleted = FALSE
        WHERE appointments.business_id = p_business_id
          AND appointments.sync_version <= p_last_pulled_at;

      WHEN 'payments' THEN
        INSERT INTO public.payments (
          id, business_id, appointment_id, amount, currency, method,
          exchange_rate, exchange_base_currency, paid_at, is_deleted
        )
        SELECT
          source.id, p_business_id, source.appointment_id, source.amount,
          source.currency, source.method, source.exchange_rate,
          source.exchange_base_currency, source.paid_at, FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          appointment_id UUID,
          amount INTEGER,
          currency TEXT,
          method TEXT,
          exchange_rate NUMERIC,
          exchange_base_currency TEXT,
          paid_at BIGINT
        )
        ON CONFLICT (id) DO UPDATE
        SET
          appointment_id = EXCLUDED.appointment_id,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          method = EXCLUDED.method,
          exchange_rate = EXCLUDED.exchange_rate,
          exchange_base_currency = EXCLUDED.exchange_base_currency,
          paid_at = EXCLUDED.paid_at,
          is_deleted = FALSE
        WHERE payments.business_id = p_business_id
          AND payments.sync_version <= p_last_pulled_at;

      ELSE
        RAISE EXCEPTION 'SYNC_INPUT: unsupported writable table %', p_table USING ERRCODE = '22023';
    END CASE;
  ELSE
    CASE p_table
      WHEN 'services' THEN
        UPDATE public.services AS target
        SET
          name = source.name,
          duration_minutes = source.duration_minutes,
          default_price_amount = source.default_price_amount,
          default_price_currency = COALESCE(source.default_price_currency, target.default_price_currency),
          is_active = COALESCE(source.is_active, target.is_active),
          is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          name TEXT,
          duration_minutes INTEGER,
          default_price_amount INTEGER,
          default_price_currency TEXT,
          is_active BOOLEAN
        )
        WHERE target.id = source.id
          AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'workers' THEN
        UPDATE public.workers AS target
        SET
          name = source.name,
          commission_type = source.commission_type,
          commission_value = source.commission_value,
          commission_currency = source.commission_currency,
          is_active = COALESCE(source.is_active, target.is_active),
          is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          name TEXT,
          commission_type TEXT,
          commission_value INTEGER,
          commission_currency TEXT,
          is_active BOOLEAN
        )
        WHERE target.id = source.id
          AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'clients' THEN
        UPDATE public.clients AS target
        SET
          name = source.name,
          phone = source.phone,
          notes = source.notes,
          is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          name TEXT,
          phone TEXT,
          notes TEXT
        )
        WHERE target.id = source.id
          AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'appointments' THEN
        UPDATE public.appointments AS target
        SET
          date = source.date,
          start_time = source.start_time,
          end_time = source.end_time,
          status = COALESCE(source.status, target.status),
          service_id = source.service_id,
          worker_id = source.worker_id,
          client_id = source.client_id,
          notes = source.notes,
          is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          date TEXT,
          start_time TEXT,
          end_time TEXT,
          status TEXT,
          service_id UUID,
          worker_id UUID,
          client_id UUID,
          notes TEXT
        )
        WHERE target.id = source.id
          AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'payments' THEN
        UPDATE public.payments AS target
        SET
          appointment_id = source.appointment_id,
          amount = source.amount,
          currency = source.currency,
          method = source.method,
          exchange_rate = source.exchange_rate,
          exchange_base_currency = source.exchange_base_currency,
          paid_at = source.paid_at,
          is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID,
          appointment_id UUID,
          amount INTEGER,
          currency TEXT,
          method TEXT,
          exchange_rate NUMERIC,
          exchange_base_currency TEXT,
          paid_at BIGINT
        )
        WHERE target.id = source.id
          AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      ELSE
        RAISE EXCEPTION 'SYNC_INPUT: unsupported writable table %', p_table USING ERRCODE = '22023';
    END CASE;
  END IF;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    PERFORM public.sync_raise_write_failure(p_table, v_id, p_business_id, p_last_pulled_at);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_apply_soft_delete(
  p_table TEXT,
  p_id UUID,
  p_business_id UUID,
  p_last_pulled_at BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_affected BIGINT;
  v_record_business_id UUID;
  v_record_sync_version BIGINT;
BEGIN
  IF NOT (p_table = ANY (ARRAY['services', 'workers', 'clients', 'appointments', 'payments']::TEXT[])) THEN
    RAISE EXCEPTION 'SYNC_INPUT: unsupported deletable table %', p_table USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'UPDATE public.%I SET is_deleted = TRUE WHERE id = $1 AND business_id = $2 AND sync_version <= $3',
    p_table
  )
  USING p_id, p_business_id, p_last_pulled_at;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected > 0 THEN
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT business_id, sync_version FROM public.%I WHERE id = $1',
    p_table
  )
  INTO v_record_business_id, v_record_sync_version
  USING p_id;

  -- A record created and deleted before its first push has no server row. That
  -- deletion is intentionally idempotent.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_record_business_id IS DISTINCT FROM p_business_id THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: record is outside the authenticated business' USING ERRCODE = '42501';
  END IF;

  IF v_record_sync_version > p_last_pulled_at THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: record changed on the server' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_push(
  p_changes JSONB,
  p_last_pulled_at BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_business_id UUID;
  v_role TEXT;
  v_last_pulled_at BIGINT := COALESCE(p_last_pulled_at, 0);
  v_timestamp BIGINT;
  v_table TEXT;
  v_bucket TEXT;
  v_entries JSONB;
  v_record JSONB;
  v_has_changes BOOLEAN := FALSE;
  v_mutable_tables CONSTANT TEXT[] := ARRAY['services', 'workers', 'clients', 'appointments', 'payments'];
  v_all_tables CONSTANT TEXT[] := ARRAY['business_config', 'user_profiles', 'services', 'workers', 'clients', 'appointments', 'payments'];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authentication is required' USING ERRCODE = '28000';
  END IF;

  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'SYNC_INPUT: changes must be an object' USING ERRCODE = '22023';
  END IF;

  IF v_last_pulled_at < 0 THEN
    RAISE EXCEPTION 'SYNC_INPUT: lastPulledAt must be non-negative' USING ERRCODE = '22023';
  END IF;

  FOR v_table IN SELECT jsonb_object_keys(p_changes) LOOP
    IF NOT (v_table = ANY (v_all_tables)) THEN
      RAISE EXCEPTION 'SYNC_INPUT: unsupported collection %', v_table USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY v_all_tables LOOP
    IF p_changes ? v_table AND jsonb_typeof(p_changes -> v_table) <> 'object' THEN
      RAISE EXCEPTION 'SYNC_INPUT: collection % must be an object', v_table USING ERRCODE = '22023';
    END IF;

    FOREACH v_bucket IN ARRAY ARRAY['created', 'updated', 'deleted'] LOOP
      v_entries := COALESCE(p_changes -> v_table -> v_bucket, '[]'::JSONB);
      IF jsonb_typeof(v_entries) <> 'array' THEN
        RAISE EXCEPTION 'SYNC_INPUT: %.% must be an array', v_table, v_bucket USING ERRCODE = '22023';
      END IF;
      v_has_changes := v_has_changes OR jsonb_array_length(v_entries) > 0;
    END LOOP;
  END LOOP;

  SELECT business_id, role
  INTO v_business_id, v_role
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authenticated user has no profile' USING ERRCODE = '28000';
  END IF;

  IF NOT v_has_changes THEN
    PERFORM pg_advisory_xact_lock(845766531);
    SELECT CASE WHEN is_called THEN last_value ELSE 0 END
    INTO v_timestamp
    FROM public.sync_version_sequence;
    RETURN jsonb_build_object('timestamp', v_timestamp);
  END IF;

  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: only owners may push generic changes' USING ERRCODE = '42501';
  END IF;

  IF jsonb_array_length(COALESCE(p_changes -> 'business_config' -> 'created', '[]'::JSONB)) > 0
    OR jsonb_array_length(COALESCE(p_changes -> 'business_config' -> 'deleted', '[]'::JSONB)) > 0 THEN
    RAISE EXCEPTION 'SYNC_INPUT: business_config can only be updated' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(COALESCE(p_changes -> 'user_profiles' -> 'created', '[]'::JSONB)) > 0
    OR jsonb_array_length(COALESCE(p_changes -> 'user_profiles' -> 'updated', '[]'::JSONB)) > 0
    OR jsonb_array_length(COALESCE(p_changes -> 'user_profiles' -> 'deleted', '[]'::JSONB)) > 0 THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: user profiles are managed by authenticated server flows' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(845766531);

  v_entries := COALESCE(p_changes -> 'business_config' -> 'updated', '[]'::JSONB);
  FOR v_record IN SELECT value FROM jsonb_array_elements(v_entries) LOOP
    PERFORM public.sync_apply_business_config(v_record, v_business_id, v_last_pulled_at);
  END LOOP;

  FOREACH v_table IN ARRAY v_mutable_tables LOOP
    v_entries := COALESCE(p_changes -> v_table -> 'created', '[]'::JSONB);
    FOR v_record IN SELECT value FROM jsonb_array_elements(v_entries) LOOP
      PERFORM public.sync_apply_record(v_table, v_record, v_business_id, v_last_pulled_at, TRUE);
    END LOOP;
  END LOOP;

  FOREACH v_table IN ARRAY v_mutable_tables LOOP
    v_entries := COALESCE(p_changes -> v_table -> 'updated', '[]'::JSONB);
    FOR v_record IN SELECT value FROM jsonb_array_elements(v_entries) LOOP
      PERFORM public.sync_apply_record(v_table, v_record, v_business_id, v_last_pulled_at, FALSE);
    END LOOP;
  END LOOP;

  FOREACH v_table IN ARRAY v_mutable_tables LOOP
    v_entries := COALESCE(p_changes -> v_table -> 'deleted', '[]'::JSONB);
    FOR v_record IN SELECT value FROM jsonb_array_elements(v_entries) LOOP
      IF jsonb_typeof(v_record) <> 'string' THEN
        RAISE EXCEPTION 'SYNC_INPUT: deleted records must be ids' USING ERRCODE = '22023';
      END IF;
      PERFORM public.sync_apply_soft_delete(
        v_table,
        (v_record #>> '{}')::UUID,
        v_business_id,
        v_last_pulled_at
      );
    END LOOP;
  END LOOP;

  SELECT CASE WHEN is_called THEN last_value ELSE 0 END
  INTO v_timestamp
  FROM public.sync_version_sequence;

  RETURN jsonb_build_object('timestamp', v_timestamp);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_pull(
  p_last_pulled_at BIGINT DEFAULT NULL,
  p_schema_version INTEGER DEFAULT 1,
  p_migration JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_business_id UUID;
  v_role TEXT;
  v_worker_id UUID;
  v_last_pulled_at BIGINT := COALESCE(p_last_pulled_at, 0);
  v_timestamp BIGINT;
  v_changes JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authentication is required' USING ERRCODE = '28000';
  END IF;

  IF p_schema_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'SYNC_INPUT: unsupported local schema version' USING ERRCODE = '22023';
  END IF;

  IF v_last_pulled_at < 0 THEN
    RAISE EXCEPTION 'SYNC_INPUT: lastPulledAt must be non-negative' USING ERRCODE = '22023';
  END IF;

  SELECT business_id, role, worker_id
  INTO v_business_id, v_role, v_worker_id
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authenticated user has no profile' USING ERRCODE = '28000';
  END IF;

  PERFORM pg_advisory_xact_lock(845766531);
  SELECT CASE WHEN is_called THEN last_value ELSE 0 END
  INTO v_timestamp
  FROM public.sync_version_sequence;

  IF p_last_pulled_at IS NULL THEN
    v_changes := jsonb_build_object(
      'business_config', jsonb_build_object(
        'created', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.sync_version) FROM public.business_config AS b WHERE b.id = v_business_id), '[]'::JSONB),
        'updated', '[]'::JSONB,
        'deleted', '[]'::JSONB
      ),
      'user_profiles', jsonb_build_object(
        'created', COALESCE((SELECT jsonb_agg(to_jsonb(profile) ORDER BY profile.sync_version) FROM public.user_profiles AS profile WHERE profile.business_id = v_business_id), '[]'::JSONB),
        'updated', '[]'::JSONB,
        'deleted', '[]'::JSONB
      ),
      'services', jsonb_build_object(
        'created', COALESCE((SELECT jsonb_agg(to_jsonb(service) ORDER BY service.sync_version) FROM public.services AS service WHERE service.business_id = v_business_id AND service.is_deleted = FALSE), '[]'::JSONB),
        'updated', '[]'::JSONB,
        'deleted', '[]'::JSONB
      ),
      'workers', jsonb_build_object(
        'created', COALESCE((SELECT jsonb_agg(to_jsonb(worker) ORDER BY worker.sync_version) FROM public.workers AS worker WHERE worker.business_id = v_business_id AND worker.is_deleted = FALSE), '[]'::JSONB),
        'updated', '[]'::JSONB,
        'deleted', '[]'::JSONB
      ),
      'clients', jsonb_build_object(
        'created', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(client) ORDER BY client.sync_version) FROM public.clients AS client WHERE client.business_id = v_business_id AND client.is_deleted = FALSE), '[]'::JSONB) ELSE '[]'::JSONB END,
        'updated', '[]'::JSONB,
        'deleted', '[]'::JSONB
      ),
      'appointments', jsonb_build_object(
        'created', COALESCE((SELECT jsonb_agg(to_jsonb(appointment) ORDER BY appointment.sync_version) FROM public.appointments AS appointment WHERE appointment.business_id = v_business_id AND appointment.is_deleted = FALSE AND (v_role = 'owner' OR appointment.worker_id = v_worker_id)), '[]'::JSONB),
        'updated', '[]'::JSONB,
        'deleted', '[]'::JSONB
      ),
      'payments', jsonb_build_object(
        'created', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(payment) ORDER BY payment.sync_version) FROM public.payments AS payment WHERE payment.business_id = v_business_id AND payment.is_deleted = FALSE), '[]'::JSONB) ELSE '[]'::JSONB END,
        'updated', '[]'::JSONB,
        'deleted', '[]'::JSONB
      )
    );
  ELSE
    -- Incremental responses use `updated` for every extant server row. The
    -- mobile client enables sendCreatedAsUpdated so it can apply rows that are
    -- new to this device; local creations still travel in the `created` bucket.
    v_changes := jsonb_build_object(
      'business_config', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.sync_version) FROM public.business_config AS b WHERE b.id = v_business_id AND b.sync_version > v_last_pulled_at AND b.sync_version <= v_timestamp), '[]'::JSONB),
        'deleted', '[]'::JSONB
      ),
      'user_profiles', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', COALESCE((SELECT jsonb_agg(to_jsonb(profile) ORDER BY profile.sync_version) FROM public.user_profiles AS profile WHERE profile.business_id = v_business_id AND profile.sync_version > v_last_pulled_at AND profile.sync_version <= v_timestamp), '[]'::JSONB),
        'deleted', '[]'::JSONB
      ),
      'services', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', COALESCE((SELECT jsonb_agg(to_jsonb(service) ORDER BY service.sync_version) FROM public.services AS service WHERE service.business_id = v_business_id AND service.is_deleted = FALSE AND service.sync_version > v_last_pulled_at AND service.sync_version <= v_timestamp), '[]'::JSONB),
        'deleted', COALESCE((SELECT jsonb_agg(service.id ORDER BY service.sync_version) FROM public.services AS service WHERE service.business_id = v_business_id AND service.is_deleted = TRUE AND service.sync_version > v_last_pulled_at AND service.sync_version <= v_timestamp), '[]'::JSONB)
      ),
      'workers', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', COALESCE((SELECT jsonb_agg(to_jsonb(worker) ORDER BY worker.sync_version) FROM public.workers AS worker WHERE worker.business_id = v_business_id AND worker.is_deleted = FALSE AND worker.sync_version > v_last_pulled_at AND worker.sync_version <= v_timestamp), '[]'::JSONB),
        'deleted', COALESCE((SELECT jsonb_agg(worker.id ORDER BY worker.sync_version) FROM public.workers AS worker WHERE worker.business_id = v_business_id AND worker.is_deleted = TRUE AND worker.sync_version > v_last_pulled_at AND worker.sync_version <= v_timestamp), '[]'::JSONB)
      ),
      'clients', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(client) ORDER BY client.sync_version) FROM public.clients AS client WHERE client.business_id = v_business_id AND client.is_deleted = FALSE AND client.sync_version > v_last_pulled_at AND client.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END,
        'deleted', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(client.id ORDER BY client.sync_version) FROM public.clients AS client WHERE client.business_id = v_business_id AND client.is_deleted = TRUE AND client.sync_version > v_last_pulled_at AND client.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END
      ),
      'appointments', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', COALESCE((SELECT jsonb_agg(to_jsonb(appointment) ORDER BY appointment.sync_version) FROM public.appointments AS appointment WHERE appointment.business_id = v_business_id AND appointment.is_deleted = FALSE AND appointment.sync_version > v_last_pulled_at AND appointment.sync_version <= v_timestamp AND (v_role = 'owner' OR appointment.worker_id = v_worker_id)), '[]'::JSONB),
        'deleted', COALESCE((SELECT jsonb_agg(appointment.id ORDER BY appointment.sync_version) FROM public.appointments AS appointment WHERE appointment.business_id = v_business_id AND appointment.is_deleted = TRUE AND appointment.sync_version > v_last_pulled_at AND appointment.sync_version <= v_timestamp AND (v_role = 'owner' OR appointment.worker_id = v_worker_id)), '[]'::JSONB)
      ),
      'payments', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(payment) ORDER BY payment.sync_version) FROM public.payments AS payment WHERE payment.business_id = v_business_id AND payment.is_deleted = FALSE AND payment.sync_version > v_last_pulled_at AND payment.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END,
        'deleted', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(payment.id ORDER BY payment.sync_version) FROM public.payments AS payment WHERE payment.business_id = v_business_id AND payment.is_deleted = TRUE AND payment.sync_version > v_last_pulled_at AND payment.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END
      )
    );
  END IF;

  RETURN jsonb_build_object('changes', v_changes, 'timestamp', v_timestamp);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_appointment_slot(
  p_worker_id UUID,
  p_date TEXT,
  p_start_time TEXT,
  p_end_time TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  start_time TEXT,
  end_time TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_business_id UUID;
  v_role TEXT;
  v_current_worker_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authentication is required' USING ERRCODE = '28000';
  END IF;

  SELECT business_id, role, worker_id
  INTO v_business_id, v_role, v_current_worker_id
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authenticated user has no profile' USING ERRCODE = '28000';
  END IF;

  IF v_role = 'worker' AND p_worker_id IS DISTINCT FROM v_current_worker_id THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: workers can only inspect their own agenda' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workers
    WHERE id = p_worker_id
      AND business_id = v_business_id
  ) THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: worker is outside the authenticated business' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_appointment_slot_available(
    v_business_id,
    p_worker_id,
    p_date,
    p_start_time,
    p_end_time,
    'scheduled',
    p_exclude_id
  );

  RETURN QUERY
  SELECT appointment.id, appointment.start_time, appointment.end_time, appointment.status
  FROM public.appointments AS appointment
  WHERE appointment.business_id = v_business_id
    AND appointment.worker_id = p_worker_id
    AND appointment.date = p_date
    AND appointment.is_deleted = FALSE
    AND appointment.status <> 'cancelled'
    AND (p_exclude_id IS NULL OR appointment.id <> p_exclude_id)
    AND appointment.start_time < p_end_time
    AND appointment.end_time > p_start_time
  ORDER BY appointment.start_time, appointment.end_time;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_appointment_slot_available(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_raise_write_failure(TEXT, UUID, UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_apply_business_config(JSONB, UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_apply_record(TEXT, JSONB, UUID, BIGINT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_apply_soft_delete(TEXT, UUID, UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_push(JSONB, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_appointment_slot(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sync_push(JSONB, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_appointment_slot(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
