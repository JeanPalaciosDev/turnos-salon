-- Initial schema for Turnos Salón
-- All tables use UUID as primary key (generated client-side as UUIDv7)
-- Soft deletes: is_deleted flag, never physically deleted
-- updated_at: used as sync vector by WatermelonDB

-- ============================================================
-- BUSINESS CONFIG (singleton per installation)
-- ============================================================
CREATE TABLE business_config (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'ARS',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- ============================================================
-- USER PROFILES (linked to Supabase Auth)
-- ============================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES business_config(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'worker')),
  worker_id UUID, -- FK set after workers table is created
  email TEXT NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- ============================================================
-- WORKERS
-- ============================================================
CREATE TABLE workers (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES business_config(id),
  name TEXT NOT NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed_per_service')),
  commission_value INTEGER NOT NULL DEFAULT 0,
  commission_currency TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Add FK from user_profiles to workers
ALTER TABLE user_profiles
  ADD CONSTRAINT fk_user_profiles_worker
  FOREIGN KEY (worker_id) REFERENCES workers(id);

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE services (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES business_config(id),
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  default_price_amount INTEGER NOT NULL, -- centavos
  default_price_currency TEXT NOT NULL DEFAULT 'ARS',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES business_config(id),
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES business_config(id),
  date TEXT NOT NULL, -- ISO 8601 date: "2025-03-15"
  start_time TEXT NOT NULL, -- "14:30"
  end_time TEXT NOT NULL, -- "15:00"
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  service_id UUID NOT NULL REFERENCES services(id),
  worker_id UUID NOT NULL REFERENCES workers(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  notes TEXT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indice para queries por worker + date (vista de agenda)
CREATE INDEX idx_appointments_worker_date ON appointments(worker_id, date) WHERE is_deleted = FALSE;

-- Indice para queries por date (vista diaria general)
CREATE INDEX idx_appointments_date ON appointments(date) WHERE is_deleted = FALSE;

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES business_config(id),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  amount INTEGER NOT NULL, -- centavos en la moneda del pago
  currency TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'transfer', 'other')),
  exchange_rate NUMERIC, -- tasa al momento del cobro
  exchange_base_currency TEXT,
  paid_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_payments_appointment ON payments(appointment_id) WHERE is_deleted = FALSE;
