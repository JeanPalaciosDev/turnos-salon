import {
  HttpError,
  corsHeaders,
  createAuthenticatedClient,
  databaseErrorResponse,
  jsonResponse,
} from '../_shared/supabase.ts';

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
type RawRecord = Record<string, unknown>;
type CollectionChanges = {
  created: RawRecord[];
  updated: RawRecord[];
  deleted: string[];
};
type SyncChanges = Partial<Record<TableName, CollectionChanges>>;

type PullRequest = {
  operation: 'pull';
  lastPulledAt: number | null;
  schemaVersion: number;
  migration: unknown;
};

type PushRequest = {
  operation: 'push';
  lastPulledAt: number | null;
  changes: SyncChanges;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCursor(value: unknown, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(`${field} must be a non-negative integer or null.`, 400, 'INVALID_INPUT');
  }

  return value;
}

function parseChanges(value: unknown): SyncChanges {
  if (!isObject(value)) {
    throw new HttpError('changes must be an object.', 400, 'INVALID_INPUT');
  }

  for (const [table, collection] of Object.entries(value)) {
    if (!TABLE_NAMES.includes(table as TableName) || !isObject(collection)) {
      throw new HttpError('changes contains an invalid collection.', 400, 'INVALID_INPUT');
    }

    for (const bucket of ['created', 'updated', 'deleted'] as const) {
      if (!Array.isArray(collection[bucket])) {
        throw new HttpError('Each changes bucket must be an array.', 400, 'INVALID_INPUT');
      }
    }
  }

  return value as SyncChanges;
}

function parseRequest(body: unknown): PullRequest | PushRequest {
  if (!isObject(body) || typeof body.operation !== 'string') {
    throw new HttpError('A sync operation is required.', 400, 'INVALID_INPUT');
  }

  const lastPulledAt = parseCursor(body.lastPulledAt, 'lastPulledAt');

  if (body.operation === 'pull') {
    if (!Number.isInteger(body.schemaVersion) || body.schemaVersion < 1) {
      throw new HttpError('schemaVersion must be a positive integer.', 400, 'INVALID_INPUT');
    }

    return {
      operation: 'pull',
      lastPulledAt,
      schemaVersion: body.schemaVersion,
      migration: body.migration ?? null,
    };
  }

  if (body.operation === 'push') {
    return {
      operation: 'push',
      lastPulledAt,
      changes: parseChanges(body.changes),
    };
  }

  throw new HttpError('Unsupported sync operation.', 400, 'INVALID_INPUT');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const payload = parseRequest(await request.json());
    const { supabase } = await createAuthenticatedClient(request);

    if (payload.operation === 'pull') {
      const { data, error } = await supabase.rpc('sync_pull', {
        p_last_pulled_at: payload.lastPulledAt,
        p_schema_version: payload.schemaVersion,
        p_migration: payload.migration,
      });

      if (error) {
        return databaseErrorResponse(error);
      }

      return jsonResponse(data);
    }

    const { error } = await supabase.rpc('sync_push', {
      p_changes: payload.changes,
      p_last_pulled_at: payload.lastPulledAt,
    });

    if (error) {
      return databaseErrorResponse(error);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message, code: error.code }, error.status);
    }

    if (error instanceof SyntaxError) {
      return jsonResponse({ error: 'Request body must be valid JSON.', code: 'INVALID_JSON' }, 400);
    }

    console.error('Unexpected sync failure.', error);
    return jsonResponse({ error: 'Internal server error.', code: 'INTERNAL_ERROR' }, 500);
  }
});
