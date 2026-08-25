-- RLS policies are evaluated only after the authenticated role has table access.
-- Keep the grant read-only; row visibility remains constrained by 00007_worker_privacy.sql.

GRANT SELECT ON TABLE public.user_profiles, public.workers TO authenticated;
