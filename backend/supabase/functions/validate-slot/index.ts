import {
  HttpError,
  corsHeaders,
  createAuthenticatedClient,
  databaseErrorResponse,
  jsonResponse,
} from '../_shared/supabase.ts';

type SlotRequest = {
  worker_id: string;
  date: string;
  start_time: string;
  end_time: string;
  exclude_id: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSlotRequest(value: unknown): SlotRequest {
  if (!isObject(value)) {
    throw new HttpError('Request body must be an object.', 400, 'INVALID_INPUT');
  }

  const required = ['worker_id', 'date', 'start_time', 'end_time'] as const;
  for (const field of required) {
    if (typeof value[field] !== 'string' || value[field].trim().length === 0) {
      throw new HttpError(`${field} is required.`, 400, 'INVALID_INPUT');
    }
  }

  if (value.exclude_id !== undefined && value.exclude_id !== null && typeof value.exclude_id !== 'string') {
    throw new HttpError('exclude_id must be a string or null.', 400, 'INVALID_INPUT');
  }

  return {
    worker_id: value.worker_id,
    date: value.date,
    start_time: value.start_time,
    end_time: value.end_time,
    exclude_id: value.exclude_id ?? null,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const payload = parseSlotRequest(await request.json());
    const { supabase } = await createAuthenticatedClient(request);
    const { data, error } = await supabase.rpc('validate_appointment_slot', {
      p_worker_id: payload.worker_id,
      p_date: payload.date,
      p_start_time: payload.start_time,
      p_end_time: payload.end_time,
      p_exclude_id: payload.exclude_id,
    });

    if (error) {
      return databaseErrorResponse(error);
    }

    return jsonResponse({
      valid: data.length === 0,
      conflicts: data,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message, code: error.code }, error.status);
    }

    if (error instanceof SyntaxError) {
      return jsonResponse({ error: 'Request body must be valid JSON.', code: 'INVALID_JSON' }, 400);
    }

    console.error('Unexpected slot validation failure.', error);
    return jsonResponse({ error: 'Internal server error.', code: 'INTERNAL_ERROR' }, 500);
  }
});
