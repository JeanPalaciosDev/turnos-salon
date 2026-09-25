import type { DatabaseAdapter } from '@nozbe/watermelondb';
import type { AppSchema } from '@nozbe/watermelondb';
import type { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Fábrica del adapter de WatermelonDB, resuelta por plataforma:
 * - dbAdapter.native.ts → SQLiteAdapter (JSI) para iOS/Android.
 * - dbAdapter.web.ts     → LokiJSAdapter (IndexedDB) para el navegador.
 * Ambos reciben el mismo schema + migraciones y devuelven un DatabaseAdapter.
 */
export interface AdapterConfig {
  schema: AppSchema;
  migrations: SchemaMigrations;
  dbName: string;
  onSetUpError: (error: Error) => void;
}

export type CreateAdapter = (config: AdapterConfig) => DatabaseAdapter;

/**
 * Declaración de valor para TypeScript: Metro resuelve la implementación real
 * (`dbAdapter.native.ts` / `dbAdapter.web.ts`) por plataforma en runtime. Este
 * `declare` solo le da a tsc el tipo del símbolo; nunca se ejecuta.
 */
export declare const createAdapter: CreateAdapter;

