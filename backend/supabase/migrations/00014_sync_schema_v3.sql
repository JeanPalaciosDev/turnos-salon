-- Migración 00014 — Aceptar schema local v3 en sync_pull
-- El schema local de WatermelonDB subió a 3 (columna business_config.commissions_enabled,
-- migración 00013). sync_pull solo admitía 1 y 2, así que todo pull de una app v3 era
-- rechazado con SYNC_INPUT: unsupported local schema version y la sincronización quedaba
-- bloqueada por completo.
--
-- La función se reproduce tal como quedó en 00011; el único cambio es la lista de versiones
-- de schema admitidas. No se edita ninguna migración ya aplicada.

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
  IF p_schema_version NOT IN (1, 2, 3) THEN
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
$function$;

REVOKE ALL ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pull(BIGINT, INTEGER, JSONB) TO authenticated;
