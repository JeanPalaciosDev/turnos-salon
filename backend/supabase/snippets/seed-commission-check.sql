-- Dato de prueba local para validar el calculo de comisiones (tarea 15).
-- Crea un cliente, un turno finalizado de Ana Torres con un servicio y un cobro.
-- Solo para la instancia local; no es una migracion.
--
-- Esperado con comision 40% sobre un cobro de 1000000 (unidad minima):
--   recaudado = 1000000, comision = 400000, neto = 600000.

WITH b AS (
  SELECT id AS business_id, base_currency FROM public.business_config LIMIT 1
), w AS (
  SELECT id AS worker_id FROM public.workers WHERE name = 'Ana Torres' LIMIT 1
), s AS (
  SELECT id AS service_id, duration_minutes, default_price_amount, default_price_currency
  FROM public.services WHERE name = 'Corte y peinado' LIMIT 1
), new_client AS (
  INSERT INTO public.clients (id, business_id, name, phone)
  SELECT gen_random_uuid(), b.business_id, 'Maria Lopez', '11 5555 4444' FROM b
  RETURNING id, business_id
), new_appt AS (
  INSERT INTO public.appointments
    (id, business_id, date, start_time, end_time, status, service_id, worker_id, client_id)
  SELECT gen_random_uuid(), b.business_id,
         to_char((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD'),
         '10:00', '10:45', 'done', s.service_id, w.worker_id, nc.id
  FROM b, w, s, new_client nc
  RETURNING id, business_id
), bridge AS (
  INSERT INTO public.appointment_services
    (id, business_id, appointment_id, service_id, duration_minutes, price_amount, price_currency)
  SELECT gen_random_uuid(), na.business_id, na.id, s.service_id,
         s.duration_minutes, s.default_price_amount, s.default_price_currency
  FROM new_appt na, s
  RETURNING id
), pay AS (
  INSERT INTO public.payments
    (id, business_id, appointment_id, amount, currency, method, paid_at)
  SELECT gen_random_uuid(), na.business_id, na.id, s.default_price_amount,
         b.base_currency, 'cash',
         (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT
  FROM new_appt na, s, b
  RETURNING id, amount
)
SELECT 'sembrado: cobro=' || (SELECT amount FROM pay)
    || ' | turnos_done=' || (SELECT count(*) FROM public.appointments WHERE status = 'done')
    || ' | servicios_puente=' || (SELECT count(*) FROM public.appointment_services)
    AS resultado;
