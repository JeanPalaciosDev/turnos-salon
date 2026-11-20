-- Migración 00016 — Comisión por servicio (excepciones por trabajador)
--
-- La comisión por defecto de cada trabajador ya vive en workers
-- (commission_type / commission_value / commission_currency) y ya sincroniza por
-- el push genérico. Esta migración agrega las EXCEPCIONES por servicio: un
-- trabajador puede cobrar un porcentaje o monto fijo distinto en servicios
-- puntuales. La regla más específica gana; si el servicio no tiene excepción se
-- usa la regla por defecto del trabajador (ver @turnos/core resolveCommissionRule).
--
-- La tabla sigue el patrón de appointment_services (00011): sync_version por
-- secuencia + trigger set_sync_metadata + RLS + alta en las RPCs de sync, para
-- que el owner pueda configurarla offline y viaje por el push genérico.
--
-- Las comisiones son datos solo del owner (canViewCommissions), así que tanto la
-- RLS como sync_pull las entregan únicamente a la cuenta owner.
--
-- Las funciones de sync se reproducen tal como estaban; el único cambio es el
-- alta de esta tabla y la aceptación del schema local v4. No se edita ninguna
-- migración ya aplicada.

-- ============================================================
-- 1. Tabla
-- ============================================================
CREATE TABLE IF NOT EXISTS public.worker_service_commissions (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.business_config(id),
  worker_id UUID NOT NULL REFERENCES public.workers(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed_per_service')),
  commission_value INTEGER NOT NULL CHECK (commission_value >= 0),
  commission_currency TEXT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  sync_version BIGINT NOT NULL DEFAULT nextval('public.sync_version_sequence'),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  -- Misma regla de consistencia que workers: el porcentaje no lleva moneda y el
  -- monto fijo exige una moneda ISO de tres letras.
  CONSTRAINT worker_service_commissions_currency_consistent CHECK (
    (commission_type = 'percentage' AND commission_currency IS NULL)
    OR (commission_type = 'fixed_per_service' AND commission_currency ~ '^[A-Z]{3}$')
  ),
  CONSTRAINT worker_service_commissions_percentage_range CHECK (
    commission_type <> 'percentage' OR commission_value <= 100
  )
);

-- Una sola excepción activa por trabajador y servicio.
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_service_commissions_worker_service
  ON public.worker_service_commissions(worker_id, service_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_worker_service_commissions_worker
  ON public.worker_service_commissions(worker_id) WHERE is_deleted = FALSE;

DROP TRIGGER IF EXISTS set_worker_service_commissions_sync_metadata ON public.worker_service_commissions;
CREATE TRIGGER set_worker_service_commissions_sync_metadata
  BEFORE INSERT OR UPDATE ON public.worker_service_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();

ALTER TABLE public.worker_service_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can manage all worker_service_commissions" ON public.worker_service_commissions;
CREATE POLICY "Owner can manage all worker_service_commissions"
  ON public.worker_service_commissions
  FOR ALL
  TO authenticated
  USING (business_id = public.get_user_business_id() AND public.get_user_role() = 'owner')
  WITH CHECK (business_id = public.get_user_business_id() AND public.get_user_role() = 'owner');

-- ============================================================
-- 2. Alta de la tabla en las RPCs de sync
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_raise_write_failure(p_table text, p_id uuid, p_business_id uuid, p_last_pulled_at bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_record_business_id UUID;
  v_record_sync_version BIGINT;
BEGIN
  IF NOT (p_table = ANY (ARRAY['business_config', 'services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments', 'worker_service_commissions']::TEXT[])) THEN
    RAISE EXCEPTION 'SYNC_INPUT: unsupported table %', p_table USING ERRCODE = '22023';
  END IF;

  EXECUTE format('SELECT business_id, sync_version FROM public.%I WHERE id = $1', p_table)
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_apply_soft_delete(p_table text, p_id uuid, p_business_id uuid, p_last_pulled_at bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_affected BIGINT;
  v_record_business_id UUID;
  v_record_sync_version BIGINT;
BEGIN
  IF NOT (p_table = ANY (ARRAY['services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments', 'worker_service_commissions']::TEXT[])) THEN
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

  EXECUTE format('SELECT business_id, sync_version FROM public.%I WHERE id = $1', p_table)
  INTO v_record_business_id, v_record_sync_version
  USING p_id;

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
$function$;

CREATE OR REPLACE FUNCTION public.sync_apply_record(p_table text, p_record jsonb, p_business_id uuid, p_last_pulled_at bigint, p_allow_insert boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      COALESCE(p_record ->> 'status', 'created'),
      v_id
    );
  END IF;

  IF p_allow_insert THEN
    CASE p_table
      WHEN 'services' THEN
        INSERT INTO public.services (
          id, business_id, name, duration_minutes, default_price_amount,
          default_price_currency, is_active, reapplication_days, is_deleted
        )
        SELECT source.id, p_business_id, source.name, source.duration_minutes,
          source.default_price_amount, COALESCE(source.default_price_currency, 'ARS'),
          COALESCE(source.is_active, TRUE), source.reapplication_days, FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, name TEXT, duration_minutes INTEGER, default_price_amount INTEGER,
          default_price_currency TEXT, is_active BOOLEAN, reapplication_days INTEGER
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, duration_minutes = EXCLUDED.duration_minutes,
          default_price_amount = EXCLUDED.default_price_amount,
          default_price_currency = EXCLUDED.default_price_currency,
          is_active = EXCLUDED.is_active, reapplication_days = EXCLUDED.reapplication_days,
          is_deleted = FALSE
        WHERE services.business_id = p_business_id AND services.sync_version <= p_last_pulled_at;

      WHEN 'workers' THEN
        INSERT INTO public.workers (
          id, business_id, name, commission_type, commission_value,
          commission_currency, phone, is_active, is_deleted
        )
        SELECT source.id, p_business_id, source.name, source.commission_type,
          source.commission_value, source.commission_currency, source.phone,
          COALESCE(source.is_active, TRUE), FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, name TEXT, commission_type TEXT, commission_value INTEGER,
          commission_currency TEXT, phone TEXT, is_active BOOLEAN
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, commission_type = EXCLUDED.commission_type,
          commission_value = EXCLUDED.commission_value,
          commission_currency = EXCLUDED.commission_currency, phone = EXCLUDED.phone,
          is_active = EXCLUDED.is_active, is_deleted = FALSE
        WHERE workers.business_id = p_business_id AND workers.sync_version <= p_last_pulled_at;

      WHEN 'clients' THEN
        INSERT INTO public.clients (id, business_id, name, phone, notes, last_visit, is_deleted)
        SELECT source.id, p_business_id, source.name, source.phone, source.notes, source.last_visit, FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, name TEXT, phone TEXT, notes TEXT, last_visit TEXT
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, phone = EXCLUDED.phone, notes = EXCLUDED.notes,
          last_visit = EXCLUDED.last_visit, is_deleted = FALSE
        WHERE clients.business_id = p_business_id AND clients.sync_version <= p_last_pulled_at;

      WHEN 'appointments' THEN
        INSERT INTO public.appointments (
          id, business_id, date, start_time, end_time, status, service_id,
          worker_id, client_id, notes, is_deleted
        )
        SELECT source.id, p_business_id, source.date, source.start_time, source.end_time,
          COALESCE(source.status, 'created'), source.service_id, source.worker_id,
          source.client_id, source.notes, FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, date TEXT, start_time TEXT, end_time TEXT, status TEXT,
          service_id UUID, worker_id UUID, client_id UUID, notes TEXT
        )
        ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
          status = EXCLUDED.status, service_id = EXCLUDED.service_id,
          worker_id = EXCLUDED.worker_id, client_id = EXCLUDED.client_id,
          notes = EXCLUDED.notes, is_deleted = FALSE
        WHERE appointments.business_id = p_business_id AND appointments.sync_version <= p_last_pulled_at;

      WHEN 'appointment_services' THEN
        INSERT INTO public.appointment_services (
          id, business_id, appointment_id, service_id, duration_minutes,
          price_amount, price_currency, is_deleted
        )
        SELECT source.id, p_business_id, source.appointment_id, source.service_id,
          source.duration_minutes, source.price_amount, source.price_currency, FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, appointment_id UUID, service_id UUID, duration_minutes INTEGER,
          price_amount INTEGER, price_currency TEXT
        )
        ON CONFLICT (id) DO UPDATE SET
          appointment_id = EXCLUDED.appointment_id, service_id = EXCLUDED.service_id,
          duration_minutes = EXCLUDED.duration_minutes, price_amount = EXCLUDED.price_amount,
          price_currency = EXCLUDED.price_currency, is_deleted = FALSE
        WHERE appointment_services.business_id = p_business_id
          AND appointment_services.sync_version <= p_last_pulled_at;

      WHEN 'payments' THEN
        INSERT INTO public.payments (
          id, business_id, appointment_id, amount, currency, method,
          exchange_rate, exchange_base_currency, paid_at, is_deleted
        )
        SELECT source.id, p_business_id, source.appointment_id, source.amount,
          source.currency, source.method, source.exchange_rate,
          source.exchange_base_currency, source.paid_at, FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, appointment_id UUID, amount INTEGER, currency TEXT, method TEXT,
          exchange_rate NUMERIC, exchange_base_currency TEXT, paid_at BIGINT
        )
        ON CONFLICT (id) DO UPDATE SET
          appointment_id = EXCLUDED.appointment_id, amount = EXCLUDED.amount,
          currency = EXCLUDED.currency, method = EXCLUDED.method,
          exchange_rate = EXCLUDED.exchange_rate,
          exchange_base_currency = EXCLUDED.exchange_base_currency,
          paid_at = EXCLUDED.paid_at, is_deleted = FALSE
        WHERE payments.business_id = p_business_id AND payments.sync_version <= p_last_pulled_at;

      WHEN 'worker_service_commissions' THEN
        INSERT INTO public.worker_service_commissions (
          id, business_id, worker_id, service_id, commission_type,
          commission_value, commission_currency, is_deleted
        )
        SELECT source.id, p_business_id, source.worker_id, source.service_id,
          source.commission_type, source.commission_value, source.commission_currency, FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, worker_id UUID, service_id UUID, commission_type TEXT,
          commission_value INTEGER, commission_currency TEXT
        )
        ON CONFLICT (id) DO UPDATE SET
          worker_id = EXCLUDED.worker_id, service_id = EXCLUDED.service_id,
          commission_type = EXCLUDED.commission_type,
          commission_value = EXCLUDED.commission_value,
          commission_currency = EXCLUDED.commission_currency, is_deleted = FALSE
        WHERE worker_service_commissions.business_id = p_business_id AND worker_service_commissions.sync_version <= p_last_pulled_at;

      ELSE
        RAISE EXCEPTION 'SYNC_INPUT: unsupported writable table %', p_table USING ERRCODE = '22023';
    END CASE;
  ELSE
    CASE p_table
      WHEN 'services' THEN
        UPDATE public.services AS target SET
          name = source.name, duration_minutes = source.duration_minutes,
          default_price_amount = source.default_price_amount,
          default_price_currency = COALESCE(source.default_price_currency, target.default_price_currency),
          is_active = COALESCE(source.is_active, target.is_active),
          reapplication_days = source.reapplication_days, is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, name TEXT, duration_minutes INTEGER, default_price_amount INTEGER,
          default_price_currency TEXT, is_active BOOLEAN, reapplication_days INTEGER
        )
        WHERE target.id = source.id AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'workers' THEN
        UPDATE public.workers AS target SET
          name = source.name, commission_type = source.commission_type,
          commission_value = source.commission_value,
          commission_currency = source.commission_currency, phone = source.phone,
          is_active = COALESCE(source.is_active, target.is_active), is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, name TEXT, commission_type TEXT, commission_value INTEGER,
          commission_currency TEXT, phone TEXT, is_active BOOLEAN
        )
        WHERE target.id = source.id AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'clients' THEN
        UPDATE public.clients AS target SET
          name = source.name, phone = source.phone, notes = source.notes,
          last_visit = source.last_visit, is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, name TEXT, phone TEXT, notes TEXT, last_visit TEXT
        )
        WHERE target.id = source.id AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'appointments' THEN
        UPDATE public.appointments AS target SET
          date = source.date, start_time = source.start_time, end_time = source.end_time,
          status = COALESCE(source.status, target.status), service_id = source.service_id,
          worker_id = source.worker_id, client_id = source.client_id,
          notes = source.notes, is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, date TEXT, start_time TEXT, end_time TEXT, status TEXT,
          service_id UUID, worker_id UUID, client_id UUID, notes TEXT
        )
        WHERE target.id = source.id AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'appointment_services' THEN
        UPDATE public.appointment_services AS target SET
          appointment_id = source.appointment_id, service_id = source.service_id,
          duration_minutes = source.duration_minutes, price_amount = source.price_amount,
          price_currency = source.price_currency, is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, appointment_id UUID, service_id UUID, duration_minutes INTEGER,
          price_amount INTEGER, price_currency TEXT
        )
        WHERE target.id = source.id AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'payments' THEN
        UPDATE public.payments AS target SET
          appointment_id = source.appointment_id, amount = source.amount,
          currency = source.currency, method = source.method,
          exchange_rate = source.exchange_rate,
          exchange_base_currency = source.exchange_base_currency,
          paid_at = source.paid_at, is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, appointment_id UUID, amount INTEGER, currency TEXT, method TEXT,
          exchange_rate NUMERIC, exchange_base_currency TEXT, paid_at BIGINT
        )
        WHERE target.id = source.id AND target.business_id = p_business_id
          AND target.sync_version <= p_last_pulled_at;

      WHEN 'worker_service_commissions' THEN
        UPDATE public.worker_service_commissions AS target SET
          worker_id = source.worker_id, service_id = source.service_id,
          commission_type = source.commission_type,
          commission_value = source.commission_value,
          commission_currency = source.commission_currency, is_deleted = FALSE
        FROM jsonb_to_record(p_record) AS source(
          id UUID, worker_id UUID, service_id UUID, commission_type TEXT,
          commission_value INTEGER, commission_currency TEXT
        )
        WHERE target.id = source.id AND target.business_id = p_business_id
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_push(p_changes jsonb, p_last_pulled_at bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_business_id UUID;
  v_role TEXT;
  v_last_pulled_at BIGINT := COALESCE(p_last_pulled_at, 0);
  v_table TEXT;
  v_bucket TEXT;
  v_entries JSONB;
  v_record JSONB;
  v_mutable_tables CONSTANT TEXT[] := ARRAY['services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments', 'worker_service_commissions'];
  v_all_tables CONSTANT TEXT[] := ARRAY['business_config', 'user_profiles', 'services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments', 'worker_service_commissions'];
  -- Orden de aplicación seguro por FK: primero appointments, luego la puente.
  v_apply_order CONSTANT TEXT[] := ARRAY['services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments', 'worker_service_commissions'];
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

  SELECT business_id, role INTO v_business_id, v_role
  FROM public.user_profiles WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authenticated user has no profile' USING ERRCODE = '28000';
  END IF;

  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: only owners can push generic changes' USING ERRCODE = '42501';
  END IF;

  -- Aplicar en orden FK-seguro.
  FOREACH v_table IN ARRAY v_apply_order LOOP
    IF p_changes ? v_table THEN
      -- created + updated -> upsert; deleted -> soft delete.
      FOR v_bucket IN SELECT unnest(ARRAY['created', 'updated']) LOOP
        v_entries := p_changes -> v_table -> v_bucket;
        IF v_entries IS NOT NULL AND jsonb_typeof(v_entries) = 'array' THEN
          FOR v_record IN SELECT * FROM jsonb_array_elements(v_entries) LOOP
            PERFORM public.sync_apply_record(
              v_table, v_record, v_business_id, v_last_pulled_at,
              v_bucket = 'created'
            );
          END LOOP;
        END IF;
      END LOOP;

      v_entries := p_changes -> v_table -> 'deleted';
      IF v_entries IS NOT NULL AND jsonb_typeof(v_entries) = 'array' THEN
        FOR v_record IN SELECT * FROM jsonb_array_elements(v_entries) LOOP
          PERFORM public.sync_apply_soft_delete(
            v_table, (v_record #>> '{}')::UUID, v_business_id, v_last_pulled_at
          );
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_pull(p_last_pulled_at bigint DEFAULT NULL::bigint, p_schema_version integer DEFAULT 1, p_migration jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_business_id UUID;
  v_role TEXT;
  v_worker_id UUID;
  v_last_pulled_at BIGINT := COALESCE(p_last_pulled_at, 0);
  v_timestamp BIGINT;
  v_changes JSONB;
  v_as JSONB;  -- appointment_services
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authentication is required' USING ERRCODE = '28000';
  END IF;

  -- Versiones de schema local admitidas: 1 (inicial), 2 (00010) y 3 (00013).
  IF p_schema_version NOT IN (1, 2, 3, 4) THEN
    RAISE EXCEPTION 'SYNC_INPUT: unsupported local schema version' USING ERRCODE = '22023';
  END IF;

  IF v_last_pulled_at < 0 THEN
    RAISE EXCEPTION 'SYNC_INPUT: lastPulledAt must be non-negative' USING ERRCODE = '22023';
  END IF;

  SELECT business_id, role, worker_id INTO v_business_id, v_role, v_worker_id
  FROM public.user_profiles WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authenticated user has no profile' USING ERRCODE = '28000';
  END IF;

  PERFORM pg_advisory_xact_lock(845766531);
  SELECT CASE WHEN is_called THEN last_value ELSE 0 END INTO v_timestamp
  FROM public.sync_version_sequence;

  -- Delegar el grueso del pull a la versión previa (recrea business_config,
  -- user_profiles, services, workers, clients, appointments, payments) llamando
  -- la lógica ya probada no es posible porque se reemplazó; en su lugar se
  -- construye el bloque de appointment_services y se fusiona con lo que arma
  -- la RPC anterior. Para evitar duplicar ~120 líneas, se recalcula solo la
  -- tabla puente y se hace jsonb concat sobre el resultado de un pull interno.
  --
  -- Nota: como sync_pull fue redefinida acá, incluimos el conjunto COMPLETO.

  IF p_last_pulled_at IS NULL THEN
    v_as := jsonb_build_object(
      'created', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sync_version) FROM public.appointment_services AS x WHERE x.business_id = v_business_id AND x.is_deleted = FALSE AND (v_role = 'owner' OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = x.appointment_id AND a.worker_id = v_worker_id))), '[]'::JSONB),
      'updated', '[]'::JSONB,
      'deleted', '[]'::JSONB
    );
    v_changes := jsonb_build_object(
      'business_config', jsonb_build_object('created', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.sync_version) FROM public.business_config AS b WHERE b.id = v_business_id), '[]'::JSONB), 'updated', '[]'::JSONB, 'deleted', '[]'::JSONB),
      'user_profiles', jsonb_build_object('created', COALESCE((SELECT jsonb_agg(to_jsonb(profile) ORDER BY profile.sync_version) FROM public.user_profiles AS profile WHERE profile.business_id = v_business_id AND (v_role = 'owner' OR profile.id = auth.uid())), '[]'::JSONB), 'updated', '[]'::JSONB, 'deleted', '[]'::JSONB),
      'services', jsonb_build_object('created', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sync_version) FROM public.services AS s WHERE s.business_id = v_business_id AND s.is_deleted = FALSE), '[]'::JSONB), 'updated', '[]'::JSONB, 'deleted', '[]'::JSONB),
      'workers', jsonb_build_object('created', COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.sync_version) FROM public.workers AS w WHERE w.business_id = v_business_id AND w.is_deleted = FALSE AND (v_role = 'owner' OR w.id = v_worker_id)), '[]'::JSONB), 'updated', '[]'::JSONB, 'deleted', '[]'::JSONB),
      'clients', jsonb_build_object('created', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sync_version) FROM public.clients AS c WHERE c.business_id = v_business_id AND c.is_deleted = FALSE), '[]'::JSONB) ELSE '[]'::JSONB END, 'updated', '[]'::JSONB, 'deleted', '[]'::JSONB),
      'appointments', jsonb_build_object('created', COALESCE((SELECT jsonb_agg(to_jsonb(ap) ORDER BY ap.sync_version) FROM public.appointments AS ap WHERE ap.business_id = v_business_id AND ap.is_deleted = FALSE AND (v_role = 'owner' OR ap.worker_id = v_worker_id)), '[]'::JSONB), 'updated', '[]'::JSONB, 'deleted', '[]'::JSONB),
      'appointment_services', v_as,
      'payments', jsonb_build_object('created', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.sync_version) FROM public.payments AS p WHERE p.business_id = v_business_id AND p.is_deleted = FALSE), '[]'::JSONB) ELSE '[]'::JSONB END, 'updated', '[]'::JSONB, 'deleted', '[]'::JSONB),
      'worker_service_commissions', jsonb_build_object('created', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(wsc) ORDER BY wsc.sync_version) FROM public.worker_service_commissions AS wsc WHERE wsc.business_id = v_business_id AND wsc.is_deleted = FALSE), '[]'::JSONB) ELSE '[]'::JSONB END, 'updated', '[]'::JSONB, 'deleted', '[]'::JSONB)
    );
  ELSE
    v_as := jsonb_build_object(
      'created', '[]'::JSONB,
      'updated', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sync_version) FROM public.appointment_services AS x WHERE x.business_id = v_business_id AND x.is_deleted = FALSE AND x.sync_version > v_last_pulled_at AND x.sync_version <= v_timestamp AND (v_role = 'owner' OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = x.appointment_id AND a.worker_id = v_worker_id))), '[]'::JSONB),
      'deleted', COALESCE((SELECT jsonb_agg(x.id ORDER BY x.sync_version) FROM public.appointment_services AS x WHERE x.business_id = v_business_id AND x.is_deleted = TRUE AND x.sync_version > v_last_pulled_at AND x.sync_version <= v_timestamp AND (v_role = 'owner' OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = x.appointment_id AND a.worker_id = v_worker_id))), '[]'::JSONB)
    );
    v_changes := jsonb_build_object(
      'business_config', jsonb_build_object('created', '[]'::JSONB, 'updated', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.sync_version) FROM public.business_config AS b WHERE b.id = v_business_id AND b.sync_version > v_last_pulled_at AND b.sync_version <= v_timestamp), '[]'::JSONB), 'deleted', '[]'::JSONB),
      'user_profiles', jsonb_build_object('created', '[]'::JSONB, 'updated', COALESCE((SELECT jsonb_agg(to_jsonb(profile) ORDER BY profile.sync_version) FROM public.user_profiles AS profile WHERE profile.business_id = v_business_id AND profile.sync_version > v_last_pulled_at AND profile.sync_version <= v_timestamp AND (v_role = 'owner' OR profile.id = auth.uid())), '[]'::JSONB), 'deleted', '[]'::JSONB),
      'services', jsonb_build_object('created', '[]'::JSONB, 'updated', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sync_version) FROM public.services AS s WHERE s.business_id = v_business_id AND s.is_deleted = FALSE AND s.sync_version > v_last_pulled_at AND s.sync_version <= v_timestamp), '[]'::JSONB), 'deleted', COALESCE((SELECT jsonb_agg(s.id ORDER BY s.sync_version) FROM public.services AS s WHERE s.business_id = v_business_id AND s.is_deleted = TRUE AND s.sync_version > v_last_pulled_at AND s.sync_version <= v_timestamp), '[]'::JSONB)),
      'workers', jsonb_build_object('created', '[]'::JSONB, 'updated', COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.sync_version) FROM public.workers AS w WHERE w.business_id = v_business_id AND w.is_deleted = FALSE AND w.sync_version > v_last_pulled_at AND w.sync_version <= v_timestamp AND (v_role = 'owner' OR w.id = v_worker_id)), '[]'::JSONB), 'deleted', COALESCE((SELECT jsonb_agg(w.id ORDER BY w.sync_version) FROM public.workers AS w WHERE w.business_id = v_business_id AND w.is_deleted = TRUE AND w.sync_version > v_last_pulled_at AND w.sync_version <= v_timestamp AND (v_role = 'owner' OR w.id = v_worker_id)), '[]'::JSONB)),
      'clients', jsonb_build_object('created', '[]'::JSONB, 'updated', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sync_version) FROM public.clients AS c WHERE c.business_id = v_business_id AND c.is_deleted = FALSE AND c.sync_version > v_last_pulled_at AND c.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END, 'deleted', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(c.id ORDER BY c.sync_version) FROM public.clients AS c WHERE c.business_id = v_business_id AND c.is_deleted = TRUE AND c.sync_version > v_last_pulled_at AND c.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END),
      'appointments', jsonb_build_object('created', '[]'::JSONB, 'updated', COALESCE((SELECT jsonb_agg(to_jsonb(ap) ORDER BY ap.sync_version) FROM public.appointments AS ap WHERE ap.business_id = v_business_id AND ap.is_deleted = FALSE AND ap.sync_version > v_last_pulled_at AND ap.sync_version <= v_timestamp AND (v_role = 'owner' OR ap.worker_id = v_worker_id)), '[]'::JSONB), 'deleted', COALESCE((SELECT jsonb_agg(ap.id ORDER BY ap.sync_version) FROM public.appointments AS ap WHERE ap.business_id = v_business_id AND ap.is_deleted = TRUE AND ap.sync_version > v_last_pulled_at AND ap.sync_version <= v_timestamp AND (v_role = 'owner' OR ap.worker_id = v_worker_id)), '[]'::JSONB)),
      'appointment_services', v_as,
      'payments', jsonb_build_object('created', '[]'::JSONB, 'updated', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.sync_version) FROM public.payments AS p WHERE p.business_id = v_business_id AND p.is_deleted = FALSE AND p.sync_version > v_last_pulled_at AND p.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END, 'deleted', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(p.id ORDER BY p.sync_version) FROM public.payments AS p WHERE p.business_id = v_business_id AND p.is_deleted = TRUE AND p.sync_version > v_last_pulled_at AND p.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END),
      'worker_service_commissions', jsonb_build_object('created', '[]'::JSONB, 'updated', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(wsc) ORDER BY wsc.sync_version) FROM public.worker_service_commissions AS wsc WHERE wsc.business_id = v_business_id AND wsc.is_deleted = FALSE AND wsc.sync_version > v_last_pulled_at AND wsc.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END, 'deleted', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(wsc.id ORDER BY wsc.sync_version) FROM public.worker_service_commissions AS wsc WHERE wsc.business_id = v_business_id AND wsc.is_deleted = TRUE AND wsc.sync_version > v_last_pulled_at AND wsc.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END)
    );
  END IF;

  RETURN jsonb_build_object('changes', v_changes, 'timestamp', v_timestamp);
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_push(JSONB, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_push(JSONB, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) TO authenticated;
