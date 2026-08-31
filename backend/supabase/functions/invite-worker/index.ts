import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

import {
  HttpError,
  corsHeaders,
  createAuthenticatedClient,
  databaseErrorResponse,
  jsonResponse,
} from '../_shared/supabase.ts';

type InviteRequest = {
  worker_id: string;
  email: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInviteRequest(value: unknown): InviteRequest {
  if (!isObject(value)) {
    throw new HttpError('Request body must be an object.', 400, 'INVALID_INPUT');
  }

  if (typeof value.worker_id !== 'string' || value.worker_id.trim().length === 0) {
    throw new HttpError('worker_id is required.', 400, 'INVALID_INPUT');
  }

  if (typeof value.email !== 'string' || value.email.trim().length === 0) {
    throw new HttpError('email is required.', 400, 'INVALID_INPUT');
  }

  return {
    worker_id: value.worker_id.trim(),
    email: value.email.trim().toLowerCase(),
  };
}

/**
 * Creates a Supabase client bound to the service-role key. This key lives ONLY in
 * the Edge Function environment and NEVER in the mobile bundle. Used exclusively to
 * create the auth user via the Admin API after the caller has been authorized as owner.
 */
function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError('The function is missing its Supabase admin configuration.', 500, 'MISCONFIGURED');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const payload = parseInviteRequest(await request.json());
    // Validates the owner's Bearer token and gives an RLS-scoped client.
    const { supabase, user } = await createAuthenticatedClient(request);

    // 1) Authorize: caller must be an owner.
    const { data: callerProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, business_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return databaseErrorResponse(profileError);
    }

    if (!callerProfile || callerProfile.role !== 'owner') {
      return jsonResponse(
        { error: 'Only owners can invite workers.', code: 'FORBIDDEN' },
        403
      );
    }

    // 2) The worker record must belong to the owner's business and be active.
    //    RLS already scopes this SELECT to the caller's business.
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, business_id, is_deleted')
      .eq('id', payload.worker_id)
      .maybeSingle();

    if (workerError) {
      return databaseErrorResponse(workerError);
    }

    if (!worker || worker.is_deleted || worker.business_id !== callerProfile.business_id) {
      return jsonResponse(
        { error: 'The worker does not exist in your business.', code: 'NOT_FOUND' },
        404
      );
    }

    // 3) Reject if the worker is already linked to an account.
    const { data: existingProfile, error: existingError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('worker_id', payload.worker_id)
      .maybeSingle();

    if (existingError) {
      return databaseErrorResponse(existingError);
    }

    if (existingProfile) {
      return jsonResponse(
        { error: 'This worker already has a linked account.', code: 'ALREADY_LINKED' },
        409
      );
    }

    // 4) Create the auth user via the Admin API (service-role, server-only).
    const admin = createAdminClient();
    const redirectTo = Deno.env.get('WORKER_INVITE_REDIRECT_URL') ?? undefined;

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      payload.email,
      {
        data: { worker_id: payload.worker_id, business_id: callerProfile.business_id },
        ...(redirectTo ? { redirectTo } : {}),
      }
    );

    if (inviteError || !invited?.user) {
      const message = inviteError?.message ?? '';

      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('registered')) {
        return jsonResponse(
          { error: 'That email is already registered.', code: 'EMAIL_TAKEN' },
          409
        );
      }

      console.error('Worker invitation failed.', inviteError);
      return jsonResponse({ error: 'Could not send the invitation.', code: 'INVITE_FAILED' }, 502);
    }

    // 5) Link the profile server-side using the owner's Bearer (SECURITY DEFINER RPC).
    const { error: linkError } = await supabase.rpc('link_worker_profile', {
      p_user_id: invited.user.id,
      p_worker_id: payload.worker_id,
      p_email: payload.email,
    });

    if (linkError) {
      // The auth user was created but the link failed. Roll it back to keep the
      // invite operation idempotent (the owner can safely retry).
      await admin.auth.admin.deleteUser(invited.user.id).catch((cleanupError) => {
        console.error('Failed to roll back invited auth user.', cleanupError);
      });
      return databaseErrorResponse(linkError);
    }

    return jsonResponse({ status: 'invited', worker_id: payload.worker_id });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message, code: error.code }, error.status);
    }

    if (error instanceof SyntaxError) {
      return jsonResponse({ error: 'Request body must be valid JSON.', code: 'INVALID_JSON' }, 400);
    }

    console.error('Unexpected worker invitation failure.', error);
    return jsonResponse({ error: 'Internal server error.', code: 'INTERNAL_ERROR' }, 500);
  }
});
