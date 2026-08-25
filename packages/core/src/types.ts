// Montos siempre en enteros (centavos/unidad mínima) para evitar redondeo flotante
export type MoneyAmount = {
  amount: number; // entero, ej: 1500 = $15.00
  currency: string; // ISO 4217: "ARS", "USD"
};

export type BusinessConfig = {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
  updated_at: number;
  /** Versión monotónica asignada por el servidor para sincronización. */
  sync_version: number;
};

export type UserRole = 'owner' | 'worker';

export type UserProfile = {
  id: string; // = Supabase auth.uid
  business_id: string;
  role: UserRole;
  worker_id?: string; // FK a Worker si role='worker'
  email: string;
  updated_at: number;
  /** Versión monotónica asignada por el servidor para sincronización. */
  sync_version: number;
};

export type Service = {
  id: string;
  business_id: string;
  name: string;
  duration_minutes: number;
  default_price: MoneyAmount;
  is_active: boolean;
  updated_at: number;
  /** Versión monotónica asignada por el servidor para sincronización. */
  sync_version: number;
  is_deleted: boolean;
};

export type Worker = {
  id: string;
  business_id: string;
  name: string;
  commission_type: 'percentage' | 'fixed_per_service';
  commission_value: number; // porcentaje (ej: 40) o monto fijo en centavos
  commission_currency?: string; // solo si fixed_per_service
  is_active: boolean;
  updated_at: number;
  /** Versión monotónica asignada por el servidor para sincronización. */
  sync_version: number;
  is_deleted: boolean;
};

export type Client = {
  id: string;
  business_id: string;
  name: string;
  phone?: string;
  notes?: string;
  updated_at: number;
  /** Versión monotónica asignada por el servidor para sincronización. */
  sync_version: number;
  is_deleted: boolean;
};

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export type Appointment = {
  id: string;
  business_id: string;
  date: string; // ISO 8601 date "2025-03-15"
  start_time: string; // "14:30"
  end_time: string; // "15:00"
  status: AppointmentStatus;
  service_id: string;
  worker_id: string;
  client_id: string;
  notes?: string;
  updated_at: number;
  /** Versión monotónica asignada por el servidor para sincronización. */
  sync_version: number;
  is_deleted: boolean;
};

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

// Un appointment puede tener múltiples pagos (ej: parte en efectivo, parte en transferencia)
export type Payment = {
  id: string;
  business_id: string;
  appointment_id: string;
  amount: MoneyAmount;
  method: PaymentMethod;
  exchange_rate?: number; // ej: 1 USD = 1200 ARS → 1200
  exchange_base_currency?: string;
  paid_at: number; // timestamp
  updated_at: number;
  /** Versión monotónica asignada por el servidor para sincronización. */
  sync_version: number;
  is_deleted: boolean;
};
