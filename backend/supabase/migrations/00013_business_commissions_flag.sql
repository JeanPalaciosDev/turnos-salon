-- Migración 00013 — Flag opcional de comisiones a nivel negocio
-- El sistema de comisiones pasa a ser una feature opcional del salón. Cada
-- negocio decide si la usa. Por defecto queda apagada: los negocios existentes
-- no muestran comisiones ni dashboard hasta que el owner la active.
--
-- No editar migraciones ya aplicadas: esta es una migración nueva numerada.

ALTER TABLE public.business_config
  ADD COLUMN IF NOT EXISTS commissions_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- RPC: set_commissions_enabled — activar/desactivar la feature (owner)
-- ============================================================
-- business_config no es mutable por el push genérico (sync_push aplica solo
-- services/workers/clients/appointments/appointment_services/payments). El flag
-- se cambia server-side por esta RPC dedicada, SECURITY DEFINER y owner-only,
-- igual que el bootstrap del negocio. El cliente la invoca online y aplica un
-- update local optimista; el pull confirma el valor autoritativo.
CREATE OR REPLACE FUNCTION public.set_commissions_enabled(p_enabled BOOLEAN)
RETURNS public.business_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_business_id UUID;
  v_role TEXT;
  updated_business public.business_config;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT business_id, role INTO v_business_id, v_role
  FROM public.user_profiles WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The authenticated user has no profile';
  END IF;

  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can change the commissions setting';
  END IF;

  UPDATE public.business_config
  SET commissions_enabled = p_enabled
  WHERE id = v_business_id
  RETURNING * INTO updated_business;

  RETURN updated_business;
END;
$$;

REVOKE ALL ON FUNCTION public.set_commissions_enabled(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_commissions_enabled(BOOLEAN) TO authenticated;
