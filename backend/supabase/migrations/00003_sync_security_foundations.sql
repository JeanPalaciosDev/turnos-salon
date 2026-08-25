-- Sync and security foundations
-- This migration prepares the database for offline synchronization before the
-- WatermelonDB endpoint is implemented. It does not expose a generic sync API.

-- ============================================================
-- Server-issued, monotonically increasing sync versions
-- ============================================================
CREATE SEQUENCE public.sync_version_sequence AS BIGINT;

ALTER TABLE public.business_config
  ADD COLUMN sync_version BIGINT NOT NULL DEFAULT nextval('public.sync_version_sequence');
ALTER TABLE public.user_profiles
  ADD COLUMN sync_version BIGINT NOT NULL DEFAULT nextval('public.sync_version_sequence');
ALTER TABLE public.services
  ADD COLUMN sync_version BIGINT NOT NULL DEFAULT nextval('public.sync_version_sequence');
ALTER TABLE public.workers
  ADD COLUMN sync_version BIGINT NOT NULL DEFAULT nextval('public.sync_version_sequence');
ALTER TABLE public.clients
  ADD COLUMN sync_version BIGINT NOT NULL DEFAULT nextval('public.sync_version_sequence');
ALTER TABLE public.appointments
  ADD COLUMN sync_version BIGINT NOT NULL DEFAULT nextval('public.sync_version_sequence');
ALTER TABLE public.payments
  ADD COLUMN sync_version BIGINT NOT NULL DEFAULT nextval('public.sync_version_sequence');

CREATE OR REPLACE FUNCTION public.set_sync_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  NEW.sync_version := nextval('public.sync_version_sequence');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_business_config_sync_metadata
  BEFORE UPDATE ON public.business_config
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_user_profiles_sync_metadata
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_services_sync_metadata
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_workers_sync_metadata
  BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_clients_sync_metadata
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_appointments_sync_metadata
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();
CREATE TRIGGER set_payments_sync_metadata
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();

-- ============================================================
-- Domain constraints enforced independently from mobile clients
-- ============================================================
ALTER TABLE public.services
  ADD CONSTRAINT services_duration_positive CHECK (duration_minutes > 0),
  ADD CONSTRAINT services_price_positive CHECK (default_price_amount > 0);

ALTER TABLE public.workers
  ADD CONSTRAINT workers_commission_value_nonnegative CHECK (commission_value >= 0),
  ADD CONSTRAINT workers_percentage_in_range CHECK (
    commission_type <> 'percentage' OR commission_value <= 100
  ),
  ADD CONSTRAINT workers_commission_currency_consistent CHECK (
    (commission_type = 'percentage' AND commission_currency IS NULL)
    OR (commission_type = 'fixed_per_service' AND commission_currency IS NOT NULL)
  );

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_date_format CHECK (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  ADD CONSTRAINT appointments_start_time_format CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT appointments_end_time_format CHECK (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT appointments_time_order CHECK (start_time < end_time);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT payments_exchange_data_consistent CHECK (
    (exchange_rate IS NULL AND exchange_base_currency IS NULL)
    OR (exchange_rate > 0 AND exchange_base_currency IS NOT NULL)
  );

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_worker_consistent CHECK (
    (role = 'owner' AND worker_id IS NULL)
    OR (role = 'worker' AND worker_id IS NOT NULL)
  );

-- ============================================================
-- Prevent cross-business foreign-key references
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_business_relationships()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'user_profiles' AND NEW.worker_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workers
      WHERE id = NEW.worker_id AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'worker_id must belong to the profile business';
    END IF;
  ELSIF TG_TABLE_NAME = 'appointments' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.services
      WHERE id = NEW.service_id AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'service_id must belong to the appointment business';
    END IF;
    IF NOT EXISTS (
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
$$;

CREATE TRIGGER validate_user_profile_business_relationship
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_relationships();
CREATE TRIGGER validate_appointment_business_relationships
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_relationships();
CREATE TRIGGER validate_payment_business_relationship
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_relationships();

-- ============================================================
-- Secure RLS helper functions and owner onboarding
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
  SELECT business_id FROM public.user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_worker_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
  SELECT worker_id FROM public.user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_owner_business(
  p_business_id UUID,
  p_name TEXT,
  p_base_currency TEXT DEFAULT 'ARS',
  p_timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires'
)
RETURNS public.business_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  created_business public.business_config;
  current_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'The authenticated user already belongs to a business';
  END IF;

  SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();
  IF current_email IS NULL THEN
    RAISE EXCEPTION 'The authenticated user has no email';
  END IF;

  INSERT INTO public.business_config (id, name, base_currency, timezone)
  VALUES (p_business_id, trim(p_name), p_base_currency, p_timezone)
  RETURNING * INTO created_business;

  INSERT INTO public.user_profiles (id, business_id, role, worker_id, email)
  VALUES (auth.uid(), p_business_id, 'owner', NULL, current_email);

  RETURN created_business;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_owner_business(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_owner_business(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Workers must not perform arbitrary appointment edits. Completion is the only
-- permitted worker-originated state transition and is exposed through this RPC.
DROP POLICY IF EXISTS "Worker can update own appointments" ON public.appointments;

CREATE OR REPLACE FUNCTION public.complete_own_appointment(p_appointment_id UUID)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  completed_appointment public.appointments;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() <> 'worker' THEN
    RAISE EXCEPTION 'Only workers can complete their own appointments';
  END IF;

  UPDATE public.appointments
  SET status = 'completed'
  WHERE id = p_appointment_id
    AND business_id = public.get_user_business_id()
    AND worker_id = public.get_user_worker_id()
    AND status = 'scheduled'
    AND is_deleted = FALSE
  RETURNING * INTO completed_appointment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment cannot be completed';
  END IF;

  RETURN completed_appointment;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_own_appointment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_own_appointment(UUID) TO authenticated;
