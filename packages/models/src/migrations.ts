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
  // Ejemplo para versión futura:
  // {
  //   toVersion: 2,
  //   steps: [
  //     { type: 'add_columns', table: 'appointments', columns: [{ name: 'recurring_id', type: 'string', isOptional: true }] }
  //   ],
  // },
];
