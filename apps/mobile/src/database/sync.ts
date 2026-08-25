import { synchronize } from '@nozbe/watermelondb/sync';

import { database } from './database';

const TABLE_NAMES = [
  'business_config',
  'user_profiles',
  'services',
  'workers',
  'clients',
  'appointments',
  'payments',
] as const;

type TableName = (typeof TABLE_NAMES)[number];
type RawRecord = Record<string, string | number | boolean | null>;
type CollectionChanges = {
  created: RawRecord[];
  updated: RawRecord[];
  deleted: string[];
};
type SyncChanges = Partial<Record<TableName, CollectionChanges>>;

type SyncResponse = {
  changes: SyncChanges;
  timestamp: number;
};

export type SyncConfiguration = {
  endpoint: string;
  accessToken: string;
};

let currentSync: Promise<void> | null = null;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseChanges(value: unknown): SyncChanges {
  if (!isObject(value)) {
    throw new Error('El servidor devolvió un objeto de cambios inválido.');
  }

  for (const [table, collection] of Object.entries(value)) {
    if (!TABLE_NAMES.includes(table as TableName) || !isObject(collection)) {
      throw new Error('El servidor devolvió una colección de sincronización inválida.');
    }

    for (const bucket of ['created', 'updated', 'deleted'] as const) {
      if (!Array.isArray(collection[bucket])) {
        throw new Error('El servidor devolvió cambios de sincronización inválidos.');
      }
    }
  }

  return value as SyncChanges;
}

async function postJson<T>(
  configuration: SyncConfiguration,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(configuration.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${configuration.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `La sincronización falló (${response.status}).`);
  }

  return (await response.json()) as T;
}

/**
 * Sincroniza la base local con la Edge Function `sync` autenticada.
 * La función comparte una única ejecución en curso para no iniciar dos syncs
 * concurrentes sobre WatermelonDB.
 */
export function synchronizeWithServer(configuration: SyncConfiguration): Promise<void> {
  if (currentSync) {
    return currentSync;
  }

  currentSync = synchronize({
    database,
    migrationsEnabledAtVersion: 1,
    // El servidor devuelve filas incrementales existentes como `updated`, aun
    // cuando sean nuevas para este dispositivo. La opción solo adapta cómo se
    // aplican pulls remotos; las altas locales siguen saliendo en `created`.
    sendCreatedAsUpdated: true,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      const response = await postJson<SyncResponse>(configuration, {
        operation: 'pull',
        lastPulledAt,
        schemaVersion,
        migration: migration ?? null,
      });

      if (!Number.isSafeInteger(response.timestamp)) {
        throw new Error('El servidor devolvió un cursor de sincronización inválido.');
      }

      return {
        changes: parseChanges(response.changes),
        timestamp: response.timestamp,
      };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      await postJson<Record<string, unknown>>(configuration, {
        operation: 'push',
        lastPulledAt,
        changes,
      });
    },
  }).finally(() => {
    currentSync = null;
  });

  return currentSync;
}
