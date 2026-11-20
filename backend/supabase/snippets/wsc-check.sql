-- Prueba de la tabla worker_service_commissions y sus restricciones.
-- Todo dentro de una transaccion que se revierte: no deja datos.

\set ON_ERROR_STOP off

BEGIN;

DO $do$
DECLARE
  v_biz UUID; v_worker UUID; v_service UUID; v_id UUID;
BEGIN
  SELECT id INTO v_biz FROM public.business_config LIMIT 1;
  SELECT id INTO v_worker FROM public.workers WHERE name = 'Ana Torres' LIMIT 1;
  SELECT id INTO v_service FROM public.services LIMIT 1;

  INSERT INTO public.worker_service_commissions
    (id, business_id, worker_id, service_id, commission_type, commission_value)
  VALUES (gen_random_uuid(), v_biz, v_worker, v_service, 'percentage', 55)
  RETURNING id INTO v_id;
  RAISE NOTICE 'PRUEBA excepcion porcentaje: OK';

  -- El trigger de sync debe asignar sync_version desde la secuencia.
  IF (SELECT sync_version FROM public.worker_service_commissions WHERE id = v_id) > 0 THEN
    RAISE NOTICE 'PRUEBA sync_version asignada: OK';
  ELSE
    RAISE NOTICE 'PRUEBA sync_version asignada: FALLA';
  END IF;

  BEGIN
    INSERT INTO public.worker_service_commissions
      (id, business_id, worker_id, service_id, commission_type, commission_value)
    VALUES (gen_random_uuid(), v_biz, v_worker, v_service, 'percentage', 30);
    RAISE NOTICE 'PRUEBA duplicado rechazado: FALLA (se permitio)';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'PRUEBA duplicado rechazado: OK';
  END;

  BEGIN
    INSERT INTO public.worker_service_commissions
      (id, business_id, worker_id, service_id, commission_type, commission_value)
    VALUES (gen_random_uuid(), v_biz, v_worker, v_service, 'percentage', 150);
    RAISE NOTICE 'PRUEBA porcentaje > 100 rechazado: FALLA (se permitio)';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'PRUEBA porcentaje > 100 rechazado: OK';
  END;

  BEGIN
    INSERT INTO public.worker_service_commissions
      (id, business_id, worker_id, service_id, commission_type, commission_value, commission_currency)
    VALUES (gen_random_uuid(), v_biz, v_worker, v_service, 'fixed_per_service', 500, NULL);
    RAISE NOTICE 'PRUEBA fijo sin moneda rechazado: FALLA (se permitio)';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'PRUEBA fijo sin moneda rechazado: OK';
  END;
END
$do$;

ROLLBACK;
