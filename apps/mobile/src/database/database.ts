import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import type { UserProfile } from '@turnos/core';
import { migrations } from '@turnos/models';
import * as SecureStore from 'expo-secure-store';

import { modelClasses } from './models';
import { databaseSchema } from './schema';

const LOCAL_DATABASE_OWNER_KEY = 'turnos-salon.local-database-owner';
const LOCAL_DATABASE_SCOPE_KEY = 'turnos-salon.local-database-scope';
const WORKER_PRIVACY_SCOPE_VERSION = 'worker-privacy-v1';

type LocalDatabaseScope = Pick<UserProfile, 'id' | 'business_id' | 'role' | 'worker_id'>;

const databaseMigrations = schemaMigrations({
  // @turnos/models owns the declarative migration list. Its currently empty
  // initial migration is valid for schema version 1.
  migrations: migrations as never[],
});

const adapter = new SQLiteAdapter({
  schema: databaseSchema,
  migrations: databaseMigrations,
  dbName: 'turnos-salon',
  jsi: true,
  onSetUpError: (error) => {
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
    SecureStore.getItemAsync(LOCAL_DATABASE_OWNER_KEY),
    SecureStore.getItemAsync(LOCAL_DATABASE_SCOPE_KEY),
  ]);
  const accountChanged = Boolean(currentOwner && currentOwner !== profile.id);
  const scopeChanged = Boolean(currentScope && currentScope !== nextScope);
  const legacyWorkerCache = profile.role === 'worker' && !currentScope;

  if (accountChanged || scopeChanged || legacyWorkerCache) {
    await database.unsafeResetDatabase();
  }

  await Promise.all([
    SecureStore.setItemAsync(LOCAL_DATABASE_OWNER_KEY, profile.id),
    SecureStore.setItemAsync(LOCAL_DATABASE_SCOPE_KEY, nextScope),
  ]);
}

/**
 * Debe invocarse solo después de que la UI confirme el cierre de sesión: el
 * reset elimina los cambios locales que aún no se hayan sincronizado.
 */
export async function clearLocalDatabaseForSignOut(): Promise<void> {
  await database.unsafeResetDatabase();
  await Promise.all([
    SecureStore.deleteItemAsync(LOCAL_DATABASE_OWNER_KEY),
    SecureStore.deleteItemAsync(LOCAL_DATABASE_SCOPE_KEY),
  ]);
}
