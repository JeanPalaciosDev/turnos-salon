-- Migración 00010 — Modelo de dominio del rediseño de UI (2026-09)
-- Alinea el schema con las pantallas del rediseño (README §11). Decisión del
-- usuario: respetar el diseño por encima del schema. Entorno de desarrollo,
-- sin datos reales en riesgo.
--
-- Cambios:
--   1. appointments.status: 6 estados en vez de 4.
--   2. Servicios múltiples por turno: tabla puente appointment_services.
--   3. appointments.worker_id: pasa a OPCIONAL ("Sin asignar").
--   4. Campos nuevos: services.reapplication_days, workers.phone, clients.last_visit.
--
-- No editar migraciones ya aplicadas: esta es una migración nueva numerada.

-- ============================================================
-- 1. ESTADOS DE CITA — 6 estados
-- ============================================================
-- Nuevos estados (claves en snake_case inglés, coherente con el schema):
--   created      (diseño: "Creado")     ← era 'scheduled'
--   pending      (diseño: "Pendiente")  ← nuevo
--   in_progress  (diseño: "En curso")   ← nuevo
--   done         (diseño: "Finalizado") ← era 'completed'
--   no_show      (diseño: "Ausente")    ← se mantiene
--   cancelled    (diseño: "Cancelado")  ← se mantiene

-- El CHECK viejo debe salir antes de re-mapear los datos.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

-- Re-mapeo de los datos existentes al nuevo vocabulario.
UPDATE public.appointments SET status = 'created'  WHERE status = 'scheduled';
UPDATE public.appointments SET status = 'done'     WHERE status = 'completed';
-- 'no_show' y 'cancelled' se conservan tal cual.

-- Nuevo default + CHECK con los 6 estados.
ALTER TABLE public.appointments
  ALTER COLUMN status SET DEFAULT 'created';

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('created', 'pending', 'in_progress', 'done', 'no_show', 'cancelled'));

-- ============================================================
-- 2. SERVICIOS MÚLTIPLES POR TURNO — tabla puente
-- ============================================================
-- El diseño permite varios servicios por turno. Se crea la tabla puente y se
-- migran los service_id existentes. appointments.service_id pasa a OPCIONAL
-- (se conserva por compatibilidad de sync; la fuente de verdad es la puente).

CREATE TABLE public.appointment_services (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES business_config(id),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  service_id UUID NOT NULL REFERENCES services(id),
  -- Snapshot de duración/precio al momento de agendar (el servicio puede cambiar
  -- después). Nullable: se puede completar al conectar la UI.
  duration_minutes INTEGER,
  price_amount INTEGER,     -- centavos
  price_currency TEXT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  sync_version BIGINT NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_appointment_services_appointment
  ON public.appointment_services(appointment_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_appointment_services_service
  ON public.appointment_services(service_id) WHERE is_deleted = FALSE;

-- Migrar el service_id existente de cada cita a la puente.
INSERT INTO public.appointment_services (id, business_id, appointment_id, service_id, duration_minutes, price_amount, price_currency)
SELECT
  gen_random_uuid(),
  a.business_id,
  a.id,
  a.service_id,
  s.duration_minutes,
  s.default_price_amount,
  s.default_price_currency
FROM public.appointments a
JOIN public.services s ON s.id = a.service_id
WHERE a.service_id IS NOT NULL;

-- service_id en appointments pasa a opcional (la puente es la fuente de verdad).
ALTER TABLE public.appointments
  ALTER COLUMN service_id DROP NOT NULL;

-- ============================================================
-- 3. TRABAJADOR OPCIONAL ("Sin asignar")
-- ============================================================
-- El diseño permite turnos sin trabajador asignado. La exclusión GiST de 00004
-- usa `worker_id WITH =`; en Postgres un EXCLUDE con `=` NO compara filas con
-- valor NULL (NULL nunca es igual a nada), así que los turnos "Sin asignar" no
-- participan del anti-solapamiento por trabajador — que es la semántica correcta
-- (un turno sin profesional no ocupa la agenda de nadie). No hay que tocar la
-- constraint GiST; solo relajar el NOT NULL.
ALTER TABLE public.appointments
  ALTER COLUMN worker_id DROP NOT NULL;

-- ============================================================
-- 4. CAMPOS NUEVOS DEL DISEÑO
-- ============================================================
-- Servicio: "Plazo de reaplicación (días)".
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS reapplication_days INTEGER;

-- Trabajador: Teléfono (el diseño lo muestra; la comisión se conserva).
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Cliente: "Última visita" (fecha ISO YYYY-MM-DD como TEXT, coherente con date).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_visit TEXT;

-- ============================================================
-- 5. RPC de validación de slot — cortar temprano si no hay trabajador
-- ============================================================
-- Un turno sin trabajador no puede solapar la agenda de nadie: se salta la
-- verificación. Mantiene la firma de 00006 (p_worker_id ahora puede ser NULL).
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

  -- Estados que no ocupan slot.
  IF p_status = 'cancelled' THEN
    RETURN;
  END IF;

  -- Turno sin trabajador: no compite por la agenda de ningún profesional.
  IF p_worker_id IS NULL THEN
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
