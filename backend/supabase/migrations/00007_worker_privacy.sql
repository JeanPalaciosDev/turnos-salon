-- Restrict worker visibility to the authenticated profile and worker record.
-- sync_pull is SECURITY DEFINER, so RLS and the RPC filters must change together.

DROP POLICY IF EXISTS "Users can view profiles in own business" ON public.user_profiles;
CREATE POLICY "Users can view own profile or owner can view business profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    business_id = public.get_user_business_id()
    AND (id = auth.uid() OR public.get_user_role() = 'owner')
  );

DROP POLICY IF EXISTS "Users can view workers in own business" ON public.workers;
CREATE POLICY "Users can view own worker or owner can view business workers"
  ON public.workers
  FOR SELECT
  TO authenticated
  USING (
    business_id = public.get_user_business_id()
    AND (id = public.get_user_worker_id() OR public.get_user_role() = 'owner')
  );

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
        'created', COALESCE((SELECT jsonb_agg(to_jsonb(profile) ORDER BY profile.sync_version) FROM public.user_profiles AS profile WHERE profile.business_id = v_business_id AND (v_role = 'owner' OR profile.id = auth.uid())), '[]'::JSONB),
        'updated', '[]'::JSONB,
        'deleted', '[]'::JSONB
      ),
      'services', jsonb_build_object(
        'created', COALESCE((SELECT jsonb_agg(to_jsonb(service) ORDER BY service.sync_version) FROM public.services AS service WHERE service.business_id = v_business_id AND service.is_deleted = FALSE), '[]'::JSONB),
        'updated', '[]'::JSONB,
        'deleted', '[]'::JSONB
      ),
      'workers', jsonb_build_object(
        'created', COALESCE((SELECT jsonb_agg(to_jsonb(worker) ORDER BY worker.sync_version) FROM public.workers AS worker WHERE worker.business_id = v_business_id AND worker.is_deleted = FALSE AND (v_role = 'owner' OR worker.id = v_worker_id)), '[]'::JSONB),
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
    -- Existing server rows are delivered as updated so a new scoped device can apply them.
    v_changes := jsonb_build_object(
      'business_config', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.sync_version) FROM public.business_config AS b WHERE b.id = v_business_id AND b.sync_version > v_last_pulled_at AND b.sync_version <= v_timestamp), '[]'::JSONB),
        'deleted', '[]'::JSONB
      ),
      'user_profiles', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', COALESCE((SELECT jsonb_agg(to_jsonb(profile) ORDER BY profile.sync_version) FROM public.user_profiles AS profile WHERE profile.business_id = v_business_id AND profile.sync_version > v_last_pulled_at AND profile.sync_version <= v_timestamp AND (v_role = 'owner' OR profile.id = auth.uid())), '[]'::JSONB),
        'deleted', '[]'::JSONB
      ),
      'services', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', COALESCE((SELECT jsonb_agg(to_jsonb(service) ORDER BY service.sync_version) FROM public.services AS service WHERE service.business_id = v_business_id AND service.is_deleted = FALSE AND service.sync_version > v_last_pulled_at AND service.sync_version <= v_timestamp), '[]'::JSONB),
        'deleted', COALESCE((SELECT jsonb_agg(service.id ORDER BY service.sync_version) FROM public.services AS service WHERE service.business_id = v_business_id AND service.is_deleted = TRUE AND service.sync_version > v_last_pulled_at AND service.sync_version <= v_timestamp), '[]'::JSONB)
      ),
      'workers', jsonb_build_object(
        'created', '[]'::JSONB,
        'updated', COALESCE((SELECT jsonb_agg(to_jsonb(worker) ORDER BY worker.sync_version) FROM public.workers AS worker WHERE worker.business_id = v_business_id AND worker.is_deleted = FALSE AND worker.sync_version > v_last_pulled_at AND worker.sync_version <= v_timestamp AND (v_role = 'owner' OR worker.id = v_worker_id)), '[]'::JSONB),
        'deleted', COALESCE((SELECT jsonb_agg(worker.id ORDER BY worker.sync_version) FROM public.workers AS worker WHERE worker.business_id = v_business_id AND worker.is_deleted = TRUE AND worker.sync_version > v_last_pulled_at AND worker.sync_version <= v_timestamp AND (v_role = 'owner' OR worker.id = v_worker_id)), '[]'::JSONB)
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

REVOKE ALL ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) TO authenticated;
