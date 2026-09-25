import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import type { AdapterConfig, CreateAdapter } from './dbAdapter';

/** Adapter nativo: SQLite vía JSI (iOS/Android). */
export const createAdapter: CreateAdapter = (config: AdapterConfig) =>
  new SQLiteAdapter({
    schema: config.schema,
    migrations: config.migrations,
    dbName: config.dbName,
    jsi: true,
    onSetUpError: config.onSetUpError,
  });
