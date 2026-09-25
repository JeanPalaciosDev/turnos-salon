-- Migración 00011 — Sincronización de appointment_services (tabla puente de
-- servicios múltiples por turno, creada en 00010).
--
-- La Edge Function `sync` es delgada: valida y delega en las RPCs sync_pull /
-- sync_push, que enumeran las tablas explícitamente. Para que appointment_services
-- sincronice hay que: (1) darle sync_version + trigger + RLS como al resto;
-- (2) recrear sync_apply_record (rama insert/update), sync_apply_soft_delete y
-- sync_raise_write_failure (allowlists), sync_push (arrays de tablas + orden
-- seguro por FK) y sync_pull (agregar la tabla + aceptar schema v2).
--
-- Además corrige un defecto latente: las RPCs de apply usaban 'scheduled' como
-- estado por defecto de appointments, que ya no es válido tras 00010 (6 estados).
-- El nuevo default es 'created'.

-- ============================================================
-- 1. sync_version + trigger + RLS en appointment_services
-- ============================================================
-- La tabla de 00010 nació con sync_version DEFAULT 0; se alinea con el patrón:
-- default por secuencia y el trigger set_sync_metadata lo sobreescribe en cada
-- write (igual que el resto de las tablas).
ALTER TABLE public.appointment_services
  ALTER COLUMN sync_version SET DEFAULT nextval('public.sync_version_sequence');

DROP TRIGGER IF EXISTS set_appointment_services_sync_metadata ON public.appointment_services;
CREATE TRIGGER set_appointment_services_sync_metadata
  BEFORE INSERT OR UPDATE ON public.appointment_services
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- Owner: acceso total dentro de su negocio. Worker: solo lectura de las filas
-- de sus propios turnos (join a appointments por worker_id).
DROP POLICY IF EXISTS "Owner can manage all appointment_services" ON public.appointment_services;
CREATE POLICY "Owner can manage all appointment_services"
  ON public.appointment_services
  FOR ALL
  TO authenticated
  USING (business_id = public.get_user_business_id() AND public.get_user_role() = 'owner')
  WITH CHECK (business_id = public.get_user_business_id() AND public.get_user_role() = 'owner');

DROP POLICY IF EXISTS "Worker can view own appointment_services" ON public.appointment_services;
CREATE POLICY "Worker can view own appointment_services"
  ON public.appointment_services
  FOR SELECT
  TO authenticated
  USING (
    business_id = public.get_user_business_id()
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_services.appointment_id
        AND a.worker_id = public.get_user_worker_id()
    )
  );

-- ============================================================
-- 2. Allowlists de tablas en las RPCs auxiliares
-- ============================================================
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
  IF NOT (p_table = ANY (ARRAY['business_config', 'services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments']::TEXT[])) THEN
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
  IF NOT (p_table = ANY (ARRAY['services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments']::TEXT[])) THEN
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
$$;

-- ============================================================
-- 3. sync_apply_record — rama de appointment_services + fix de default 'created'
-- ============================================================
-- Se recrea completa. Cambios respecto a 00004/00005: (a) default de status de
-- appointments 'scheduled' -> 'created'; (b) nueva rama insert/update de
-- appointment_services; (c) columnas nuevas de 00010 en services/workers/clients/
-- appointments (reapplication_days, phone, last_visit; service_id/worker_id ahora
-- nullable).
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

-- ============================================================
-- 4. sync_push — agregar appointment_services a las allowlists de tablas
-- ============================================================
-- Solo cambia las dos listas de tablas: appointment_services es mutable por el
-- cliente (owner) y forma parte del conjunto sincronizable. El resto del cuerpo
-- de 00004 itera genéricamente sobre p_changes, así que no hace falta reescribirlo:
-- se recrea con las listas ampliadas. El orden FK (appointments antes que la
-- puente) lo garantiza el cliente al construir el push; el apply es idempotente.
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
  v_table TEXT;
  v_bucket TEXT;
  v_entries JSONB;
  v_record JSONB;
  v_mutable_tables CONSTANT TEXT[] := ARRAY['services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments'];
  v_all_tables CONSTANT TEXT[] := ARRAY['business_config', 'user_profiles', 'services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments'];
  -- Orden de aplicación seguro por FK: primero appointments, luego la puente.
  v_apply_order CONSTANT TEXT[] := ARRAY['services', 'workers', 'clients', 'appointments', 'appointment_services', 'payments'];
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
$$;

REVOKE ALL ON FUNCTION public.sync_push(JSONB, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_push(JSONB, BIGINT) TO authenticated;

-- ============================================================
-- 5. sync_pull — aceptar schema v2 y entregar appointment_services
-- ============================================================
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
  v_as JSONB;  -- appointment_services
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authentication is required' USING ERRCODE = '28000';
  END IF;

  -- 00010 subió el schema local a 2. Se aceptan 1 y 2 durante la transición.
  IF p_schema_version NOT IN (1, 2) THEN
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
      'payments', jsonb_build_object('created', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.sync_version) FROM public.payments AS p WHERE p.business_id = v_business_id AND p.is_deleted = FALSE), '[]'::JSONB) ELSE '[]'::JSONB END, 'updated', '[]'::JSONB, 'deleted', '[]'::JSONB)
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
      'payments', jsonb_build_object('created', '[]'::JSONB, 'updated', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.sync_version) FROM public.payments AS p WHERE p.business_id = v_business_id AND p.is_deleted = FALSE AND p.sync_version > v_last_pulled_at AND p.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END, 'deleted', CASE WHEN v_role = 'owner' THEN COALESCE((SELECT jsonb_agg(p.id ORDER BY p.sync_version) FROM public.payments AS p WHERE p.business_id = v_business_id AND p.is_deleted = TRUE AND p.sync_version > v_last_pulled_at AND p.sync_version <= v_timestamp), '[]'::JSONB) ELSE '[]'::JSONB END)
    );
  END IF;

  RETURN jsonb_build_object('changes', v_changes, 'timestamp', v_timestamp);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) TO authenticated;
