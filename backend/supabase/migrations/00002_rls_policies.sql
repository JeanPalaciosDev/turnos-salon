-- Row Level Security policies
-- Owner: acceso total a registros de su business_id
-- Worker: solo ve appointments donde worker_id = su worker_id en user_profiles

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: get current user's business_id
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- Helper function: get current user's role
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- Helper function: get current user's worker_id
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_worker_id()
RETURNS UUID AS $$
  SELECT worker_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- BUSINESS CONFIG: only users of that business
-- ============================================================
CREATE POLICY "Users can view own business config"
  ON business_config FOR SELECT
  USING (id = get_user_business_id());

CREATE POLICY "Owner can update business config"
  ON business_config FOR UPDATE
  USING (id = get_user_business_id() AND get_user_role() = 'owner');

-- ============================================================
-- USER PROFILES: users in same business
-- ============================================================
CREATE POLICY "Users can view profiles in own business"
  ON user_profiles FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "Owner can manage profiles"
  ON user_profiles FOR ALL
  USING (business_id = get_user_business_id() AND get_user_role() = 'owner');

-- ============================================================
-- WORKERS: owner full access, worker can view all in business
-- ============================================================
CREATE POLICY "Users can view workers in own business"
  ON workers FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "Owner can manage workers"
  ON workers FOR ALL
  USING (business_id = get_user_business_id() AND get_user_role() = 'owner');

-- ============================================================
-- SERVICES: everyone in business can view, owner manages
-- ============================================================
CREATE POLICY "Users can view services in own business"
  ON services FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "Owner can manage services"
  ON services FOR ALL
  USING (business_id = get_user_business_id() AND get_user_role() = 'owner');

-- ============================================================
-- CLIENTS: owner full access, worker no access
-- ============================================================
CREATE POLICY "Owner can manage clients"
  ON clients FOR ALL
  USING (business_id = get_user_business_id() AND get_user_role() = 'owner');

-- ============================================================
-- APPOINTMENTS: owner all, worker only own
-- ============================================================
CREATE POLICY "Owner can manage all appointments"
  ON appointments FOR ALL
  USING (business_id = get_user_business_id() AND get_user_role() = 'owner');

CREATE POLICY "Worker can view own appointments"
  ON appointments FOR SELECT
  USING (
    business_id = get_user_business_id()
    AND get_user_role() = 'worker'
    AND worker_id = get_user_worker_id()
  );

CREATE POLICY "Worker can update own appointments"
  ON appointments FOR UPDATE
  USING (
    business_id = get_user_business_id()
    AND get_user_role() = 'worker'
    AND worker_id = get_user_worker_id()
  )
  WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() = 'worker'
    AND worker_id = get_user_worker_id()
  );

-- ============================================================
-- PAYMENTS: owner only
-- ============================================================
CREATE POLICY "Owner can manage payments"
  ON payments FOR ALL
  USING (business_id = get_user_business_id() AND get_user_role() = 'owner');
