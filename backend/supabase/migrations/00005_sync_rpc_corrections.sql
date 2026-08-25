-- Correct edge cases in the initial WatermelonDB sync RPCs.

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
  IF NOT (p_table = ANY (ARRAY['business_config', 'services', 'workers', 'clients', 'appointments', 'payments']::TEXT[])) THEN
    RAISE EXCEPTION 'SYNC_INPUT: unsupported table %', p_table USING ERRCODE = '22023';
  END IF;

  IF p_table = 'business_config' THEN
    SELECT id, sync_version
    INTO v_record_business_id, v_record_sync_version
    FROM public.business_config
    WHERE id = p_id;
  ELSE
    EXECUTE format(
      'SELECT business_id, sync_version FROM public.%I WHERE id = $1',
      p_table
    )
    INTO v_record_business_id, v_record_sync_version
    USING p_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SYNC_NOT_FOUND: % record does not exist', p_table USING ERRCODE = 'P0001';
  END IF;

  IF v_record_business_id IS DISTINCT FROM p_business_id THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: record is outside the authenticated business' USING ERRCODE = '42501';
  END IF;

  IF v_record_sync_version > p_last_pulled_at THEN
    RAISE EXCEPTION 'SYNC_CONFLICT: record changed on the server' USING ERRCODE = 'P0001';
  END IF;

  RAISE EXCEPTION 'SYNC_WRITE_FAILED: record could not be applied' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_appointment_slot(
  p_worker_id UUID,
  p_date TEXT,
  p_start_time TEXT,
  p_end_time TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  start_time TEXT,
  end_time TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_business_id UUID;
  v_role TEXT;
  v_current_worker_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authentication is required' USING ERRCODE = '28000';
  END IF;

  IF p_date IS NULL OR p_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'SYNC_INPUT: date must use YYYY-MM-DD' USING ERRCODE = '22023';
  END IF;

  IF p_start_time IS NULL OR p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR p_end_time IS NULL OR p_end_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'SYNC_INPUT: appointment time range is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT business_id, role, worker_id
  INTO v_business_id, v_role, v_current_worker_id
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SYNC_UNAUTHORIZED: authenticated user has no profile' USING ERRCODE = '28000';
  END IF;

  IF v_role = 'worker' AND p_worker_id IS DISTINCT FROM v_current_worker_id THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: workers can only inspect their own agenda' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workers
    WHERE id = p_worker_id
      AND business_id = v_business_id
  ) THEN
    RAISE EXCEPTION 'SYNC_FORBIDDEN: worker is outside the authenticated business' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT appointment.id, appointment.start_time, appointment.end_time, appointment.status
  FROM public.appointments AS appointment
  WHERE appointment.business_id = v_business_id
    AND appointment.worker_id = p_worker_id
    AND appointment.date = p_date
    AND appointment.is_deleted = FALSE
    AND appointment.status <> 'cancelled'
    AND (p_exclude_id IS NULL OR appointment.id <> p_exclude_id)
    AND appointment.start_time < p_end_time
    AND appointment.end_time > p_start_time
  ORDER BY appointment.start_time, appointment.end_time;
END;
$$;
