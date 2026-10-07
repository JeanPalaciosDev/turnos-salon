-- Worker invite codes: 6-digit code with 1-minute TTL for presential worker linking.
-- Replaces the email-based invite-worker Edge Function flow (00009) with a simpler
-- code-based approach that requires no service-role key.

-- pgcrypto provides gen_random_bytes() used for cryptographic code generation.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================================================
-- Table: worker_invite_codes
-- ========================================================================
CREATE TABLE public.worker_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id),
  business_id UUID NOT NULL REFERENCES public.business_config(id),
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_worker_invite_codes_active
  ON public.worker_invite_codes(worker_id)
  WHERE is_used = FALSE;

-- No direct RLS policies: accessed exclusively via SECURITY DEFINER RPCs.
ALTER TABLE public.worker_invite_codes ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- RPC: generate_worker_invite_code(p_worker_id UUID)
-- Called by the owner to generate a 6-digit code for a specific worker.
-- Returns the code in cleartext + expiration. Invalidates previous active codes.
-- ========================================================================
CREATE OR REPLACE FUNCTION public.generate_worker_invite_code(p_worker_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_business UUID;
  v_raw_bytes BYTEA;
  v_code_int INTEGER;
  v_code TEXT;
  v_hash TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  -- Owner-only
  IF auth.uid() IS NULL OR public.get_user_role() <> 'owner' THEN
    RAISE EXCEPTION 'Solo owners pueden generar codigos de invitacion'
      USING ERRCODE = '42501';
  END IF;

  v_business := public.get_user_business_id();
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'El owner no tiene negocio asociado'
      USING ERRCODE = '42501';
  END IF;

  -- Worker must exist, belong to business, not deleted
  IF NOT EXISTS (
    SELECT 1 FROM public.workers
    WHERE id = p_worker_id
      AND business_id = v_business
      AND is_deleted = FALSE
  ) THEN
    RAISE EXCEPTION 'El trabajador no existe o no pertenece a tu negocio';
  END IF;

  -- Worker must not already be linked
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE worker_id = p_worker_id) THEN
    RAISE EXCEPTION 'Este trabajador ya tiene una cuenta vinculada';
  END IF;

  -- Invalidate previous active codes for this worker
  UPDATE public.worker_invite_codes
  SET is_used = TRUE
  WHERE worker_id = p_worker_id AND is_used = FALSE;

  -- Generate 6-digit code from cryptographic random bytes
  v_raw_bytes := gen_random_bytes(4);
  v_code_int := abs(('x' || encode(v_raw_bytes, 'hex'))::bit(32)::integer);
  v_code := lpad((v_code_int % 1000000)::text, 6, '0');
  v_hash := encode(sha256(v_code::bytea), 'hex');
  v_expires := now() + interval '1 minute';

  INSERT INTO public.worker_invite_codes (worker_id, business_id, code_hash, expires_at)
  VALUES (p_worker_id, v_business, v_hash, v_expires);

  RETURN json_build_object(
    'code', v_code,
    'expires_at', v_expires,
    'worker_id', p_worker_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_worker_invite_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_worker_invite_code(UUID) TO authenticated;

-- ========================================================================
-- RPC: redeem_worker_invite_code(p_code TEXT)
-- Called by a newly registered user (no profile yet) to link themselves as a
-- worker to a business. SECURITY DEFINER to INSERT into user_profiles.
-- ========================================================================
CREATE OR REPLACE FUNCTION public.redeem_worker_invite_code(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_hash TEXT;
  v_invite RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Se requiere autenticacion'
      USING ERRCODE = '42501';
  END IF;

  -- Caller must NOT already have a profile
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_uid) THEN
    RAISE EXCEPTION 'Esta cuenta ya esta vinculada a un negocio';
  END IF;

  v_hash := encode(sha256(p_code::bytea), 'hex');

  -- Find matching, non-expired, non-used code with attempts < 5
  SELECT wic.id, wic.worker_id, wic.business_id, wic.attempts
  INTO v_invite
  FROM public.worker_invite_codes wic
  WHERE wic.code_hash = v_hash
    AND wic.is_used = FALSE
    AND wic.expires_at > now()
    AND wic.attempts < 5;

  IF v_invite IS NULL THEN
    -- Increment attempts on all active codes (anti-enumeration)
    UPDATE public.worker_invite_codes
    SET attempts = attempts + 1
    WHERE is_used = FALSE AND expires_at > now();

    RAISE EXCEPTION 'Codigo invalido o expirado';
  END IF;

  -- Get email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- Mark code as used
  UPDATE public.worker_invite_codes SET is_used = TRUE WHERE id = v_invite.id;

  -- Create worker profile
  INSERT INTO public.user_profiles (id, business_id, role, worker_id, email)
  VALUES (v_uid, v_invite.business_id, 'worker', v_invite.worker_id, COALESCE(v_email, ''));

  RETURN json_build_object(
    'status', 'linked',
    'business_id', v_invite.business_id,
    'worker_id', v_invite.worker_id
  );
END;

$function$;

REVOKE ALL ON FUNCTION public.redeem_worker_invite_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_worker_invite_code(TEXT) TO authenticated;
