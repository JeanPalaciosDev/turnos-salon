/**
 * WatermelonDB schema definitions.
 * Estos schemas definen las tablas locales que se sincronizan con Postgres.
 *
 * Nota: WatermelonDB maneja su propio `id` internamente.
 * Los campos `_status` y `_changed` son internos de WatermelonDB para sync.
 */

export const TABLES = {
  BUSINESS_CONFIG: 'business_config',
  USER_PROFILES: 'user_profiles',
  SERVICES: 'services',
  WORKERS: 'workers',
  CLIENTS: 'clients',
  APPOINTMENTS: 'appointments',
  APPOINTMENT_SERVICES: 'appointment_services',
  PAYMENTS: 'payments',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

/**
 * Schema version — incrementar con cada migración.
 * v2 (2026-09): modelo de dominio del rediseño (migración 00010) — tabla puente
 * appointment_services, worker_id opcional, campos nuevos.
 */
export const SCHEMA_VERSION = 2;

/**
 * Definición del schema para WatermelonDB.
 * Se usará con `appSchema()` de @nozbe/watermelondb.
 *
 * Estructura declarativa que después se traduce a la API de WatermelonDB
 * cuando se instale la librería en apps/mobile.
 */
export const schemaDefinition = {
  version: SCHEMA_VERSION,
  tables: {
    [TABLES.BUSINESS_CONFIG]: {
      columns: [
        { name: 'name', type: 'string' as const },
        { name: 'base_currency', type: 'string' as const },
        { name: 'timezone', type: 'string' as const },
        { name: 'updated_at', type: 'number' as const },
        { name: 'sync_version', type: 'number' as const },
      ],
    },
    [TABLES.USER_PROFILES]: {
      columns: [
        { name: 'business_id', type: 'string' as const },
        { name: 'role', type: 'string' as const },
        { name: 'worker_id', type: 'string' as const, isOptional: true },
        { name: 'email', type: 'string' as const },
        { name: 'updated_at', type: 'number' as const },
        { name: 'sync_version', type: 'number' as const },
      ],
    },
    [TABLES.SERVICES]: {
      columns: [
        { name: 'business_id', type: 'string' as const },
        { name: 'name', type: 'string' as const },
        { name: 'duration_minutes', type: 'number' as const },
        { name: 'default_price_amount', type: 'number' as const },
        { name: 'default_price_currency', type: 'string' as const },
        { name: 'is_active', type: 'boolean' as const },
        { name: 'reapplication_days', type: 'number' as const, isOptional: true },
        { name: 'updated_at', type: 'number' as const },
        { name: 'sync_version', type: 'number' as const },
        { name: 'is_deleted', type: 'boolean' as const },
      ],
    },
    [TABLES.WORKERS]: {
      columns: [
        { name: 'business_id', type: 'string' as const },
        { name: 'name', type: 'string' as const },
        { name: 'commission_type', type: 'string' as const },
        { name: 'commission_value', type: 'number' as const },
        { name: 'commission_currency', type: 'string' as const, isOptional: true },
        { name: 'phone', type: 'string' as const, isOptional: true },
        { name: 'is_active', type: 'boolean' as const },
        { name: 'updated_at', type: 'number' as const },
        { name: 'sync_version', type: 'number' as const },
        { name: 'is_deleted', type: 'boolean' as const },
      ],
    },
    [TABLES.CLIENTS]: {
      columns: [
        { name: 'business_id', type: 'string' as const },
        { name: 'name', type: 'string' as const },
        { name: 'phone', type: 'string' as const, isOptional: true },
        { name: 'notes', type: 'string' as const, isOptional: true },
        { name: 'last_visit', type: 'string' as const, isOptional: true },
        { name: 'updated_at', type: 'number' as const },
        { name: 'sync_version', type: 'number' as const },
        { name: 'is_deleted', type: 'boolean' as const },
      ],
    },
    [TABLES.APPOINTMENTS]: {
      columns: [
        { name: 'business_id', type: 'string' as const },
        { name: 'date', type: 'string' as const },
        { name: 'start_time', type: 'string' as const },
        { name: 'end_time', type: 'string' as const },
        { name: 'status', type: 'string' as const },
        // service_id opcional: la fuente de verdad de servicios pasa a la tabla
        // puente appointment_services (varios servicios por turno).
        { name: 'service_id', type: 'string' as const, isOptional: true },
        // worker_id opcional: turnos "Sin asignar".
        { name: 'worker_id', type: 'string' as const, isOptional: true },
        { name: 'client_id', type: 'string' as const },
        { name: 'notes', type: 'string' as const, isOptional: true },
        { name: 'updated_at', type: 'number' as const },
        { name: 'sync_version', type: 'number' as const },
        { name: 'is_deleted', type: 'boolean' as const },
      ],
    },
    [TABLES.APPOINTMENT_SERVICES]: {
      columns: [
        { name: 'business_id', type: 'string' as const },
        { name: 'appointment_id', type: 'string' as const },
        { name: 'service_id', type: 'string' as const },
        { name: 'duration_minutes', type: 'number' as const, isOptional: true },
        { name: 'price_amount', type: 'number' as const, isOptional: true },
        { name: 'price_currency', type: 'string' as const, isOptional: true },
        { name: 'updated_at', type: 'number' as const },
        { name: 'sync_version', type: 'number' as const },
        { name: 'is_deleted', type: 'boolean' as const },
      ],
    },
    [TABLES.PAYMENTS]: {
      columns: [
        { name: 'business_id', type: 'string' as const },
        { name: 'appointment_id', type: 'string' as const },
        { name: 'amount', type: 'number' as const },
        { name: 'currency', type: 'string' as const },
        { name: 'method', type: 'string' as const },
        { name: 'exchange_rate', type: 'number' as const, isOptional: true },
        { name: 'exchange_base_currency', type: 'string' as const, isOptional: true },
        { name: 'paid_at', type: 'number' as const },
        { name: 'updated_at', type: 'number' as const },
        { name: 'sync_version', type: 'number' as const },
        { name: 'is_deleted', type: 'boolean' as const },
      ],
    },
  },
} as const;
