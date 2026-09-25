import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import type { AdapterConfig, CreateAdapter } from './dbAdapter';

/**
 * Adapter web: LokiJS con persistencia en IndexedDB. Es el backend oficial de
 * WatermelonDB para navegador — corre la MISMA lógica de modelos, queries y
 * sync que el nativo, sin SQLite. useWebWorker=false para simplificar el setup
 * de Metro (sin worker separado); útil en desarrollo/evaluación.
 */
export const createAdapter: CreateAdapter = (config: AdapterConfig) =>
  new LokiJSAdapter({
    schema: config.schema,
    migrations: config.migrations,
    dbName: config.dbName,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    onSetUpError: config.onSetUpError,
  });
