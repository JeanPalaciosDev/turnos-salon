import { Database } from '@nozbe/watermelondb';
import { tableSchema } from '@nozbe/watermelondb';
import {
  addColumns,
  createTable,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';
import type { UserProfile } from '@turnos/core';
import { migrations, schemaDefinition } from '@turnos/models';

import { createAdapter } from './dbAdapter';
import { secureStore } from '../lib/secureStore';
import { modelClasses } from './models';
import { databaseSchema } from './schema';

const LOCAL_DATABASE_OWNER_KEY = 'turnos-salon.local-database-owner';
const LOCAL_DATABASE_SCOPE_KEY = 'turnos-salon.local-database-scope';
const WORKER_PRIVACY_SCOPE_VERSION = 'worker-privacy-v1';

type LocalDatabaseScope = Pick<UserProfile, 'id' | 'business_id' | 'role' | 'worker_id'>;

type SchemaColumnType = 'string' | 'number' | 'boolean';

/**
 * Traduce la lista declarativa de migraciones de @turnos/models (que es dominio
 * puro, sin dependencia de WatermelonDB) a los helpers reales de la librería.
 * `create_table` toma las columnas del schema declarativo por su nombre.
 */
const databaseMigrations = schemaMigrations({
  migrations: migrations.map((migration) => ({
    toVersion: migration.toVersion,
    steps: migration.steps.map((step) => {
      if (step.type === 'add_columns') {
        return addColumns({
          table: step.table,
          columns: step.columns.map((c) => ({
            name: c.name,
            type: c.type as SchemaColumnType,
            ...(c.isOptional === undefined ? {} : { isOptional: c.isOptional }),
          })),
        });
      }
      if (step.type === 'create_table') {
        const definition = schemaDefinition.tables[
          step.name as keyof typeof schemaDefinition.tables
        ];
        return createTable({
          name: step.name,
          columns: definition.columns.map((c) => ({
            name: c.name,
            type: c.type as SchemaColumnType,
            ...((c as { isOptional?: boolean }).isOptional === undefined
              ? {}
              : { isOptional: (c as { isOptional?: boolean }).isOptional }),
          })),
        });
      }
      // destroy_table u otros no se usan todavía.
      throw new Error(`Migration step no soportado: ${step.type}`);
    }),
  })),
});

const adapter = createAdapter({
  schema: databaseSchema,
  migrations: databaseMigrations,
  dbName: 'turnos-salon',
  onSetUpError: (error: Error) => {
    console.error('No se pudo inicializar la base local de Turnos Salón.', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses,
});

function serializeDatabaseScope(profile: LocalDatabaseScope): string {
  return JSON.stringify({
    version: WORKER_PRIVACY_SCOPE_VERSION,
    userId: profile.id,
    businessId: profile.business_id,
    role: profile.role,
    workerId: profile.worker_id ?? null,
  });
}

/**
 * Aísla la base local por cuenta y por ámbito de datos. La primera ejecución
 * de una cuenta worker después de la política de privacidad borra el caché
 * anterior antes del pull, para eliminar perfiles o workers ya descargados.
 */
export async function prepareLocalDatabaseForUser(profile: LocalDatabaseScope): Promise<void> {
  const nextScope = serializeDatabaseScope(profile);
  const [currentOwner, currentScope] = await Promise.all([
    secureStore.getItem(LOCAL_DATABASE_OWNER_KEY),
    secureStore.getItem(LOCAL_DATABASE_SCOPE_KEY),
  ]);
  const accountChanged = Boolean(currentOwner && currentOwner !== profile.id);
  const scopeChanged = Boolean(currentScope && currentScope !== nextScope);
  const legacyWorkerCache = profile.role === 'worker' && !currentScope;

  if (accountChanged || scopeChanged || legacyWorkerCache) {
    await database.unsafeResetDatabase();
  }

  await Promise.all([
    secureStore.setItem(LOCAL_DATABASE_OWNER_KEY, profile.id),
    secureStore.setItem(LOCAL_DATABASE_SCOPE_KEY, nextScope),
  ]);
}

/**
 * Debe invocarse solo después de que la UI confirme el cierre de sesión: el
 * reset elimina los cambios locales que aún no se hayan sincronizado.
 */
export async function clearLocalDatabaseForSignOut(): Promise<void> {
  await database.unsafeResetDatabase();
  await Promise.all([
    secureStore.removeItem(LOCAL_DATABASE_OWNER_KEY),
    secureStore.removeItem(LOCAL_DATABASE_SCOPE_KEY),
  ]);
}
