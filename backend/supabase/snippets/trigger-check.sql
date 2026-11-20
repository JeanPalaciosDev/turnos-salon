-- Prueba de diagnostico del trigger validate_business_relationships.
-- Todo ocurre dentro de una transaccion que se revierte: no deja datos.

\set ON_ERROR_STOP off

BEGIN;

DO $do$
DECLARE
  v_biz UUID; v_worker UUID; v_service UUID; v_client UUID; v_appt UUID;
BEGIN
  SELECT id INTO v_biz FROM public.business_config LIMIT 1;
  SELECT id INTO v_worker FROM public.workers WHERE name = 'Ana Torres' LIMIT 1;
  SELECT id INTO v_service FROM public.services LIMIT 1;

  INSERT INTO public.clients (id, business_id, name)
  VALUES (gen_random_uuid(), v_biz, 'Cliente Prueba')
  RETURNING id INTO v_client;
  RAISE NOTICE 'PRUEBA cliente: OK';

  INSERT INTO public.appointments
    (id, business_id, date, start_time, end_time, status, service_id, worker_id, client_id)
  VALUES (gen_random_uuid(), v_biz, '2026-11-19', '10:00', '10:45', 'done',
          v_service, v_worker, v_client)
  RETURNING id INTO v_appt;
  RAISE NOTICE 'PRUEBA turno con trabajador: OK';

  BEGIN
    INSERT INTO public.payments
      (id, business_id, appointment_id, amount, currency, method, paid_at)
    VALUES (gen_random_uuid(), v_biz, v_appt, 1000000, 'ARS', 'cash', 0);
    RAISE NOTICE 'PRUEBA cobro: OK';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'PRUEBA cobro: FALLA -> %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.appointments
      (id, business_id, date, start_time, end_time, status, client_id)
    VALUES (gen_random_uuid(), v_biz, '2026-11-20', '09:00', '09:30', 'created', v_client);
    RAISE NOTICE 'PRUEBA turno sin asignar: OK';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'PRUEBA turno sin asignar: FALLA -> %', SQLERRM;
  END;
END
$do$;

ROLLBACK;
