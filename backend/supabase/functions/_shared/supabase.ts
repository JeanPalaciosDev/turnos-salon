import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw new HttpError('Authentication is required.', 401, 'UNAUTHORIZED');
  }

  return match[1];
}

export async function createAuthenticatedClient(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new HttpError('The function is missing its Supabase configuration.', 500, 'MISCONFIGURED');
  }

  const accessToken = getBearerToken(request);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new HttpError('The access token is invalid or expired.', 401, 'UNAUTHORIZED');
  }

  return { supabase, user };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

type DatabaseError = {
  code?: string;
  message?: string;
};

export function databaseErrorResponse(error: unknown): Response {
  const databaseError = error as DatabaseError;
  const code = databaseError?.code;
  const message = databaseError?.message ?? 'Database operation failed.';

  if (code === '23P01' || message.startsWith('SYNC_CONFLICT:')) {
    return jsonResponse({ error: 'Sync conflict.', code: 'SYNC_CONFLICT' }, 409);
  }

  if (code === '42501') {
    return jsonResponse({ error: 'You are not allowed to perform this operation.', code: 'FORBIDDEN' }, 403);
  }

  if (code === '28000') {
    return jsonResponse({ error: 'Authentication is required.', code: 'UNAUTHORIZED' }, 401);
  }

  if (code?.startsWith('22') || code === '23514' || message.startsWith('SYNC_INPUT:')) {
    return jsonResponse({ error: 'Invalid synchronization payload.', code: 'INVALID_INPUT' }, 400);
  }

  console.error('Supabase database operation failed.', error);
  return jsonResponse({ error: 'Internal server error.', code: 'INTERNAL_ERROR' }, 500);
}
