/**
 * Migraciones de WatermelonDB.
 *
 * Cada vez que se modifica el schema, se agrega una migración aquí
 * para que los dispositivos que ya tienen datos puedan actualizar su DB local.
 *
 * La versión 1 es el schema inicial — no necesita migración.
 * Las migraciones se agregan a partir de la versión 2+.
 */

export type Migration = {
  toVersion: number;
  steps: MigrationStep[];
};

export type MigrationStep =
  | { type: 'create_table'; name: string }
  | { type: 'add_columns'; table: string; columns: { name: string; type: string; isOptional?: boolean }[] }
  | { type: 'destroy_table'; name: string };

/**
 * Lista de migraciones ordenadas por versión.
 * Se usará con `schemaMigrations()` de @nozbe/watermelondb/Schema/migrations.
 */
export const migrations: Migration[] = [
  // La versión 1 es el schema base, no requiere migración.
  {
    // v2 (2026-09): modelo de dominio del rediseño (SQL: migración 00010).
    // Tabla puente de servicios múltiples + campos nuevos. worker_id/service_id
    // pasan a opcionales, pero WatermelonDB no distingue optional en columnas ya
    // existentes (es solo validación de escritura), así que no requieren step.
    toVersion: 2,
    steps: [
      { type: 'create_table', name: 'appointment_services' },
      {
        type: 'add_columns',
        table: 'services',
        columns: [{ name: 'reapplication_days', type: 'number', isOptional: true }],
      },
      {
        type: 'add_columns',
        table: 'workers',
        columns: [{ name: 'phone', type: 'string', isOptional: true }],
      },
      {
        type: 'add_columns',
        table: 'clients',
        columns: [{ name: 'last_visit', type: 'string', isOptional: true }],
      },
    ],
  },
];
