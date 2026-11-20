-- Migración 00015 — Corregir validate_business_relationships()
--
-- El trigger está conectado a user_profiles, appointments y payments, y tenía dos
-- defectos que bloqueaban funcionalidad:
--
-- 1. La condición `TG_TABLE_NAME = 'user_profiles' AND NEW.worker_id IS NOT NULL`
--    se evalúa como una sola expresión, así que PL/pgSQL debe resolver
--    NEW.worker_id también cuando el trigger corre sobre payments, tabla que no
--    tiene esa columna. Resultado: toda inserción en payments fallaba con
--    `record "new" has no field "worker_id"`, de modo que ningún cobro podía
--    sincronizarse al servidor. Se corrige anidando el acceso a la columna dentro
--    de la rama de su tabla, que es donde PL/pgSQL recién planifica la sentencia.
--
-- 2. La rama de appointments exigía que service_id y worker_id existieran siempre,
--    pero la migración 00010 los volvió OPCIONALES (turnos "Sin asignar" y
--    servicios múltiples a través de appointment_services). Un turno sin
--    trabajador asignado era rechazado. Ahora solo se validan cuando vienen con
--    valor; client_id sigue siendo obligatorio.
--
-- No se edita ninguna migración ya aplicada.

CREATE OR REPLACE FUNCTION public.validate_business_relationships()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'user_profiles' THEN
    IF NEW.worker_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.workers
      WHERE id = NEW.worker_id AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'worker_id must belong to the profile business';
    END IF;

  ELSIF TG_TABLE_NAME = 'appointments' THEN
    -- Opcional desde 00010: la fuente de verdad de servicios es appointment_services.
    IF NEW.service_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.services
      WHERE id = NEW.service_id AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'service_id must belong to the appointment business';
    END IF;

    -- Opcional desde 00010: los turnos "Sin asignar" no tienen trabajador.
    IF NEW.worker_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.workers
      WHERE id = NEW.worker_id AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'worker_id must belong to the appointment business';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = NEW.client_id AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'client_id must belong to the appointment business';
    END IF;

  ELSIF TG_TABLE_NAME = 'payments' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.appointments
      WHERE id = NEW.appointment_id AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'appointment_id must belong to the payment business';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
