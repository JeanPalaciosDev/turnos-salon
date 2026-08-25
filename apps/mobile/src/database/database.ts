import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import { migrations } from '@turnos/models';
import * as SecureStore from 'expo-secure-store';

import { modelClasses } from './models';
import { databaseSchema } from './schema';

const LOCAL_DATABASE_OWNER_KEY = 'turnos-salon.local-database-owner';

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

/**
 * Aísla la base local por cuenta. Si otra cuenta usa el dispositivo, los datos
 * de la anterior se borran antes del pull inicial para no exponer información
 * entre negocios.
 */
export async function prepareLocalDatabaseForUser(userId: string): Promise<void> {
  const currentOwner = await SecureStore.getItemAsync(LOCAL_DATABASE_OWNER_KEY);

  if (currentOwner && currentOwner !== userId) {
    await database.unsafeResetDatabase();
  }

  await SecureStore.setItemAsync(LOCAL_DATABASE_OWNER_KEY, userId);
}

/**
 * Debe invocarse solo después de que la UI confirme el cierre de sesión: el
 * reset elimina los cambios locales que aún no se hayan sincronizado.
 */
export async function clearLocalDatabaseForSignOut(): Promise<void> {
  await database.unsafeResetDatabase();
  await SecureStore.deleteItemAsync(LOCAL_DATABASE_OWNER_KEY);
}
