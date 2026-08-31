-- Worker account provisioning
-- Adds the server-side link between a freshly created auth.users row (created by
-- the invite-worker Edge Function via the Admin API) and its worker record.
--
-- Why an RPC instead of generic sync: sync_push explicitly forbids clients from
-- creating/updating user_profiles (SYNC_FORBIDDEN). The profile <-> worker link
-- must therefore be established by an authenticated server flow. This RPC is
-- SECURITY DEFINER and revalidates that the caller is the owner of the same
-- business before inserting the worker profile. The service-role key never leaves
-- the server: the Edge Function creates the auth user, then calls this RPC using
-- the owner's Bearer token, passing the new worker uid as p_user_id.

CREATE OR REPLACE FUNCTION public.link_worker_profile(
  p_user_id UUID,
  p_worker_id UUID,
  p_email TEXT
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_business UUID;
  linked_profile public.user_profiles;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can link worker profiles'
      USING ERRCODE = '42501';
  END IF;

  v_business := public.get_user_business_id();

  IF v_business IS NULL THEN
    RAISE EXCEPTION 'The authenticated owner has no business'
      USING ERRCODE = '42501';
  END IF;

  -- The worker record must exist, belong to the caller's business, and be active.
  IF NOT EXISTS (
    SELECT 1 FROM public.workers
    WHERE id = p_worker_id
      AND business_id = v_business
      AND is_deleted = FALSE
  ) THEN
    RAISE EXCEPTION 'worker_id must be an existing worker of your business';
  END IF;

  -- Prevent double-linking a worker or reusing an already provisioned auth user.
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE worker_id = p_worker_id) THEN
    RAISE EXCEPTION 'This worker already has a linked account';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'This account is already linked to a business';
  END IF;

  -- The role_worker_consistent CHECK and validate_business_relationships trigger
  -- guarantee integrity (worker belongs to the same business, role/worker_id match).
  INSERT INTO public.user_profiles (id, business_id, role, worker_id, email)
  VALUES (p_user_id, v_business, 'worker', p_worker_id, p_email)
  RETURNING * INTO linked_profile;

  RETURN linked_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.link_worker_profile(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_worker_profile(UUID, UUID, TEXT) TO authenticated;
